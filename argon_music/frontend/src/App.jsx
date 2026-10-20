import React, { useState, useEffect, useRef } from 'react'
import Navbar from './components/Navbar'
import Sidebar, { PRESET_MODES } from './components/Sidebar'
import CuratorPrompt from './components/CuratorPrompt'
import PlaylistView from './components/PlaylistView'
import SonicDnaView from './components/SonicDnaView'
import PlayerBar from './components/PlayerBar'
import { getApiBase, curateStandalone } from './standaloneApi'

const API_BASE = getApiBase()

const DEFAULT_SEEDS = [
  { title: 'Renai Circulation', artist: 'Kana Hanazawa', video_id: 'F8xpmTmdf6o', duration_text: '4:16', thumbnail: 'https://i.ytimg.com/vi/F8xpmTmdf6o/hqdefault.jpg' },
  { title: 'mathemagics', artist: 'Marina Inoue', video_id: 'F_Cr9vZ08Ws', duration_text: '4:05', thumbnail: 'https://i.ytimg.com/vi/F_Cr9vZ08Ws/hqdefault.jpg' },
  { title: 'Kimi no Shiranai Monogatari', artist: 'supercell', video_id: '0VpGoDp3FCE', duration_text: '5:40', thumbnail: 'https://i.ytimg.com/vi/0VpGoDp3FCE/hqdefault.jpg' },
  { title: 'Staple Stable', artist: 'Chiwa Saito', video_id: 'CXDUXjsU5ao', duration_text: '4:36', thumbnail: 'https://i.ytimg.com/vi/CXDUXjsU5ao/hqdefault.jpg' },
  { title: 'Veridis Quo', artist: 'Daft Punk', video_id: 'TCd6PfxOy0Y', duration_text: '5:45', thumbnail: 'https://i.ytimg.com/vi/TCd6PfxOy0Y/hqdefault.jpg' },
  { title: 'A New Error', artist: 'Moderat', video_id: 'QpxFcMYRV08', duration_text: '6:07', thumbnail: 'https://i.ytimg.com/vi/QpxFcMYRV08/hqdefault.jpg' }
]

function loadStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

