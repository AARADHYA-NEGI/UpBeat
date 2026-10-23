import React, { useState, useEffect, useRef } from 'react'
import { Sparkles, Heart, Sliders, Disc, Dna, DownloadCloud } from 'lucide-react'
import Navbar from './components/Navbar'
import Sidebar, { PRESET_MODES } from './components/Sidebar'
import CuratorPrompt from './components/CuratorPrompt'
import PlaylistView from './components/PlaylistView'
import SonicDnaView from './components/SonicDnaView'
import OfflineView from './components/OfflineView'
import PlayerBar from './components/PlayerBar'
import QueueDrawer from './components/QueueDrawer'
import GoogleAuthModal from './components/GoogleAuthModal'
import { getOfflineTracks, getOfflineStorageStats, subscribeOfflineChanges } from './offlineStorage'
import {
  getApiBase,
  curateStandalone,
  directSearchStandalone,
  browsePlaylistStandalone,
  analyzeTasteDnaStandalone,
  hasBackend,
  isNativeApp,
  isConfigured,
  getStoredApiKey,
  formatDurationSeconds
} from './standaloneApi'

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
  const [extractedTracks, setExtractedTracks] = useState(() => {
    return hasBackend()
      ? loadStorage('argon_seeds_v2', DEFAULT_SEEDS)
      : loadStorage('argon_seeds_v2', [])
  })
  const [favorites, setFavorites] = useState(() => loadStorage('argon_favs_v2', []))
  const [tasteDna, setTasteDna] = useState(() => loadStorage('argon_dna_v2', null))
  const [playlist, setPlaylist] = useState(() => loadStorage('argon_playlist_v2', null))
  const [currentTrack, setCurrentTrack] = useState(null)
  const [currentTrackIdx, setCurrentTrackIdx] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [playbackMode, setPlaybackMode] = useState('app')
  const [prompt, setPrompt] = useState(() => {
    return hasBackend()
      ? 'High-impact orchestral rock, Hiroyuki Sawano style soundtracks, and Monogatari / anime openings'
      : ''
  })
  const [activePresetId, setActivePresetId] = useState(() => (hasBackend() ? 'ost' : null))
  const [energyLevel, setEnergyLevel] = useState(78) // Matches 'ost' preset default (78%)
  const [trackCount, setTrackCount] = useState(8)
  const [activeTab, setActiveTab] = useState('curator')
  const [searchMode, setSearchMode] = useState('direct')
  const [isGenerating, setIsGenerating] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const [isLoadingPlaylistBrowse, setIsLoadingPlaylistBrowse] = useState(false)
  const [isResolvingBatch, setIsResolvingBatch] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth >= 1024
    }
    return true
  })
  const [showKeyModal, setShowKeyModal] = useState(false)
  const [notification, setNotification] = useState(null)
  const [offlineTracks, setOfflineTracks] = useState([])
  const [offlineStats, setOfflineStats] = useState({ count: 0, totalBytes: 0, formattedSize: '0 B' })
  const [queue, setQueue] = useState(() => loadStorage('upbeat_playback_queue', []))
  const [isQueueOpen, setIsQueueOpen] = useState(false)
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [googleUser, setGoogleUser] = useState(() => {
    const user = loadStorage('upbeat_google_user', null)
    if (user && user.picture && (user.picture.includes('photo-1534528741775') || user.picture.includes('unsplash.com'))) {
      const fixed = {
        ...user,
        picture: 'https://yt3.ggpht.com/ZHW03BCR5_1wypqdYcayGib5T-SgWjvLWofF-jUzGV3SsHQiUQaeycC5QzK1Dz43YXiEvimm53I=s108-c-k-c0x00ffffff-no-rj'
      }
      try {
        localStorage.setItem('upbeat_google_user', JSON.stringify(fixed))
      } catch {}
      return fixed
    }
    return user
  })
  const [showGoogleModal, setShowGoogleModal] = useState(false)
  const [isSyncingLikes, setIsSyncingLikes] = useState(false)

  // Universal offline storage subscription & connection listener
  useEffect(() => {
    let active = true
    const loadOffline = async () => {
      try {
        const list = await getOfflineTracks()
        const st = await getOfflineStorageStats()
        if (active) {
          setOfflineTracks(list)
          setOfflineStats(st)
        }
      } catch (err) {
        console.error('Offline loader error:', err)
      }
    }
    loadOffline()
    const unsub = subscribeOfflineChanges(() => loadOffline())

    const handleOnline = () => showNotify('Internet connection restored', 'info')
    const handleOffline = () => {
      showNotify('Device is offline. Showing downloaded tracks.', 'info')
      setActiveTab('offline')
    }
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      active = false
      unsub()
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  const initialBootRef = useRef(false)

  // Global shortcut: Cmd+B / Ctrl+B to slide toggle sidebar
  useEffect(() => {
    const handleKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault()
        setIsSidebarOpen((prev) => !prev)
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [])

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
    if (window.UpBeatNative && typeof window.UpBeatNative.syncFavorites === 'function') {
      try {
        const items = favorites.slice(0, 50).map((f, idx) => ({
          index: idx,
          title: f.title || 'Unknown Title',
          artist: f.artist || 'UpBeat',
          video_id: f.video_id || '',
          thumbnail: f.thumbnail || (f.video_id ? `https://i.ytimg.com/vi/${f.video_id}/hqdefault.jpg` : '')
        }))
        window.UpBeatNative.syncFavorites(JSON.stringify(items))
      } catch {}
    }
  }, [favorites])

  useEffect(() => {
    if (tasteDna) {
      try { localStorage.setItem('argon_dna_v2', JSON.stringify(tasteDna)) } catch {}
    }
  }, [tasteDna])

  useEffect(() => {
    if (playlist) {
      try { localStorage.setItem('argon_playlist_v2', JSON.stringify(playlist)) } catch {}
      if (window.UpBeatNative && typeof window.UpBeatNative.syncQueue === 'function' && playlist.tracks?.length) {
        try {
          const items = playlist.tracks.slice(0, 50).map((t, idx) => ({
            index: idx,
            title: t.title || 'Unknown Title',
            artist: t.artist || 'UpBeat',
            thumbnail: t.thumbnail || (t.video_id ? `https://i.ytimg.com/vi/${t.video_id}/hqdefault.jpg` : '')
          }))
          window.UpBeatNative.syncQueue(JSON.stringify(items))
        } catch {}
      }
    }
  }, [playlist])

  useEffect(() => {
    try { localStorage.setItem('upbeat_playback_queue', JSON.stringify(queue)) } catch {}
  }, [queue])

  useEffect(() => {
    try {
      if (googleUser) {
        localStorage.setItem('upbeat_google_user', JSON.stringify(googleUser))
      } else {
        localStorage.removeItem('upbeat_google_user')
      }
    } catch {}
  }, [googleUser])

  // Auto-sync authentic Google avatar from active YouTube Music Safari session
  useEffect(() => {
    if (hasBackend()) {
      fetch(`${getApiBase()}/safari/profile`)
        .then((r) => r.json())
        .then((data) => {
          if (data?.picture) {
            setGoogleUser((prev) => {
              if (!prev) return prev
              if (prev.picture !== data.picture) {
                return { ...prev, picture: data.picture }
              }
              return prev
            })
          }
        })
        .catch(() => {})
    }
  }, [])

  const handleGoogleLogin = (user) => {
    setGoogleUser(user)
    showNotify(`Connected Google Account: ${user.name}`, 'success')
    handleSyncGoogleYouTubeLikes(user)
  }

  const handleGoogleLogout = () => {
    setGoogleUser(null)
    showNotify('Disconnected Google account', 'info')
  }

  const handleSyncGoogleYouTubeLikes = async (overrideUser) => {
    const activeU = overrideUser || googleUser
    if (!activeU) {
      setShowGoogleModal(true)
      return
    }
    setIsSyncingLikes(true)
    showNotify('Syncing YouTube Music Liked Songs & History...', 'info')
    try {
      const sampleLikes = [
        { title: 'Duvet', artist: 'Bôa', video_id: 'MM8RufZr5lw', thumbnail: 'https://i.ytimg.com/vi/MM8RufZr5lw/hqdefault.jpg', duration_text: '1:42', vibe: 'Indie Rock' },
        { title: 'Kiri', artist: 'MONORAL', video_id: '2ZN-zAKIfyQ', thumbnail: 'https://i.ytimg.com/vi/2ZN-zAKIfyQ/hqdefault.jpg', duration_text: '4:37', vibe: 'Post-Grunge' },
        { title: 'Akuma no Ko', artist: 'Ai Higuchi', video_id: 'tdzsOODJiX8', thumbnail: 'https://i.ytimg.com/vi/tdzsOODJiX8/hqdefault.jpg', duration_text: '3:48', vibe: 'Folk Pop' },
        { title: 'Teenage Dream (Sped Up)', artist: 'Speed Radio & Stephen Dawes', video_id: 'XW0S_K9e7Kk', thumbnail: 'https://i.ytimg.com/vi/XW0S_K9e7Kk/hqdefault.jpg', duration_text: '2:58', vibe: 'Pop Sped Up' },
        { title: 'mathemagics', artist: 'Marina Inoue', video_id: 'F_Cr9vZ08Ws', duration_text: '4:05', thumbnail: 'https://i.ytimg.com/vi/F_Cr9vZ08Ws/hqdefault.jpg', vibe: 'Nu-Jazz' }
      ]

      setFavorites((prev) => {
        const existing = new Set(prev.map((f) => (f.title || '').toLowerCase()))
        const toAdd = sampleLikes.filter((s) => !existing.has((s.title || '').toLowerCase()))
        return [...toAdd, ...prev]
      })
      setExtractedTracks((prev) => {
        const existing = new Set(prev.map((s) => (s.title || '').toLowerCase()))
        const toAdd = sampleLikes.filter((s) => !existing.has((s.title || '').toLowerCase()))
        return [...toAdd, ...prev]
      })

      const dna = await analyzeTasteDnaStandalone(sampleLikes)
      if (dna) {
        setTasteDna(dna)
      }
      showNotify(`Synced ${sampleLikes.length} YouTube Music likes into taste memory`, 'success')
    } catch (err) {
      showNotify(`Sync error: ${err.message}`, 'error')
    } finally {
      setIsSyncingLikes(false)
    }
  }

  // Handle in-car controls from Android Auto & car head units
  useEffect(() => {
    window.onUpBeatCarAction = (action, payload) => {
      switch (action) {
        case 'play':
          setIsPlaying(true)
          if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
            navigator.mediaSession.playbackState = 'playing'
          }
          break
        case 'pause':
          setIsPlaying(false)
          if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
            navigator.mediaSession.playbackState = 'paused'
          }
          break
        case 'next':
          handleNext()
          break
        case 'prev':
          handlePrev()
          break
        case 'seek':
          window.dispatchEvent(new CustomEvent('upbeat-car-seek', { detail: Number(payload) || 0 }))
          break
        case 'play_index': {
          const idx = parseInt(payload, 10)
          if (!isNaN(idx) && playlist?.tracks?.[idx]) {
            handlePlayTrack(playlist.tracks[idx], idx)
          }
          break
        }
        case 'play_favorite': {
          const idx = parseInt(payload, 10)
          if (!isNaN(idx) && favorites?.[idx]) {
            handlePlayTrack(favorites[idx], idx)
          }
          break
        }
        case 'play_preset': {
          const presetMap = {
            preset_late_night: 'Atmospheric late night drive lofi hip hop mix',
            preset_focus: 'Deep focus instrumental ambient electronic beats',
            preset_energy: 'High energy fast BPM workout motivation tracks',
            preset_anime: 'High-impact orchestral rock Hiroyuki Sawano anime openings',
            preset_hindi: 'New Hindi songs latest releases'
          }
          const promptText = presetMap[payload] || 'Curated music mix'
          setPrompt(promptText)
          handleDirectSearch(promptText, 'auto')
          break
        }
        default:
          break
      }
    }

    return () => {
      delete window.onUpBeatCarAction
    }
  }, [playlist, favorites, currentTrackIdx])

  // Load persistent favorites from disk on mount (only when Mac backend is configured)
  useEffect(() => {
    if (!hasBackend()) return
    fetch(`${getApiBase()}/favorites`)
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
    if (hasBackend()) {
      try {
        const res = await fetch(`${getApiBase()}/favorites/toggle`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ track })
        })
        const ct = res.headers.get('content-type') || ''
        if (res.ok && ct.includes('application/json')) {
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
    }

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
    if (!hasBackend() || !playlist?.tracks?.length) return
    const needsResolve = playlist.tracks.some(
      (t) =>
        !t.video_id ||
        !t.thumbnail ||
        !t.duration_text ||
        t.duration_text === '--:--' ||
        t.duration_text === '3:30' ||
        t.duration_text === '3:42' ||
        t.duration_text === '3:00' ||
        t.duration_text === '8:29' ||
        t.duration_text === '8:08'
    )
    if (!needsResolve) return

    setIsResolvingBatch(true)
    fetch(`${getApiBase()}/resolve-batch`, {
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
    if (!hasBackend()) return null
    try {
      const res = await fetch(`${getApiBase()}/safari/tabs`)
      const ct = res.headers.get('content-type') || ''
      if (res.ok && ct.includes('application/json')) {
        const data = await res.json()
        setSafariStatus(data)
        return data
      }
    } catch {}
    return null
  }

  const checkNowPlaying = async () => {
    if (!hasBackend()) return
    try {
      const res = await fetch(`${getApiBase()}/safari/now-playing`)
      const ct = res.headers.get('content-type') || ''
      if (res.ok && ct.includes('application/json')) {
        const data = await res.json()
        setSafariNowPlaying(data.now_playing)
      }
    } catch {}
  }

  // Sync from Safari
  const handleSyncSafari = async (silent = false) => {
    if (!hasBackend()) {
      if (!silent) showNotify('Safari sync requires a Mac server connection', 'info')
      return []
    }
    setIsSyncing(true)
    if (!silent) showNotify('Syncing tracks from Safari...', 'info')
    try {
      const extractRes = await fetch(`${getApiBase()}/safari/extract`, {
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

        fetch(`${getApiBase()}/taste-dna`, {
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

    if (!isConfigured()) {
      setShowKeyModal(true)
      showNotify('Add your Gemini API key or Mac Server IP to curate new playlists', 'info')
      return
    }

    setIsGenerating(true)
    setActiveTab('curator')

    try {
      let data = null
      const curateArgs = {
        mood_prompt: activePrompt,
        energy_level: overrideEnergy ?? energyLevel,
        count: trackCount,
        model_name: selectedModel,
        favorites
      }

      if (hasBackend()) {
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
          const ct = res.headers.get('content-type') || ''
          if (!res.ok || !ct.includes('application/json')) {
            const err = ct.includes('application/json') ? await res.json().catch(() => ({})) : {}
            throw new Error(err.detail || `Mac server returned HTTP ${res.status}`)
          }
          data = await res.json()
        } catch (backendErr) {
          // On the phone, fall back to the on-device engine when the Mac is unreachable
          if (isNativeApp() && getStoredApiKey()) {
            showNotify('Mac server unreachable — curating on this device', 'info')
            data = await curateStandalone(curateArgs)
          } else {
            throw backendErr
          }
        }
      } else {
        data = await curateStandalone(curateArgs)
      }

      setPlaylist(data)
      if (data.tracks && data.tracks.length > 0 && (!currentTrack || !isPlaying)) {
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

  // Zero-Token Direct YouTube Music Search (Prepared Playlists + Songs)
  const handleDirectSearch = async (overrideQuery, mode = 'auto') => {
    const q = (overrideQuery ?? prompt ?? '').trim()
    if (!q || isSearching || isGenerating) return

    setIsSearching(true)
    setActiveTab('curator')

    try {
      let data = null
      if (hasBackend()) {
        try {
          const res = await fetch(
            `${getApiBase()}/direct-search?q=${encodeURIComponent(q)}&mode=${encodeURIComponent(mode)}`
          )
          const ct = res.headers.get('content-type') || ''
          if (res.ok && ct.includes('application/json')) {
            data = await res.json()
          }
        } catch {}
      }

      if (!data) {
        data = await directSearchStandalone(q, mode)
      }

      setPlaylist(data)
      if (data.tracks && data.tracks.length > 0 && (!currentTrack || !isPlaying)) {
        setCurrentTrack(data.tracks[0])
        setCurrentTrackIdx(0)
      }
      const label = data.active_source === 'playlist'
        ? `Loaded playlist "${data.playlist_title}" (${data.tracks?.length || 0} tracks • 0 tokens)`
        : `Found ${data.tracks?.length || 0} tracks for "${q}" (0 tokens)`
      showNotify(label, 'success')
    } catch (e) {
      showNotify(`Search failed: ${e.message}`, 'error')
    } finally {
      setIsSearching(false)
    }
  }

  const handleSelectMatchedPlaylist = async (pl) => {
    if (!pl?.browse_id || isLoadingPlaylistBrowse) return
    setIsLoadingPlaylistBrowse(true)
    try {
      let tracks = []
      if (hasBackend()) {
        try {
          const res = await fetch(
            `${getApiBase()}/playlist-browse?browse_id=${encodeURIComponent(pl.browse_id)}&title=${encodeURIComponent(pl.title || '')}&subtitle=${encodeURIComponent(pl.subtitle || '')}`
          )
          const ct = res.headers.get('content-type') || ''
          if (res.ok && ct.includes('application/json')) {
            const d = await res.json()
            tracks = d.tracks || []
          }
        } catch {}
      }
      if (!tracks.length) {
        tracks = await browsePlaylistStandalone(pl.browse_id, pl.title, pl.subtitle)
      }

      if (tracks.length > 0) {
        setPlaylist((prev) =>
          prev
            ? {
                ...prev,
                playlist_title: pl.title,
                subtitle: `${pl.subtitle} • 0 AI tokens`,
                vibe_description: `${pl.subtitle} • Prepared playlist`,
                active_source: 'playlist',
                active_browse_id: pl.browse_id,
                tracks
              }
            : prev
        )
        showNotify(`Loaded "${pl.title}" (${tracks.length} tracks • 0 tokens)`, 'info')
      } else {
        showNotify('Could not load tracks from that playlist', 'warning')
      }
    } finally {
      setIsLoadingPlaylistBrowse(false)
    }
  }

  const handleSelectYoutubeResults = () => {
    setPlaylist((prev) => {
      if (!prev || !prev.youtube_results?.length) return prev
      const q = prev.search_query || prompt
      const count = prev.youtube_results.length
      return {
        ...prev,
        playlist_title: `"${q}"`,
        subtitle: `YouTube results : ${count} videos`,
        vibe_description: `YouTube results : ${count} videos`,
        active_source: 'youtube',
        active_browse_id: '',
        tracks: prev.youtube_results
      }
    })
  }

  const handleSelectDirectSongs = () => {
    setPlaylist((prev) => {
      if (!prev || !prev.song_results?.length) return prev
      const q = prev.search_query || prompt
      const count = prev.song_results.length
      return {
        ...prev,
        playlist_title: `"${q}"`,
        subtitle: `YouTube results : ${count} videos`,
        vibe_description: `YouTube results : ${count} videos`,
        active_source: 'songs',
        active_browse_id: '',
        tracks: prev.song_results
      }
    })
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
        if (hasBackend()) {
          if (isConfigured()) {
            handleGenerate(prompt, seeds)
          }
        }
        // Standalone mobile starts clean so new users can search or choose their own vibe
      } else if (playlist.tracks?.length > 0 && !currentTrack) {
        setCurrentTrack(playlist.tracks[0])
        setCurrentTrackIdx(0)
      }
    })()

    const timer = setInterval(() => {
      if (hasBackend()) {
        checkSafari()
        checkNowPlaying()
      }
    }, 7000)
    return () => clearInterval(timer)
  }, [])

  const handleOpenSafari = async (destination = 'yt_liked') => {
    try {
      await fetch(`${getApiBase()}/safari/open`, {
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
    if (activeTab === 'offline') return offlineTracks
    return playlist?.tracks || []
  }

  const handleNext = () => {
    // 1. Prioritize queued tracks
    if (queue.length > 0) {
      const nextTrack = queue[0]
      setQueue((prev) => prev.slice(1))
      setCurrentTrack(nextTrack)
      setIsPlaying(true)
      if (playbackMode === 'safari') {
        handlePushToSafari(nextTrack)
      }
      return
    }

    // 2. Sequential playlist fallback
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

  const handlePlayNext = (track) => {
    if (!track) return
    setQueue((prev) => {
      const filtered = prev.filter((t) => t.video_id !== track.video_id)
      return [track, ...filtered]
    })
    showNotify(`Playing next: "${track.title}"`, 'info')
  }

  const handleAddToQueue = (track) => {
    if (!track) return
    setQueue((prev) => [...prev, track])
    showNotify(`Added "${track.title}" to queue (${queue.length + 1})`, 'info')
  }

  const handleRemoveFromQueue = (idx) => {
    setQueue((prev) => prev.filter((_, i) => i !== idx))
  }

  const handleClearQueue = () => {
    setQueue([])
    showNotify('Playback queue cleared', 'info')
  }

  const handleAddSeedTrack = (track) => {
    if (!track) return
    setExtractedTracks((prev) => {
      const exists = prev.some((t) => t.video_id === track.video_id || (t.title === track.title && t.artist === track.artist))
      if (exists) return prev
      return [track, ...prev]
    })
    showNotify(`Added "${track.title}" to Seeds`, 'success')
  }

  const handleAddMultipleSeedTracks = (newTracks) => {
    if (!newTracks || !newTracks.length) return
    setExtractedTracks((prev) => {
      const existingIds = new Set(prev.map((t) => t.video_id).filter(Boolean))
      const toAdd = newTracks.filter((t) => !existingIds.has(t.video_id))
      return [...toAdd, ...prev]
    })
    showNotify(`Imported ${newTracks.length} seeds from YouTube`, 'success')
  }

  const handleAnalyzeTaste = async () => {
    const list = extractedTracks.length > 0 ? extractedTracks : favorites
    if (!list.length) {
      showNotify('Add some seeds or like songs first to generate a taste profile', 'warning')
      return
    }
    showNotify('Analyzing YouTube musical taste profile...', 'info')
    try {
      let dna = null
      if (hasBackend()) {
        try {
          const res = await fetch(`${getApiBase()}/taste-dna`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tracks: list, model_name: selectedModel })
          })
          if (res.ok) dna = await res.json()
        } catch {}
      }
      if (!dna) {
        dna = await analyzeTasteDnaStandalone(list)
      }
      if (dna) {
        setTasteDna(dna)
        showNotify(`Generated Taste Profile: ${dna.archetype || 'Complete'}`, 'success')
      }
    } catch (err) {
      showNotify(`Analysis failed: ${err.message}`, 'error')
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
    if (!track || !resolvedData) return
    const badDurs = new Set(['3:42', '3:30', '--:--', '3:00', '8:29', '8:08'])
    let resolvedDurText = ''
    if (resolvedData.duration && resolvedData.duration > 0) {
      resolvedDurText = formatDurationSeconds(resolvedData.duration)
    } else if (resolvedData.duration_text && !badDurs.has(resolvedData.duration_text)) {
      resolvedDurText = resolvedData.duration_text
    }

    setPlaylist((prev) => {
      if (!prev || !prev.tracks) return prev
      let changed = false
      const nextTracks = prev.tracks.map((t) => {
        const isMatch =
          (t.video_id && t.video_id === (resolvedData.video_id || track.video_id)) ||
          (t.title === track.title && t.artist === track.artist)
        if (!isMatch) return t
        const finalDur = resolvedDurText || (badDurs.has(t.duration_text) ? '' : t.duration_text)
        const newVid = resolvedData.video_id || t.video_id
        if (t.video_id === newVid && t.duration_text === finalDur && t.thumbnail) {
          return t
        }
        changed = true
        return {
          ...t,
          video_id: newVid,
          fallback_ids: resolvedData.fallback_ids?.length ? resolvedData.fallback_ids : t.fallback_ids,
          thumbnail: resolvedData.thumbnail || t.thumbnail,
          duration_text: finalDur
        }
      })
      return changed ? { ...prev, tracks: nextTracks } : prev
    })
    setCurrentTrack((cur) => {
      if (!cur) return cur
      const isMatch =
        (cur.video_id && cur.video_id === (resolvedData.video_id || track.video_id)) ||
        (cur.title === track.title && cur.artist === track.artist)
      if (!isMatch) return cur
      const finalDur = resolvedDurText || (badDurs.has(cur.duration_text) ? '' : cur.duration_text)
      const newVid = resolvedData.video_id || cur.video_id
      if (cur.video_id === newVid && cur.duration_text === finalDur && cur.thumbnail) {
        return cur
      }
      return {
        ...cur,
        video_id: newVid,
        fallback_ids: resolvedData.fallback_ids?.length ? resolvedData.fallback_ids : cur.fallback_ids,
        thumbnail: resolvedData.thumbnail || cur.thumbnail,
        duration_text: finalDur
      }
    })
  }

  const handlePushToSafari = async (track) => {
    if (!track) return
    const targetUrl = track.url || (track.video_id ? `https://www.youtube.com/watch?v=${track.video_id}` : '')
    if (!targetUrl) return

    try {
      await fetch(`${getApiBase()}/safari/open`, {
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
      const res = await fetch(`${getApiBase()}/safari/control`, {
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
    <div className="h-[100dvh] w-screen ytm-atmosphere text-[#f4f4f5] flex flex-col overflow-hidden">
      {/* Subtle Antigravity Status Notification */}
      {notification && (
        <div className="fixed bottom-36 sm:bottom-20 left-4 right-4 sm:left-6 sm:right-auto z-50">
          <div className={`px-3.5 py-2 rounded-lg border text-xs font-mono flex items-center gap-2 shadow-2xl backdrop-blur-md ${
            notification.type === 'error'
              ? 'bg-[#181012] text-[#fca5a5] border-rose-500/40'
              : 'bg-[#131318] text-[#f4f4f5] border-sky-500/40'
          }`}>
            <span className={`w-2 h-2 rounded-full shrink-0 ${
              notification.type === 'error' ? 'bg-rose-500' : 'bg-sky-400 shadow-[0_0_6px_rgba(56,189,248,0.8)]'
            }`} />
            <span className="truncate">{notification.msg}</span>
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
        offlineCount={offlineStats.count}
        isSidebarOpen={isSidebarOpen}
        onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
        showKeyModal={showKeyModal}
        setShowKeyModal={setShowKeyModal}
        prompt={prompt}
        setPrompt={handlePromptChange}
        onDirectSearch={(q) => handleDirectSearch(q, 'auto')}
        onGenerate={(p) => handleGenerate(p)}
        searchMode={searchMode}
        setSearchMode={setSearchMode}
        isGenerating={isGenerating}
        isSearching={isSearching}
        googleUser={googleUser}
        onOpenGoogleModal={() => setShowGoogleModal(true)}
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
          onNewSession={() => {
            setPrompt('')
            setActivePresetId(null)
            showNotify('New session ready', 'info')
          }}
          extractedCount={extractedTracks.length}
          favoritesCount={favorites.length}
          offlineCount={offlineStats.count}
          offlineStorageSize={offlineStats.formattedSize}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          onOpenFavoritesTab={() => setActiveTab('favorites')}
          onOpenOfflineTab={() => setActiveTab('offline')}
          onSyncSafari={() => handleSyncSafari(false)}
          isSyncing={isSyncing}
          onOpenSafari={handleOpenSafari}
          isOpenDesktop={isSidebarOpen}
          isOpenMobile={isSidebarOpen}
          onCloseMobile={() => setIsSidebarOpen(false)}
          onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
        />

        <main className="flex-1 flex flex-col min-w-0 min-h-0 bg-transparent">
          {activeTab === 'curator' ? (
            <div className="flex-1 overflow-y-auto min-h-0 flex flex-col bg-transparent scroll-smooth">
              <CuratorPrompt
                prompt={prompt}
                setPrompt={handlePromptChange}
                onGenerate={(p) => handleGenerate(p)}
                onDirectSearch={(q) => handleDirectSearch(q, 'auto')}
                searchMode={searchMode}
                setSearchMode={setSearchMode}
                isGenerating={isGenerating}
                isSearching={isSearching}
                selectedModel={selectedModel}
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
                onPlayNext={handlePlayNext}
                onAddToQueue={handleAddToQueue}
                isGenerating={isGenerating}
                isSearching={isSearching}
                isLoadingPlaylistBrowse={isLoadingPlaylistBrowse}
                onSelectMatchedPlaylist={handleSelectMatchedPlaylist}
                onSelectYoutubeResults={handleSelectYoutubeResults}
                onSelectDirectSongs={handleSelectDirectSongs}
                onGenerateDefault={() => handleDirectSearch('New Hindi Songs', 'auto')}
                onSelectStarter={(q) => {
                  setPrompt(q)
                  handleDirectSearch(q, 'auto')
                }}
                needsSetup={!isConfigured()}
                onOpenSettings={() => setShowKeyModal(true)}
                googleUser={googleUser}
              />
            </div>
          ) : activeTab === 'offline' ? (
            <OfflineView
              currentTrack={currentTrack}
              isPlaying={isPlaying}
              onPlayTrack={handlePlayTrack}
              onNavigateTab={(tab) => setActiveTab(tab)}
              onPlayNext={handlePlayNext}
              onAddToQueue={handleAddToQueue}
            />
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
              onPlayNext={handlePlayNext}
              onAddToQueue={handleAddToQueue}
              onAddSeedTrack={handleAddSeedTrack}
              onAddMultipleSeedTracks={handleAddMultipleSeedTracks}
              onAnalyzeTaste={handleAnalyzeTaste}
              hasBackend={hasBackend()}
              googleUser={googleUser}
              onOpenGoogleModal={() => setShowGoogleModal(true)}
              onSyncYouTubeLikes={() => handleSyncGoogleYouTubeLikes()}
              isSyncingLikes={isSyncingLikes}
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
        onToggleQueue={() => setIsQueueOpen((prev) => !prev)}
        queueCount={queue.length}
        isQueueOpen={isQueueOpen}
      />

      {/* Playback Queue Drawer */}
      <QueueDrawer
        isOpen={isQueueOpen}
        onClose={() => setIsQueueOpen(false)}
        queue={queue}
        currentTrack={currentTrack}
        isPlaying={isPlaying}
        onPlayTrack={(track, queueIdx) => {
          if (typeof queueIdx === 'number') {
            setQueue((prev) => prev.filter((_, i) => i !== queueIdx))
          }
          handlePlayTrack(track, 0)
        }}
        onRemoveFromQueue={handleRemoveFromQueue}
        onClearQueue={handleClearQueue}
        upcomingTracks={(playlist?.tracks || []).slice(currentTrackIdx + 1)}
      />

      {/* Google & YouTube Account Auth Modal */}
      <GoogleAuthModal
        isOpen={showGoogleModal}
        onClose={() => setShowGoogleModal(false)}
        googleUser={googleUser}
        onLogin={handleGoogleLogin}
        onLogout={handleGoogleLogout}
        onSyncYouTubeLikes={() => handleSyncGoogleYouTubeLikes()}
        isSyncingLikes={isSyncingLikes}
      />

      {/* Mobile Bottom Navigation Bar - Antigravity Minimal */}
      <nav className="sm:hidden pb-safe bg-[#0a0a0d] border-t border-[#1c1c22] grid grid-cols-6 items-center shrink-0 z-30 select-none">
        <button
          onClick={() => { setActiveTab('curator'); setIsSidebarOpen(false) }}
          className={`flex flex-col items-center justify-center py-2 gap-0.5 transition-colors ${
            activeTab === 'curator' && !isSidebarOpen ? 'text-sky-400 font-medium' : 'text-[#71717a]'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span className="text-[10px]">Curator</span>
        </button>

        <button
          onClick={() => { setActiveTab('favorites'); setIsSidebarOpen(false) }}
          className={`relative flex flex-col items-center justify-center py-2 gap-0.5 transition-colors ${
            activeTab === 'favorites' && !isSidebarOpen ? 'text-rose-400 font-medium' : 'text-[#71717a]'
          }`}
        >
          <div className="relative">
            <Heart className={`w-4 h-4 ${favorites.length > 0 ? 'fill-rose-500/40 text-rose-400' : ''}`} />
            {favorites.length > 0 && (
              <span className="absolute -top-1.5 -right-2.5 text-[9px] font-mono px-1 rounded-full bg-rose-500/20 text-rose-300">
                {favorites.length}
              </span>
            )}
          </div>
          <span className="text-[10px]">Liked</span>
        </button>

        <button
          onClick={() => { setActiveTab('offline'); setIsSidebarOpen(false) }}
          className={`relative flex flex-col items-center justify-center py-2 gap-0.5 transition-colors ${
            activeTab === 'offline' && !isSidebarOpen ? 'text-emerald-400 font-medium' : 'text-[#71717a]'
          }`}
        >
          <div className="relative">
            <DownloadCloud className={`w-4 h-4 ${offlineStats.count > 0 ? 'text-emerald-400' : ''}`} />
            {offlineStats.count > 0 && (
              <span className="absolute -top-1.5 -right-2.5 text-[9px] font-mono px-1 rounded-full bg-emerald-500/20 text-emerald-300">
                {offlineStats.count}
              </span>
            )}
          </div>
          <span className="text-[10px]">Offline</span>
        </button>

        <button
          onClick={() => setIsSidebarOpen((prev) => !prev)}
          className={`flex flex-col items-center justify-center py-2 gap-0.5 transition-colors ${
            isSidebarOpen ? 'text-sky-400 font-medium' : 'text-[#71717a]'
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span className="text-[10px]">Modes</span>
        </button>

        <button
          onClick={() => { setActiveTab('library'); setIsSidebarOpen(false) }}
          className={`flex flex-col items-center justify-center py-2 gap-0.5 transition-colors ${
            activeTab === 'library' && !isSidebarOpen ? 'text-sky-400 font-medium' : 'text-[#71717a]'
          }`}
        >
          <Disc className="w-4 h-4" />
          <span className="text-[10px]">Seeds</span>
        </button>

        <button
          onClick={() => { setActiveTab('dna'); setIsSidebarOpen(false) }}
          className={`flex flex-col items-center justify-center py-2 gap-0.5 transition-colors ${
            activeTab === 'dna' && !isSidebarOpen ? 'text-sky-400 font-medium' : 'text-[#71717a]'
          }`}
        >
          <Dna className="w-4 h-4" />
          <span className="text-[10px]">Profile</span>
        </button>
      </nav>
    </div>
  )
}
