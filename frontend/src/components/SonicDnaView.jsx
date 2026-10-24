import React, { useState, useEffect } from 'react'
import {
  RefreshCw, ExternalLink, Search, Music, Heart, Play,
  Sparkles, Download, Check, Loader2, ListPlus, Activity,
  Sliders, Zap, ShieldCheck, Flame, Compass, ChevronRight, Disc, X, Trash2, RotateCcw
} from 'lucide-react'
import { getTrackDownloadUrl, getAudioSource } from '../standaloneApi'
import { saveTrackOffline, createOfflineAudioUrl, getDownloadedVideoIds, subscribeOfflineChanges } from '../offlineStorage'
import YouTubeTasteSyncModal, { Youtube } from './YouTubeTasteSyncModal'
import { GoogleIcon } from './GoogleAuthModal'

export default function SonicDnaView({
  mode = 'dna',
  tasteDna,
  extractedTracks = [],
  favorites = [],
  isTrackFavorite,
  onToggleFavorite,
  onCurateFromFavorites,
  onSyncSafari,
  isSyncing,
  onPlayTrack,
  onPushToSafari,
  onCurateSimilar,
  onPlayNext,
  onAddToQueue,
  onAddSeedTrack,
  onAddMultipleSeedTracks,
  onAnalyzeTaste,
  hasBackend = false,
  googleUser,
  onOpenGoogleModal,
  onSyncYouTubeLikes,
  isSyncingLikes = false,
  onClearSeeds,
  onResetTasteDna
}) {
  const [filter, setFilter] = useState('')
  const [downloadingVid, setDownloadingVid] = useState(null)
  const [downloadedVid, setDownloadedVid] = useState(null)
  const [downloadedSet, setDownloadedSet] = useState(new Set())
  const [isTasteSyncOpen, setIsTasteSyncOpen] = useState(false)
  const [queueMenuIdx, setQueueMenuIdx] = useState(null)

  useEffect(() => {
    let active = true
    const updateIds = async () => {
      const ids = await getDownloadedVideoIds()
      if (active) setDownloadedSet(ids)
    }
    updateIds()
    const unsub = subscribeOfflineChanges(() => updateIds())
    return () => {
      active = false
      unsub()
    }
  }, [])

  const handleDownloadTrack = async (t, e) => {
    e.stopPropagation()
    if (!t) return
    const vid = t.video_id
    if (!vid) return

    setDownloadingVid(vid)
    try {
      // 1. Save directly to client IndexedDB offline storage
      await saveTrackOffline(t)

      // 2. Also trigger native file download
      const title = (t.title || 'Track').replace(/[\\/*?:"<>|]/g, '').trim()
      const artist = (t.artist || '').replace(/[\\/*?:"<>|]/g, '').trim()
      const cleanFileName = artist && !title.toLowerCase().includes(artist.toLowerCase())
        ? `${artist} - ${title}.m4a`
        : `${title}.m4a`

      let blobUrl = null
      try {
        blobUrl = await createOfflineAudioUrl(vid)
      } catch {}

      let downloadUrl = blobUrl || getTrackDownloadUrl(t)
      if (!downloadUrl) {
        const src = await getAudioSource(vid)
        downloadUrl = typeof src === 'string' ? src : src?.url
      }
      if (downloadUrl) {
        const a = document.createElement('a')
        a.href = downloadUrl
        a.download = cleanFileName
        document.body.appendChild(a)
        a.click()
        setTimeout(() => {
          try {
            document.body.removeChild(a)
            if (blobUrl) URL.revokeObjectURL(blobUrl)
          } catch {}
        }, 1500)
      }

      setDownloadedVid(vid)
      setTimeout(() => setDownloadedVid(null), 2200)
    } catch (err) {
      console.error('Download error:', err)
    } finally {
      setDownloadingVid(null)
    }
  }

  // 1. FAVORITES MEMORY VIEW
  if (mode === 'favorites') {
    const filteredFavs = favorites.filter((t) => {
      if (!filter.trim()) return true
      const q = filter.toLowerCase()
      return (
        (t.title || '').toLowerCase().includes(q) ||
        (t.artist || '').toLowerCase().includes(q)
      )
    })

    return (
      <div className="flex-1 flex flex-col min-h-0 bg-transparent gpu-scroll">
        <div className="px-3.5 sm:px-6 py-2.5 sm:py-3.5 border-b border-white/[0.06] bg-gradient-to-b from-[var(--atm-accent)]/15 via-[#030305]/85 to-[#030305]/95 backdrop-blur-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-4">
          <div className="flex items-center gap-2">
            <Heart className="w-4 h-4 fill-rose-500 text-rose-500 shrink-0" />
            <h2 className="text-sm sm:text-base font-semibold text-[#f5f5f5]">
              Favourites ({favorites.length})
            </h2>
          </div>

          {favorites.length > 0 && (
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="flex-1 sm:w-48 flex items-center bg-[#141418] border border-[#282830] rounded-xl px-3 py-1.5">
                <Search className="w-3.5 h-3.5 text-[#8e8e93] mr-2 shrink-0" />
                <input
                  type="text"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  placeholder="Filter favourites..."
                  className="bg-transparent text-xs text-[#f5f5f5] placeholder:text-[#73737a] focus:outline-none w-full"
                />
                {Boolean(filter) && (
                  <button
                    type="button"
                    onClick={() => setFilter('')}
                    className="text-zinc-500 hover:text-white p-0.5 cursor-pointer shrink-0"
                    title="Clear filter"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              {onCurateFromFavorites && (
                <button
                  onClick={onCurateFromFavorites}
                  title="Generate a fresh playlist inspired by your hearted songs"
                  className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shadow-sm active:scale-[0.98] shrink-0"
                >
                  <Sparkles className="w-3.5 h-3.5 shrink-0" />
                  <span>Curate from Favs</span>
                </button>
              )}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          {filteredFavs.length === 0 ? (
            <div className="p-14 text-center flex flex-col items-center justify-center">
              <div className="w-10 h-10 rounded-lg border border-[#2a2a32] bg-[#141418] flex items-center justify-center mb-3">
                <Heart className="w-4 h-4 text-rose-400" />
              </div>
              <p className="text-sm font-medium text-[#f5f5f5]">
                {favorites.length === 0 ? 'No songs hearted yet' : 'No matching favorites'}
              </p>
              <p className="text-xs text-[#a1a1aa] mt-1 max-w-sm">
                Click the heart icon on any track in the Curator, Safari Library, or bottom player bar to save it to your permanent taste memory.
              </p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/[0.06] text-[10px] font-mono uppercase tracking-wider text-[#9ca3af] bg-[#030305]/80 backdrop-blur-md sticky top-0 z-10">
                  <th className="py-2.5 pl-3.5 sm:pl-6 pr-2 w-8 sm:w-10">#</th>
                  <th className="py-2.5 px-2 sm:px-3">Track</th>
                  <th className="py-2.5 px-3 hidden md:table-cell">Artist</th>
                  <th className="py-2.5 px-3 hidden sm:table-cell">Style</th>
                  <th className="py-2.5 px-2 sm:px-3 text-right pr-3.5 sm:pr-6">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04] text-xs">
                {filteredFavs.map((t, idx) => {
                  const thumb = t.thumbnail || (t.video_id ? `https://i.ytimg.com/vi/${t.video_id}/hqdefault.jpg` : '')
                  return (
                    <tr
                      key={idx}
                      onClick={() => onPlayTrack(t, idx)}
                      className="group hover:bg-white/[0.04] transition-colors cursor-pointer fast-row"
                    >
                      <td className="py-2.5 pl-3.5 sm:pl-6 pr-2 font-mono text-xs text-[#9ca3af]">
                        {(idx + 1).toString().padStart(2, '0')}
                      </td>
                      <td className="py-2.5 px-2 sm:px-3 max-w-[210px] sm:max-w-md">
                        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                          <div className="w-9 h-9 rounded bg-[#18181e] border border-[#282830] overflow-hidden flex-shrink-0">
                            {thumb ? (
                              <img src={thumb} alt="" className="w-full h-full object-cover" loading="lazy" />
                            ) : (
                              <Music className="w-3.5 h-3.5 text-[#73737a] m-auto mt-2.5" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold text-[13px] text-[#f5f5f5] truncate">
                              {t.title}
                            </div>
                            <div className="text-[11px] text-[#a1a1aa] truncate md:hidden">
                              {t.artist}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-[#b4b4b8] truncate max-w-[200px] hidden md:table-cell">
                        {t.artist}
                      </td>
                      <td className="py-2.5 px-3 hidden sm:table-cell">
                        <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-[#16161c] text-[#b4b4b8] border border-[#282832]">
                          {t.vibe || 'Favorite'}
                        </span>
                      </td>
                      <td
                        className="py-2.5 pl-2 pr-3.5 sm:pr-6 text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-end gap-1.5">
                          <div className="relative">
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                setQueueMenuIdx(queueMenuIdx === `fav-${idx}` ? null : `fav-${idx}`)
                              }}
                              title="Queue options"
                              className={`p-1.5 rounded hover:bg-[#22222a] transition-colors cursor-pointer ${
                                queueMenuIdx === `fav-${idx}` ? 'text-sky-400 bg-sky-500/20' : 'text-[#8e8e93] hover:text-sky-300'
                              }`}
                            >
                              <ListPlus className="w-3.5 h-3.5" />
                            </button>
                            {queueMenuIdx === `fav-${idx}` && (
                              <div
                                onClick={(e) => e.stopPropagation()}
                                className="absolute right-0 bottom-full mb-1 w-36 py-1 bg-[#14141c] border border-[#262638] rounded-xl shadow-2xl z-40 text-xs font-medium text-left animate-in fade-in zoom-in-95 duration-100"
                              >
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    onPlayNext && onPlayNext(t)
                                    setQueueMenuIdx(null)
                                  }}
                                  className="w-full text-left px-3 py-1.5 hover:bg-[#1e1e2c] text-[#f4f4f5] flex items-center gap-2 cursor-pointer"
                                >
                                  <span className="text-sky-400 font-bold">⚡</span>
                                  <span>Play Next</span>
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    onAddToQueue && onAddToQueue(t)
                                    setQueueMenuIdx(null)
                                  }}
                                  className="w-full text-left px-3 py-1.5 hover:bg-[#1e1e2c] text-[#a1a1aa] hover:text-white flex items-center gap-2 cursor-pointer"
                                >
                                  <span className="text-emerald-400 font-bold">+</span>
                                  <span>Add to Queue</span>
                                </button>
                              </div>
                            )}
                          </div>
                          <button
                            onClick={() => onToggleFavorite && onToggleFavorite(t)}
                            title="Remove from Favorites memory"
                            className="p-1.5 rounded hover:bg-[#22222a] text-rose-400 transition-colors cursor-pointer"
                          >
                            <Heart className="w-3.5 h-3.5 fill-rose-500 text-rose-500" />
                          </button>
                          {onCurateSimilar && (
                            <button
                              onClick={() => onCurateSimilar(t)}
                              title="Curate a playlist around this song"
                              className="p-1.5 sm:px-2.5 sm:py-1 rounded bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/30 text-[11px] font-mono text-indigo-200 hover:text-white transition-colors cursor-pointer flex items-center gap-1 shrink-0"
                            >
                              <Sparkles className="w-3.5 h-3.5 text-indigo-300" />
                              <span className="hidden sm:inline">Curate Similar</span>
                            </button>
                          )}
                          <button
                            onClick={(e) => handleDownloadTrack(t, e)}
                            disabled={downloadingVid === t.video_id}
                            title={downloadingVid === t.video_id ? 'Downloading...' : (downloadedSet.has(t.video_id) || downloadedVid === t.video_id) ? 'Downloaded (Offline ready)' : 'Download Track'}
                            className={`p-1.5 rounded hover:bg-[#22222a] transition-colors cursor-pointer ${
                              (downloadedSet.has(t.video_id) || downloadedVid === t.video_id) ? 'text-emerald-400' : 'text-[#a1a1aa] hover:text-white'
                            }`}
                          >
                            {downloadingVid === t.video_id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                            ) : (downloadedSet.has(t.video_id) || downloadedVid === t.video_id) ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Download className="w-3.5 h-3.5" />
                            )}
                          </button>
                          {hasBackend && (
                            <button
                              onClick={() => onPushToSafari(t)}
                              title="Open in Safari"
                              className="hidden sm:inline-flex p-1.5 rounded hover:bg-[#22222a] text-[#a1a1aa] hover:text-white transition-colors cursor-pointer"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    )
  }

  // 2. YOUTUBE & SEEDS LIBRARY VIEW
  if (mode === 'library') {
    const filteredTracks = extractedTracks.filter((t) => {
      if (!filter.trim()) return true
      const q = filter.toLowerCase()
      return (
        (t.title || '').toLowerCase().includes(q) ||
        (t.artist || '').toLowerCase().includes(q)
      )
    })

    return (
      <div className="flex-1 flex flex-col min-h-0 bg-transparent gpu-scroll" onClick={() => setQueueMenuIdx(null)}>
        <div className="px-3.5 sm:px-6 py-2.5 sm:py-3.5 border-b border-white/[0.06] bg-gradient-to-b from-[var(--atm-accent)]/15 via-[#030305]/85 to-[#030305]/95 backdrop-blur-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-4">
          <div className="flex items-center gap-2">
            <h2 className="text-sm sm:text-base font-semibold text-[#f5f5f5]">
              YouTube Seeds & Library ({extractedTracks.length})
            </h2>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="flex-1 sm:w-48 flex items-center bg-[#141418] border border-[#282830] rounded-xl px-3 py-1.5">
              <Search className="w-3.5 h-3.5 text-[#8e8e93] mr-2 shrink-0" />
              <input
                type="text"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Filter tracks..."
                className="bg-transparent text-xs text-[#f5f5f5] placeholder:text-[#73737a] focus:outline-none w-full"
              />
              {Boolean(filter) && (
                <button
                  type="button"
                  onClick={() => setFilter('')}
                  className="text-zinc-500 hover:text-white p-0.5 cursor-pointer shrink-0"
                  title="Clear filter"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            <button
              onClick={() => setIsTasteSyncOpen(true)}
              title="Add seeds from YouTube search or playlist URL"
              className="px-3.5 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/35 text-xs text-rose-200 font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap active:scale-[0.98] shrink-0"
            >
              <Youtube className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              <span>Sync YouTube Seeds</span>
            </button>

            {onClearSeeds && extractedTracks.length > 0 && (
              <button
                onClick={onClearSeeds}
                title="Clear all seed tracks from your Library"
                className="p-1.5 rounded-xl bg-white/[0.04] hover:bg-rose-500/15 border border-white/[0.08] hover:border-rose-500/30 text-zinc-400 hover:text-rose-300 transition-colors cursor-pointer shrink-0"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}

            {hasBackend && (
              <button
                onClick={onSyncSafari}
                disabled={isSyncing}
                title="Re-scan open Safari YouTube tabs"
                className="hidden sm:flex px-2.5 py-1.5 rounded-xl bg-[#18181c] hover:bg-[#22222a] border border-[#2e2e36] text-xs text-[#e5e5e5] font-mono items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50 active:scale-[0.98] shrink-0"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-indigo-400 shrink-0 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>{isSyncing ? 'Syncing...' : 'Safari'}</span>
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filteredTracks.length === 0 ? (
            <div className="p-12 text-center text-xs text-[#a1a1aa] flex flex-col items-center justify-center">
              <div className="w-10 h-10 rounded-lg border border-[#2a2a32] bg-[#141418] flex items-center justify-center mb-3">
                <Music className="w-4 h-4 text-indigo-400" />
              </div>
              <p className="text-sm font-medium text-[#f5f5f5]">
                {extractedTracks.length === 0 ? 'Your Library starts fresh' : 'No matching tracks'}
              </p>
              <p className="text-xs text-[#9ca3af] mt-1 max-w-sm">
                {extractedTracks.length === 0
                  ? 'Use Direct Search (0 tokens) to find any song, artist, or YouTube playlist, and heart tracks to save them to your permanent favorites memory.'
                  : 'Try a different search filter.'}
              </p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/[0.06] text-[10px] font-mono uppercase tracking-wider text-[#9ca3af] bg-[#030305]/80 backdrop-blur-md sticky top-0 z-10">
                  <th className="py-2.5 pl-3.5 sm:pl-6 pr-2 w-8 sm:w-10">#</th>
                  <th className="py-2.5 px-2 sm:px-3">Track</th>
                  <th className="py-2.5 px-3 hidden md:table-cell">Channel / Artist</th>
                  <th className="py-2.5 px-2 sm:px-3 text-right pr-3.5 sm:pr-6">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04] text-xs">
                {filteredTracks.map((t, idx) => {
                  const thumb = t.thumbnail || (t.video_id ? `https://i.ytimg.com/vi/${t.video_id}/hqdefault.jpg` : '')
                  const isFav = isTrackFavorite ? isTrackFavorite(t) : false
                  return (
                    <tr
                      key={idx}
                      onClick={() => onPlayTrack(t, idx)}
                      className="group hover:bg-white/[0.04] transition-colors cursor-pointer fast-row"
                    >
                      <td className="py-2.5 pl-3.5 sm:pl-6 pr-2 font-mono text-xs text-[#9ca3af]">
                        {(idx + 1).toString().padStart(2, '0')}
                      </td>
                      <td className="py-2.5 px-2 sm:px-3 max-w-[210px] sm:max-w-md">
                        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                          <div className="w-9 h-9 rounded bg-[#18181e] border border-[#282830] overflow-hidden flex-shrink-0">
                            {thumb ? (
                              <img src={thumb} alt="" className="w-full h-full object-cover" loading="lazy" />
                            ) : (
                              <Music className="w-3.5 h-3.5 text-[#73737a] m-auto mt-2.5" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold text-[13px] text-[#f5f5f5] truncate">
                              {t.title}
                            </div>
                            <div className="text-[11px] text-[#a1a1aa] truncate md:hidden">
                              {t.artist}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-[#b4b4b8] truncate max-w-[200px] hidden md:table-cell">
                        {t.artist}
                      </td>
                      <td
                        className="py-2.5 pl-2 pr-3.5 sm:pr-6 text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-end gap-1.5">
                          <div className="relative">
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                setQueueMenuIdx(queueMenuIdx === `lib-${idx}` ? null : `lib-${idx}`)
                              }}
                              title="Queue options"
                              className={`p-1.5 rounded hover:bg-[#22222a] transition-colors cursor-pointer ${
                                queueMenuIdx === `lib-${idx}` ? 'text-sky-400 bg-sky-500/20' : 'text-[#8e8e93] hover:text-sky-300'
                              }`}
                            >
                              <ListPlus className="w-3.5 h-3.5" />
                            </button>
                            {queueMenuIdx === `lib-${idx}` && (
                              <div
                                onClick={(e) => e.stopPropagation()}
                                className="absolute right-0 bottom-full mb-1 w-36 py-1 bg-[#14141c] border border-[#262638] rounded-xl shadow-2xl z-40 text-xs font-medium text-left animate-in fade-in zoom-in-95 duration-100"
                              >
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    onPlayNext && onPlayNext(t)
                                    setQueueMenuIdx(null)
                                  }}
                                  className="w-full text-left px-3 py-1.5 hover:bg-[#1e1e2c] text-[#f4f4f5] flex items-center gap-2 cursor-pointer"
                                >
                                  <span className="text-sky-400 font-bold">⚡</span>
                                  <span>Play Next</span>
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    onAddToQueue && onAddToQueue(t)
                                    setQueueMenuIdx(null)
                                  }}
                                  className="w-full text-left px-3 py-1.5 hover:bg-[#1e1e2c] text-[#a1a1aa] hover:text-white flex items-center gap-2 cursor-pointer"
                                >
                                  <span className="text-emerald-400 font-bold">+</span>
                                  <span>Add to Queue</span>
                                </button>
                              </div>
                            )}
                          </div>
                          <button
                            onClick={() => onToggleFavorite && onToggleFavorite(t)}
                            title={isFav ? 'Saved in Favorites memory' : 'Save to Favorites memory'}
                            className={`p-1.5 rounded hover:bg-[#22222a] transition-colors cursor-pointer ${
                              isFav ? 'text-rose-400' : 'text-[#8e8e93] hover:text-rose-300'
                            }`}
                          >
                            <Heart className={`w-3.5 h-3.5 ${isFav ? 'fill-rose-500 text-rose-500' : ''}`} />
                          </button>
                          {onCurateSimilar && (
                            <button
                              onClick={() => onCurateSimilar(t)}
                              title="Curate a playlist around this song"
                              className="p-1.5 sm:px-2.5 sm:py-1 rounded bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/30 text-[11px] font-mono text-indigo-200 hover:text-white transition-colors cursor-pointer flex items-center gap-1 shrink-0"
                            >
                              <Sparkles className="w-3.5 h-3.5 text-indigo-300" />
                              <span className="hidden sm:inline">Curate Similar</span>
                            </button>
                          )}
                          <button
                            onClick={(e) => handleDownloadTrack(t, e)}
                            disabled={downloadingVid === t.video_id}
                            title={downloadingVid === t.video_id ? 'Downloading...' : (downloadedSet.has(t.video_id) || downloadedVid === t.video_id) ? 'Downloaded (Offline ready)' : 'Download Track'}
                            className={`p-1.5 rounded hover:bg-[#22222a] transition-colors cursor-pointer ${
                              (downloadedSet.has(t.video_id) || downloadedVid === t.video_id) ? 'text-emerald-400' : 'text-[#a1a1aa] hover:text-white'
                            }`}
                          >
                            {downloadingVid === t.video_id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                            ) : (downloadedSet.has(t.video_id) || downloadedVid === t.video_id) ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Download className="w-3.5 h-3.5" />
                            )}
                          </button>
                          {hasBackend && (
                            <button
                              onClick={() => onPushToSafari(t)}
                              title="Open in Safari"
                              className="hidden sm:inline-flex p-1.5 rounded hover:bg-[#22222a] text-[#a1a1aa] hover:text-white transition-colors cursor-pointer"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    )
  }

  // 3. MODERN INTERACTIVE SONIC TASTE STUDIO
  const allTracks = favorites.length > 0 ? favorites : extractedTracks
  const artists = Array.from(new Set(allTracks.map((t) => t.artist).filter(Boolean)))
  const topArtists = (tasteDna?.key_artists && tasteDna.key_artists.length)
    ? tasteDna.key_artists
    : (tasteDna?.top_artists && tasteDna.top_artists.length)
    ? tasteDna.top_artists
    : (artists.length ? artists.slice(0, 5) : [])

  const isHighEnergy = allTracks.some((t) => /rock|epic|metal|hyper|phonk|battle|dance/i.test(`${t.title} ${t.artist}`))
  const isMelancholic = allTracks.some((t) => /slow|acoustic|indie|lofi|rain|dark|ambient|chill/i.test(`${t.title} ${t.artist}`))

  const derivedArchetype = tasteDna?.archetype || (
    isHighEnergy ? 'High-Impact Sonic Voyager' :
    isMelancholic ? 'Atmospheric & Ethereal Connoisseur' :
    allTracks.length > 0 ? 'Melodic Audio Explorer' :
    (googleUser?.name ? `${googleUser.name}'s Sonic Canvas` : 'Uncharted Sonic Explorer')
  )

  const derivedSummary = tasteDna?.summary || (
    allTracks.length > 0
      ? `Your profile is driven by ${allTracks.length} tracks, blending ${topArtists.length ? topArtists.slice(0, 2).join(' and ') : 'diverse melodies'} with rich musical textures, dynamic rhythms, and personal listening habits.`
      : (googleUser?.name
          ? `Welcome ${googleUser.name}! Your unique taste profile will evolve dynamically with every song you listen to, search, or heart. Connect your seeds or explore music to build your mix.`
          : 'Your taste profile evolves dynamically with every song you listen to, heart, or search. Search for your favorite songs or connect Google to unlock personalized mixes.')
  )

  const tempoVal = tasteDna?.sonic_attributes?.tempo || (isHighEnergy ? '135-160 BPM' : '118-135 BPM')
  const electronicRatio = tasteDna?.sonic_attributes?.electronic_balance ?? (isHighEnergy ? 72 : 58)
  const acousticRatio = 100 - electronicRatio

  const rawGenres = (tasteDna?.primary_genres && tasteDna.primary_genres.length)
    ? tasteDna.primary_genres
    : (allTracks.length > 0
        ? (isHighEnergy
            ? ['Alternative Rock', 'Soundtrack', 'Electronic Melodic', 'Dynamic Beats']
            : ['Indie & Alternative', 'Melodic Pop', 'Atmospheric Ambient', 'Acoustic Harmonies'])
        : ['Global Pop & Hits', 'Indie & Alternative', 'Electronic & Chill', 'Acoustic Harmonies'])

  const genrePills = rawGenres.map((g, idx) => ({
    name: g,
    pct: [42, 28, 18, 12][idx] || 15
  }))

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-transparent gpu-scroll" onClick={() => setQueueMenuIdx(null)}>
      <div className="max-w-4xl mx-auto flex flex-col gap-5 sm:gap-6">
        {/* Main Archetype Hero Card */}
        <div className="relative overflow-hidden rounded-2xl border border-[#242432] bg-gradient-to-br from-[#12121a] via-[#0f0f15] to-[#0d0d12] p-5 sm:p-6 shadow-xl">
          <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-transparent rounded-full blur-3xl pointer-events-none" />

          {/* Top Bar with Badges and Sync Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono uppercase tracking-wider text-indigo-400 font-semibold px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/25 flex items-center gap-1.5">
                <Activity className="w-3 h-3 text-indigo-400" />
                <span>Sonic Taste DNA • Active</span>
              </span>

              {/* Animated Equalizer Visualizer */}
              <div className="flex items-end gap-0.5 h-3.5 px-2 py-0.5 rounded-md bg-[#161622] border border-[#262636]">
                <span className="w-0.5 bg-indigo-400 rounded-full animate-[bounce_0.9s_infinite_100ms] h-full" />
                <span className="w-0.5 bg-purple-400 rounded-full animate-[bounce_0.9s_infinite_300ms] h-2/3" />
                <span className="w-0.5 bg-sky-400 rounded-full animate-[bounce_0.9s_infinite_200ms] h-4/5" />
                <span className="w-0.5 bg-emerald-400 rounded-full animate-[bounce_0.9s_infinite_400ms] h-1/2" />
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setIsTasteSyncOpen(true)}
                className="px-3 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/35 text-xs text-rose-200 font-medium flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
              >
                <Youtube className="w-3.5 h-3.5 text-rose-400" />
                <span>Sync YouTube Seeds</span>
              </button>

              <button
                onClick={() => onAnalyzeTaste && onAnalyzeTaste()}
                disabled={isSyncing}
                title="Re-run deep musical taste analysis with Gemini"
                className="px-3 py-1.5 rounded-xl bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/35 text-xs text-indigo-200 font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Sparkles className={`w-3.5 h-3.5 text-indigo-400 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>Analyze DNA</span>
              </button>

              {onResetTasteDna && (tasteDna || allTracks.length > 0) && (
                <button
                  onClick={onResetTasteDna}
                  title="Reset Taste DNA profile"
                  className="px-2.5 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-zinc-400 hover:text-white text-xs font-mono transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Archetype Title & Summary */}
          <div className="max-w-2xl">
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
              <span className="bg-gradient-to-r from-white via-indigo-200 to-purple-300 bg-clip-text text-transparent">
                {googleUser?.name ? `${googleUser.name} • ${derivedArchetype}` : derivedArchetype}
              </span>
            </h2>
            <p className="text-xs sm:text-sm text-[#b4b4be] mt-2 leading-relaxed">
              {derivedSummary}
            </p>
          </div>

          {/* 1-Tap Curate from DNA Actions */}
          <div className="flex flex-wrap items-center gap-2.5 mt-5 pt-4 border-t border-[#1f1f2a]">
            {onCurateFromFavorites && (
              <button
                onClick={onCurateFromFavorites}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer shadow-md shadow-indigo-500/20 active:scale-98"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Curate My DNA Mix (0 AI Tokens)</span>
              </button>
            )}

            <button
              onClick={() => onCurateSimilar && favorites[0] && onCurateSimilar(favorites[0])}
              disabled={!favorites.length}
              className="px-3.5 py-2 rounded-xl bg-[#161622] hover:bg-[#1d1d2c] border border-[#28283a] text-xs text-[#e4e4e7] flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-40"
            >
              <Compass className="w-3.5 h-3.5 text-sky-400" />
              <span>Explore Acoustic Boundaries</span>
            </button>
          </div>
        </div>

        {/* Google & YouTube Sync Status Card */}
        <div className="p-4 sm:p-5 rounded-2xl bg-[#0f0f15] border border-[#22222e] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
              <GoogleIcon className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs sm:text-sm font-semibold text-white">
                  {googleUser ? `Connected: ${googleUser.name}` : 'Connect Google & YouTube Music'}
                </span>
                {googleUser && (
                  <span className="text-[9px] font-mono px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    ONLINE
                  </span>
                )}
              </div>
              <p className="text-[11px] text-[#8e8e96] truncate mt-0.5">
                {googleUser
                  ? `${googleUser.email} • YouTube likes & listening habits synced`
                  : 'Import your personal YouTube music likes, private mixes, and curated history'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {googleUser ? (
              <button
                onClick={onSyncYouTubeLikes}
                disabled={isSyncingLikes}
                className="px-3.5 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/35 text-xs text-rose-200 font-semibold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
              >
                {isSyncingLikes ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-400" />
                ) : (
                  <Youtube className="w-3.5 h-3.5 text-rose-400" />
                )}
                <span>Sync YouTube Likes</span>
              </button>
            ) : (
              <button
                onClick={onOpenGoogleModal}
                className="px-3.5 py-1.5 rounded-xl bg-white hover:bg-[#eaeaea] text-[#1f1f1f] text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer shadow-sm"
              >
                <GoogleIcon className="w-3.5 h-3.5" />
                <span>Sign in with Google</span>
              </button>
            )}
          </div>
        </div>

        {/* Sonic Attributes & Frequency Sliders */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Tile 1: Electronic vs Acoustic Balance */}
          <div className="p-4 sm:p-5 rounded-2xl bg-[#0e0e14] border border-[#20202c]">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="font-mono text-[#8e8e96] flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-indigo-400" />
                <span>Sonic Spectrum</span>
              </span>
              <span className="font-mono text-[11px] text-indigo-300 font-semibold">
                {electronicRatio}% Electronic • {acousticRatio}% Acoustic
              </span>
            </div>
            {/* Visual dual-gradient bar */}
            <div className="w-full h-2.5 rounded-full bg-[#181822] overflow-hidden flex">
              <div
                style={{ width: `${electronicRatio}%` }}
                className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-300"
              />
              <div
                style={{ width: `${acousticRatio}%` }}
                className="h-full bg-gradient-to-r from-amber-500 to-rose-500 transition-all duration-300"
              />
            </div>
            <div className="flex justify-between text-[10px] font-mono text-[#71717a] mt-1.5">
              <span>Synths & Production</span>
              <span>Organic & Strings</span>
            </div>
          </div>

          {/* Tile 2: Tempo & Energy Pulse */}
          <div className="p-4 sm:p-5 rounded-2xl bg-[#0e0e14] border border-[#20202c]">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="font-mono text-[#8e8e96] flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5 text-rose-400" />
                <span>Tempo & Energy Pulse</span>
              </span>
              <span className="font-mono text-[11px] text-rose-300 font-semibold">
                {tempoVal}
              </span>
            </div>
            {/* Visual progress bar */}
            <div className="w-full h-2.5 rounded-full bg-[#181822] overflow-hidden">
              <div
                style={{ width: `${isHighEnergy ? 84 : 64}%` }}
                className="h-full bg-gradient-to-r from-emerald-500 via-sky-400 to-rose-500 transition-all duration-300"
              />
            </div>
            <div className="flex justify-between text-[10px] font-mono text-[#71717a] mt-1.5">
              <span>Moderate Pace</span>
              <span>High BPM Climax</span>
            </div>
          </div>
        </div>

        {/* Genre Affinity Breakdown */}
        <div className="p-5 rounded-2xl bg-[#0e0e14] border border-[#20202c]">
          <div className="flex items-center justify-between mb-3.5">
            <span className="text-[11px] font-mono uppercase tracking-wider text-[#8e8e96] font-semibold flex items-center gap-1.5">
              <Disc className="w-3.5 h-3.5 text-sky-400" />
              <span>Genre Affinity & Tonal Distribution</span>
            </span>
            <span className="text-[10px] font-mono text-[#71717a]">
              {genrePills.length} Identified Styles
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {genrePills.map((g, idx) => (
              <div
                key={idx}
                className="p-3 rounded-xl bg-[#13131b] border border-[#222230] hover:border-sky-500/40 transition-colors"
              >
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="font-medium text-[#f4f4f5]">{g.name}</span>
                  <span className="font-mono text-[11px] text-sky-300">{g.pct}%</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-[#1a1a26] overflow-hidden">
                  <div
                    style={{ width: `${g.pct}%` }}
                    className="h-full bg-gradient-to-r from-sky-400 to-indigo-500"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Influences & Artists */}
        <div className="p-5 rounded-2xl bg-[#0e0e14] border border-[#20202c]">
          <span className="text-[11px] font-mono uppercase tracking-wider text-[#8e8e96] font-semibold block mb-3">
            Key Anchoring Artists & Sounds
          </span>
          <div className="flex flex-wrap gap-2">
            {topArtists.length > 0 ? (
              topArtists.map((a, idx) => (
                <div
                  key={idx}
                  onClick={() => onCurateSimilar && onCurateSimilar({ title: 'Mix', artist: a })}
                  className="px-3.5 py-1.5 rounded-xl bg-[#13131c] hover:bg-[#1a1a26] border border-[#242434] hover:border-indigo-500/40 text-xs font-mono text-[#e4e4e7] hover:text-white flex items-center gap-2 transition-colors cursor-pointer group"
                  title={`Curate mix inspired by ${a}`}
                >
                  <Music className="w-3 h-3 text-indigo-400 group-hover:scale-110 transition-transform" />
                  <span>{a}</span>
                  <span className="text-[9px] text-[#71717a] group-hover:text-sky-300 font-mono">Curate &rarr;</span>
                </div>
              ))
            ) : (
              <p className="text-xs text-zinc-500 font-mono">
                No anchoring artists yet. Heart songs or add seeds to populate your key artists.
              </p>
            )}
          </div>
        </div>

        {/* Top 4 Anchor Songs (The actual songs shaping this profile) */}
        {allTracks.length > 0 && (
          <div className="p-5 rounded-2xl bg-[#0e0e14] border border-[#20202c]">
            <div className="flex items-center justify-between mb-3.5">
              <span className="text-[11px] font-mono uppercase tracking-wider text-[#8e8e96] font-semibold flex items-center gap-1.5">
                <Heart className="w-3.5 h-3.5 text-rose-400" />
                <span>Core Tracks Anchoring Your Profile ({allTracks.length})</span>
              </span>
              <span className="text-[10px] font-mono text-[#71717a]">Highest Weight</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {allTracks.slice(0, 4).map((t, idx) => {
                const thumb = t.thumbnail || (t.video_id ? `https://i.ytimg.com/vi/${t.video_id}/hqdefault.jpg` : '')
                return (
                  <div
                    key={idx}
                    onClick={() => onPlayTrack(t, idx)}
                    className="p-2.5 rounded-xl bg-[#12121a] hover:bg-[#181824] border border-[#20202c] hover:border-[#2e2e42] flex items-center justify-between gap-3 transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-lg bg-[#181822] border border-[#242432] overflow-hidden shrink-0 relative">
                        {thumb ? (
                          <img src={thumb} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <Music className="w-4 h-4 text-[#71717a] m-auto mt-3" />
                        )}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                          <Play className="w-3.5 h-3.5 text-white fill-current ml-0.5" />
                        </div>
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-[#f4f4f5] truncate group-hover:text-sky-300">
                          {t.title}
                        </div>
                        <div className="text-[11px] text-[#8e8e96] truncate mt-0.5">
                          {t.artist}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                      {onCurateSimilar && (
                        <button
                          onClick={() => onCurateSimilar(t)}
                          title="Curate similar vibe"
                          className="p-1.5 rounded-lg text-[#71717a] hover:text-sky-300 hover:bg-[#1a1a28] transition-colors cursor-pointer"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Standalone YouTube Taste Sync Modal */}
      <YouTubeTasteSyncModal
        isOpen={isTasteSyncOpen}
        onClose={() => setIsTasteSyncOpen(false)}
        onAddSeedTrack={(track) => {
          onAddSeedTrack && onAddSeedTrack(track)
        }}
        onAddMultipleSeedTracks={(tracks) => {
          onAddMultipleSeedTracks && onAddMultipleSeedTracks(tracks)
        }}
        onAnalyzeTaste={() => {
          onAnalyzeTaste && onAnalyzeTaste()
        }}
        onSyncSafari={onSyncSafari}
        isSyncing={isSyncing}
        hasBackend={hasBackend}
        favoritesCount={favorites.length}
      />
    </div>
  )
}