export default function App() {
  const [models] = useState([
    { id: 'gemini-3.8-flash', name: 'Gemini 3.8 Flash (Active)' },
    { id: 'gemini-4-argon', name: 'Gemini 4 Argon / ER-2 (1s Fast)' },
    { id: 'gemini-3.1-flash-lite', name: 'Gemini 3.1 Flash Lite (2s Fast)' },
    { id: 'gemini-3.5-flash-lite', name: 'Gemini 3.5 Flash Lite (Active)' },
    { id: 'gemini-flash-lite-latest', name: 'Gemini Flash Lite Latest' },
    { id: 'gemini-3-flash-preview', name: 'Gemini 3.0 Flash Preview' },
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
    { id: 'gemma-4-26b-a4b-it', name: 'Gemma 4 26B MoE' }
  ])
  const [selectedModel, setSelectedModel] = useState('gemini-3.8-flash')
  const [safariStatus, setSafariStatus] = useState(null)
  const [safariNowPlaying, setSafariNowPlaying] = useState(null)
  const [extractedTracks, setExtractedTracks] = useState(() => loadStorage('argon_seeds_v2', DEFAULT_SEEDS))
  const [favorites, setFavorites] = useState(() => loadStorage('argon_favs_v2', []))
  const [tasteDna, setTasteDna] = useState(() => loadStorage('argon_dna_v2', null))
  const [playlist, setPlaylist] = useState(() => loadStorage('argon_playlist_v2', null))
  const [currentTrack, setCurrentTrack] = useState(null)
  const [currentTrackIdx, setCurrentTrackIdx] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [playbackMode, setPlaybackMode] = useState('app')
  const [prompt, setPrompt] = useState('High-impact orchestral rock, Hiroyuki Sawano style soundtracks, and Monogatari / anime openings')
  const [activePresetId, setActivePresetId] = useState('ost')
  const [energyLevel, setEnergyLevel] = useState(78) // Matches 'ost' preset default (78%)
  const [trackCount, setTrackCount] = useState(8)
  const [activeTab, setActiveTab] = useState('curator')
  const [isGenerating, setIsGenerating] = useState(false)
  const [isResolvingBatch, setIsResolvingBatch] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [notification, setNotification] = useState(null)

  const initialBootRef = useRef(false)

  const showNotify = (msg, type = 'info') => {
    setNotification({ msg, type })
    setTimeout(() => setNotification(null), 3200)
  }

  // Persist to localStorage
  useEffect(() => {
    try { localStorage.setItem('argon_seeds_v2', JSON.stringify(extractedTracks)) } catch {}
  }, [extractedTracks])

  useEffect(() => {
    try { localStorage.setItem('argon_favs_v2', JSON.stringify(favorites)) } catch {}
  }, [favorites])

  useEffect(() => {
    if (tasteDna) {
      try { localStorage.setItem('argon_dna_v2', JSON.stringify(tasteDna)) } catch {}
    }
  }, [tasteDna])

  useEffect(() => {
    if (playlist) {
      try { localStorage.setItem('argon_playlist_v2', JSON.stringify(playlist)) } catch {}
    }
  }, [playlist])

  // Load persistent favorites from disk on mount
  useEffect(() => {
    fetch(`${API_BASE}/favorites`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.favorites) setFavorites(data.favorites)
      })
      .catch(() => {})
  }, [])

  // Check if a track is in favorites
  const isTrackFavorite = (track) => {
    if (!track || !favorites.length) return false
    const tVid = (track.video_id || '').trim()
    const tTitle = (track.title || '').trim().toLowerCase()
    const tArtist = (track.artist || '').trim().toLowerCase()

    return favorites.some((f) => {
      if (tVid && f.video_id && f.video_id === tVid) return true
      return (
        (f.title || '').trim().toLowerCase() === tTitle &&
        (f.artist || '').trim().toLowerCase() === tArtist
      )
    })
  }

  // Toggle favorite on backend + local state (with standalone mobile fallback)
  const handleToggleFavorite = async (track) => {
    if (!track) return
    try {
      const res = await fetch(`${getApiBase()}/favorites/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ track })
      })
      if (res.ok) {
        const data = await res.json()
        setFavorites(data.favorites || [])
        showNotify(
          data.is_favorite
            ? `Saved "${track.title}" to Favorites memory`
            : `Removed "${track.title}" from Favorites`,
          'info'
        )
        return
      }
    } catch {}

    // Standalone mobile fallback using localStorage
    const alreadyLiked = isTrackFavorite(track)
    const nextFavs = alreadyLiked
      ? favorites.filter(
          (f) =>
            !(
              (track.video_id && f.video_id === track.video_id) ||
              ((f.title || '').toLowerCase() === (track.title || '').toLowerCase() &&
                (f.artist || '').toLowerCase() === (track.artist || '').toLowerCase())
            )
        )
      : [{ ...track, liked_at: Math.floor(Date.now() / 1000) }, ...favorites]
    setFavorites(nextFavs)
    showNotify(
      !alreadyLiked
        ? `Saved "${track.title}" to Favorites memory`
        : `Removed "${track.title}" from Favorites`,
      'info'
    )
  }

  // Auto-heal any cached playlist tracks missing thumbnails or real durations
  useEffect(() => {
    if (!playlist?.tracks?.length) return
    const needsResolve = playlist.tracks.some(
      (t) => !t.video_id || !t.thumbnail || !t.duration_text || t.duration_text === '--:--' || t.duration_text === '3:30'
    )
    if (!needsResolve) return

    setIsResolvingBatch(true)
    fetch(`${API_BASE}/resolve-batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tracks: playlist.tracks })
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.tracks) {
          setPlaylist((prev) => (prev ? { ...prev, tracks: data.tracks } : prev))
          if (currentTrack) {
            const updatedCur = data.tracks.find((t) => t.title === currentTrack.title)
            if (updatedCur) setCurrentTrack(updatedCur)
          }
        }
      })
      .catch(() => {})
      .finally(() => setIsResolvingBatch(false))
  }, [playlist?.playlist_title])

  const checkSafari = async () => {
    try {
      const res = await fetch(`${API_BASE}/safari/tabs`)
      if (res.ok) {
        const data = await res.json()
        setSafariStatus(data)
        return data
      }
    } catch {}
    return null
  }

  const checkNowPlaying = async () => {
    try {
      const res = await fetch(`${API_BASE}/safari/now-playing`)
      if (res.ok) {
        const data = await res.json()
        setSafariNowPlaying(data.now_playing)
      }
    } catch {}
  }

  // Sync from Safari
  const handleSyncSafari = async (silent = false) => {
    setIsSyncing(true)
    if (!silent) showNotify('Syncing tracks from Safari...', 'info')
    try {
      const extractRes = await fetch(`${API_BASE}/safari/extract`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      })
      if (!extractRes.ok) {
        if (!silent) {
          const err = await extractRes.json().catch(() => ({}))
          showNotify(err.detail || 'No YouTube tab found in Safari', 'error')
        }
        setIsSyncing(false)
        return []
      }

      const extractData = await extractRes.json()
      const newTracks = extractData.tracks || []

      if (newTracks.length > 0) {
        setExtractedTracks(newTracks)
        if (!silent) showNotify(`Synced ${newTracks.length} tracks from Safari`, 'success')

        fetch(`${API_BASE}/taste-dna`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tracks: newTracks, model_name: selectedModel })
        })
          .then((r) => (r.ok ? r.json() : null))
          .then((dna) => {
            if (dna) setTasteDna(dna)
          })
          .catch(() => {})

        return newTracks
      } else {
        if (!silent) showNotify('Safari tab open, but 0 video items found on page', 'warning')
        return []
      }
    } catch (e) {
      if (!silent) showNotify(`Sync failed: ${e.message}`, 'error')
      return []
    } finally {
      setIsSyncing(false)
    }
  }

  // Generate Curated Playlist (Mac Backend + Standalone Android Fallback)
  const handleGenerate = async (overridePrompt, overrideSeeds, overrideEnergy) => {
    const activePrompt = overridePrompt || prompt
    if (!activePrompt || isGenerating) return

    setIsGenerating(true)
    setActiveTab('curator')

    try {
      let data = null
      try {
        const res = await fetch(`${getApiBase()}/curate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            seed_tracks: overrideSeeds || extractedTracks,
            mood_prompt: activePrompt,
            energy_level: overrideEnergy ?? energyLevel,
            count: trackCount,
            model_name: selectedModel
          })
        })
        if (res.ok) {
          data = await res.json()
        } else {
          const err = await res.json().catch(() => ({}))
          throw new Error(err.detail || `HTTP ${res.status}`)
        }
      } catch (backendErr) {
        // If running inside standalone Android APK / away from Mac server, use Standalone Client Engine
        if (backendErr.message?.includes('Failed to fetch') || backendErr.message?.includes('NetworkError') || backendErr.message?.includes('HTTP 404')) {
          data = await curateStandalone({
            mood_prompt: activePrompt,
            energy_level: overrideEnergy ?? energyLevel,
            count: trackCount,
            model_name: selectedModel
          })
        } else {
          throw backendErr
        }
      }

      setPlaylist(data)
      if (data.tracks && data.tracks.length > 0 && !currentTrack) {
        setCurrentTrack(data.tracks[0])
        setCurrentTrackIdx(0)
      }
      showNotify(`Curated "${data.playlist_title}" (${data.tracks?.length || 0} tracks)`, 'success')
    } catch (e) {
      showNotify(`Generation failed: ${e.message}`, 'error')
    } finally {
      setIsGenerating(false)
    }
  }

  // Initial boot: check Safari, auto-sync if YT tab is open, and ensure a playlist exists
  useEffect(() => {
    if (initialBootRef.current) return
    initialBootRef.current = true

    ;(async () => {
      const status = await checkSafari()
      let seeds = extractedTracks
      if (status?.has_yt) {
        const synced = await handleSyncSafari(true)
        if (synced.length > 0) seeds = synced
      }
      if (!playlist) {
        handleGenerate(prompt, seeds)
      } else if (playlist.tracks?.length > 0 && !currentTrack) {
        setCurrentTrack(playlist.tracks[0])
        setCurrentTrackIdx(0)
      }
    })()

    const timer = setInterval(() => {
      checkSafari()
      checkNowPlaying()
    }, 7000)
    return () => clearInterval(timer)
  }, [])

  const handleOpenSafari = async (destination = 'yt_liked') => {
    try {
      await fetch(`${API_BASE}/safari/open`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ destination })
      })
      showNotify('Opened YouTube in Safari', 'info')
      setTimeout(checkSafari, 1500)
    } catch (e) {
      showNotify(`Safari error: ${e.message}`, 'error')
    }
  }

  const handleSelectPreset = (preset) => {
    setActivePresetId(preset.id)
    setPrompt(preset.prompt)
    setEnergyLevel(preset.energy)
    handleGenerate(preset.prompt, undefined, preset.energy)
  }

  const handlePromptChange = (val) => {
    setPrompt(val)
    const matching = PRESET_MODES.find((p) => p.prompt === val)
    setActivePresetId(matching ? matching.id : null)
  }

  const handlePlayTrack = (track, idx) => {
    const isSame = currentTrack && (
      (currentTrack.video_id && currentTrack.video_id === track.video_id) ||
      (currentTrack.title === track.title && currentTrack.artist === track.artist)
    )
    if (isSame) {
      setIsPlaying(!isPlaying)
      return
    }
    setCurrentTrack(track)
    setCurrentTrackIdx(idx)
    setIsPlaying(true)

    if (playbackMode === 'safari') {
      handlePushToSafari(track)
    }
  }

  const handleTogglePlay = () => {
    if (!currentTrack && playlist?.tracks?.length > 0) {
      setCurrentTrack(playlist.tracks[0])
      setCurrentTrackIdx(0)
      setIsPlaying(true)
      return
    }
    setIsPlaying((prev) => !prev)
  }

  const getActiveTrackList = () => {
    if (activeTab === 'library') return extractedTracks
    if (activeTab === 'favorites') return favorites
    return playlist?.tracks || []
  }

  const handleNext = () => {
    const list = getActiveTrackList()
    if (!list || list.length === 0) return
    const nextIdx = (currentTrackIdx + 1) % list.length
    setCurrentTrack(list[nextIdx])
    setCurrentTrackIdx(nextIdx)
    setIsPlaying(true)
    if (playbackMode === 'safari') {
      handlePushToSafari(list[nextIdx])
    }
  }

  const handlePrev = () => {
    const list = getActiveTrackList()
    if (!list || list.length === 0) return
    const prevIdx = (currentTrackIdx - 1 + list.length) % list.length
    setCurrentTrack(list[prevIdx])
    setCurrentTrackIdx(prevIdx)
    setIsPlaying(true)
    if (playbackMode === 'safari') {
      handlePushToSafari(list[prevIdx])
    }
  }

  const handleTrackResolved = (track, resolvedData) => {
    setPlaylist((prev) => {
      if (!prev || !prev.tracks) return prev
      return {
        ...prev,
        tracks: prev.tracks.map((t) =>
          t.title === track.title && t.artist === track.artist
            ? {
                ...t,
                video_id: resolvedData.video_id,
                fallback_ids: resolvedData.fallback_ids || [],
                thumbnail: resolvedData.thumbnail,
                duration_text: resolvedData.duration_text || t.duration_text
              }
            : t
        )
      }
    })
  }

  const handlePushToSafari = async (track) => {
    if (!track) return
    const targetUrl = track.url || (track.video_id ? `https://www.youtube.com/watch?v=${track.video_id}` : '')
    if (!targetUrl) return

    try {
      await fetch(`${API_BASE}/safari/open`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ destination: 'custom', custom_url: targetUrl })
      })
      showNotify(`Opened "${track.title}" in Safari`, 'info')
    } catch (e) {
      showNotify(`Failed to open in Safari: ${e.message}`, 'error')
    }
  }

  const handleSafariControl = async (action) => {
    try {
      const res = await fetch(`${API_BASE}/safari/control`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      })
      const data = await res.json()
      if (data.status !== 'success') {
        showNotify(data.message || 'Safari control unavailable', 'warning')
      }
      setTimeout(checkNowPlaying, 400)
    } catch (e) {
      showNotify(`Safari error: ${e.message}`, 'error')
    }
  }

  const lastModelStatus = playlist
    ? {
        isFallback: Boolean(playlist.is_fallback) || (playlist.used_model && playlist.used_model !== selectedModel),
        usedModel: playlist.used_model || selectedModel,
        reason: playlist.fallback_reason || 'Target model busy or rate-limited'
      }
    : null

  return (
    <div className="h-screen w-screen bg-[#0a0a0c] text-[#f5f5f5] flex flex-col overflow-hidden">
      {/* Subtle Status Notification */}
      {notification && (
        <div className="fixed bottom-20 left-6 z-50">
          <div className={`px-3.5 py-2 rounded-md border text-xs font-mono flex items-center gap-2 shadow-xl ${
            notification.type === 'error'
              ? 'bg-[#1c1012] text-[#fca5a5] border-[#4c1d24]'
              : 'bg-[#16161c] text-[#e4e4e7] border-indigo-500/40'
          }`}>
            <span className={`w-2 h-2 rounded-full ${
              notification.type === 'error' ? 'bg-red-500' : 'bg-indigo-400'
            }`} />
            <span>{notification.msg}</span>
          </div>
        </div>
      )}

      {/* Top Bar */}
      <Navbar
        models={models}
        selectedModel={selectedModel}
        onSelectModel={setSelectedModel}
        lastModelStatus={lastModelStatus}
        safariStatus={safariStatus}
        onSyncSafari={() => handleSyncSafari(false)}
        onOpenSafari={handleOpenSafari}
        isSyncing={isSyncing}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        extractedCount={extractedTracks.length}
        favoritesCount={favorites.length}
        onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
      />

      {/* Workspace Body */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        <Sidebar
          tasteDna={tasteDna}
          energyLevel={energyLevel}
          setEnergyLevel={setEnergyLevel}
          trackCount={trackCount}
          setTrackCount={setTrackCount}
          activePresetId={activePresetId}
          onSelectPreset={handleSelectPreset}
          extractedCount={extractedTracks.length}
          favoritesCount={favorites.length}
          onOpenFavoritesTab={() => setActiveTab('favorites')}
          onSyncSafari={() => handleSyncSafari(false)}
          isSyncing={isSyncing}
          onOpenSafari={handleOpenSafari}
          isOpenMobile={isSidebarOpen}
          onCloseMobile={() => setIsSidebarOpen(false)}
        />

        <main className="flex-1 flex flex-col min-w-0 min-h-0 bg-[#0a0a0c]">
          {activeTab === 'curator' ? (
            <>
              <CuratorPrompt
                prompt={prompt}
                setPrompt={handlePromptChange}
                onGenerate={(p) => handleGenerate(p)}
                isGenerating={isGenerating}
              />
              <PlaylistView
                playlist={playlist}
                currentTrack={currentTrack}
                isPlaying={isPlaying}
                selectedModel={selectedModel}
                isResolvingBatch={isResolvingBatch}
                isTrackFavorite={isTrackFavorite}
                onToggleFavorite={handleToggleFavorite}
                onPlayTrack={handlePlayTrack}
                onPushToSafari={handlePushToSafari}
                isGenerating={isGenerating}
                onGenerateDefault={() => handleGenerate(prompt)}
              />
            </>
          ) : (
            <SonicDnaView
              mode={activeTab}
              tasteDna={tasteDna}
              extractedTracks={extractedTracks}
              favorites={favorites}
              isTrackFavorite={isTrackFavorite}
              onToggleFavorite={handleToggleFavorite}
              onCurateFromFavorites={() => {
                if (!favorites.length) return
                const favNames = favorites.slice(0, 4).map((f) => `"${f.title}" by ${f.artist}`).join(', ')
                const newPrompt = `Songs directly matching the sound and musical style of my favorites: ${favNames}`
                setPrompt(newPrompt)
                setActivePresetId(null)
                handleGenerate(newPrompt, favorites)
              }}
              onSyncSafari={() => handleSyncSafari(false)}
              isSyncing={isSyncing}
              onPlayTrack={handlePlayTrack}
              onPushToSafari={handlePushToSafari}
              onCurateSimilar={(track) => {
                const newPrompt = `Tracks with the exact musical style and atmosphere of "${track.title}" by ${track.artist}`
                setPrompt(newPrompt)
                setActivePresetId(null)
                handleGenerate(newPrompt)
              }}
            />
          )}
        </main>
      </div>

      {/* Bottom Transport Bar */}
      <PlayerBar
        currentTrack={currentTrack}
        isPlaying={isPlaying}
        setIsPlaying={setIsPlaying}
        onTogglePlay={handleTogglePlay}
        onNext={handleNext}
        onPrev={handlePrev}
        playbackMode={playbackMode}
        setPlaybackMode={setPlaybackMode}
        onPushToSafari={handlePushToSafari}
        safariNowPlaying={safariNowPlaying}
        onSafariControl={handleSafariControl}
        onTrackResolved={handleTrackResolved}
        isTrackFavorite={isTrackFavorite}
        onToggleFavorite={handleToggleFavorite}
      />
    </div>
  )
}
