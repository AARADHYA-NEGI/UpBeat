import React, { useState, useEffect, useMemo } from 'react'
import {
  DownloadCloud, Play, Pause, Trash2, Search, HardDrive,
  WifiOff, Wifi, Sparkles, Heart, RefreshCw, FileAudio, Check, AlertCircle, Folder, ListPlus
} from 'lucide-react'
import {
  getOfflineTracks, deleteOfflineTrack, clearAllOfflineTracks,
  formatBytes, getOfflineStorageStats, isOfflineModeActive,
  setOfflineModeActive, subscribeOfflineChanges
} from '../offlineStorage'
import { getTrackDownloadUrl, hasBackend, getApiBase } from '../standaloneApi'

export default function OfflineView({
  currentTrack,
  isPlaying,
  onPlayTrack,
  onNavigateTab,
  onPlayNext,
  onAddToQueue
}) {
  const [tracks, setTracks] = useState([])
  const [stats, setStats] = useState({ count: 0, totalBytes: 0, formattedSize: '0 B' })
  const [searchQuery, setSearchQuery] = useState('')
  const [offlineMode, setOfflineMode] = useState(() => isOfflineModeActive())
  const [confirmClear, setConfirmClear] = useState(false)
  const [isDeletingId, setIsDeletingId] = useState(null)
  const [queueMenuIdx, setQueueMenuIdx] = useState(null)

  // Reload tracks and stats
  const reloadOfflineData = async () => {
    const list = await getOfflineTracks()
    const st = await getOfflineStorageStats()
    setTracks(list)
    setStats(st)
  }

  useEffect(() => {
    reloadOfflineData()
    const unsubscribe = subscribeOfflineChanges(() => {
      reloadOfflineData()
      setOfflineMode(isOfflineModeActive())
    })
    return () => unsubscribe()
  }, [])

  const handleToggleOfflineMode = () => {
    const next = !offlineMode
    setOfflineMode(next)
    setOfflineModeActive(next)
  }

  const handleDelete = async (videoId, e) => {
    if (e) e.stopPropagation()
    setIsDeletingId(videoId)
    try {
      await deleteOfflineTrack(videoId)
      await reloadOfflineData()
    } finally {
      setIsDeletingId(null)
    }
  }

  const handleClearAll = async () => {
    await clearAllOfflineTracks()
    setConfirmClear(false)
    await reloadOfflineData()
  }

  const handlePlayAll = () => {
    if (!filteredTracks.length) return
    onPlayTrack(filteredTracks[0], filteredTracks)
  }

  const handleShuffle = () => {
    if (!filteredTracks.length) return
    const shuffled = [...filteredTracks].sort(() => Math.random() - 0.5)
    onPlayTrack(shuffled[0], shuffled)
  }

  const handleReDownload = (track, e) => {
    if (e) e.stopPropagation()
    const url = getTrackDownloadUrl(track)
    if (!url) return
    const a = document.createElement('a')
    a.href = url
    a.download = `${track.artist || ''} - ${track.title || 'Track'}.m4a`
    a.target = '_blank'
    document.body.appendChild(a)
    a.click()
    setTimeout(() => {
      try { document.body.removeChild(a) } catch {}
    }, 1000)
  }

  const handleOpenDownloadsFolder = async () => {
    if (hasBackend()) {
      try {
        await fetch(`${getApiBase()}/open-downloads`, { method: 'POST' })
      } catch (err) {
        console.error('Failed to open downloads folder:', err)
      }
    }
  }

  const filteredTracks = useMemo(() => {
    if (!searchQuery.trim()) return tracks
    const q = searchQuery.toLowerCase().trim()
    return tracks.filter((t) =>
      (t.title && t.title.toLowerCase().includes(q)) ||
      (t.artist && t.artist.toLowerCase().includes(q)) ||
      (t.vibe && t.vibe.toLowerCase().includes(q))
    )
  }, [tracks, searchQuery])

  const formatDate = (timestamp) => {
    if (!timestamp) return 'Recent'
    const date = new Date(timestamp)
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric'
    })
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#0a0a0d] overflow-y-auto select-none">
      {/* Sticky Header */}
      <div className="p-4 sm:p-6 border-b border-[#1f1f26] bg-[#0d0d10]/95 backdrop-blur-md sticky top-0 z-20">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <DownloadCloud className="w-4 h-4" />
              </div>
              <h1 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                Offline Downloads
              </h1>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-[#181820] text-emerald-400 border border-emerald-500/20">
                {stats.count} {stats.count === 1 ? 'track' : 'tracks'}
              </span>
            </div>
            <p className="text-xs text-[#8e8e96] mt-1 flex items-center gap-2 font-mono">
              <HardDrive className="w-3.5 h-3.5 text-[#71717a]" />
              <span>{stats.formattedSize} stored locally</span>
            </p>
          </div>

          {/* Offline Mode Toggle & Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleToggleOfflineMode}
              title={offlineMode ? "Disable strict offline mode" : "Enable strict offline mode"}
              className={`px-3 py-1.5 rounded-lg border text-xs font-mono flex items-center gap-2 transition-all cursor-pointer ${
                offlineMode
                  ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300 shadow-[0_0_12px_rgba(52,211,153,0.25)]'
                  : 'bg-[#141418] border-[#25252e] text-[#a1a1aa] hover:text-white hover:border-[#353540]'
              }`}
            >
              {offlineMode ? (
                <>
                  <WifiOff className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="font-semibold">Offline Mode ON</span>
                </>
              ) : (
                <>
                  <Wifi className="w-3.5 h-3.5 text-[#71717a]" />
                  <span>Offline Mode OFF</span>
                </>
              )}
            </button>

            {hasBackend() && (
              <button
                onClick={handleOpenDownloadsFolder}
                className="px-3 py-1.5 rounded-lg bg-[#141418] hover:bg-[#1c1c24] border border-[#25252e] hover:border-[#353540] text-xs font-mono text-[#a1a1aa] hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Open UpBeat downloads folder in macOS Finder"
              >
                <Folder className="w-3.5 h-3.5 text-sky-400" />
                <span className="hidden sm:inline">Open in Finder</span>
                <span className="sm:hidden">Folder</span>
              </button>
            )}

            {tracks.length > 0 && (
              <>
                <button
                  onClick={handlePlayAll}
                  className="px-3.5 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-white text-xs font-mono font-medium flex items-center gap-1.5 transition-all shadow-md cursor-pointer active:scale-95"
                  title="Play all offline tracks"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Play All</span>
                </button>

                <button
                  onClick={handleShuffle}
                  className="px-3 py-1.5 rounded-lg bg-[#15151c] hover:bg-[#1f1f28] border border-[#262632] text-xs font-mono text-[#f4f4f5] flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Shuffle offline songs"
                >
                  <span>Shuffle</span>
                </button>

                {confirmClear ? (
                  <div className="flex items-center gap-1 bg-[#201014] border border-rose-500/40 rounded-lg p-0.5">
                    <button
                      onClick={handleClearAll}
                      className="px-2 py-1 text-[11px] font-mono text-rose-300 hover:text-rose-100 font-semibold cursor-pointer"
                    >
                      Confirm Clear
                    </button>
                    <button
                      onClick={() => setConfirmClear(false)}
                      className="px-2 py-1 text-[11px] font-mono text-[#a1a1aa] hover:text-white cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmClear(true)}
                    className="p-1.5 rounded-lg text-[#71717a] hover:text-rose-400 hover:bg-[#1a1418] border border-transparent hover:border-rose-500/20 transition-colors cursor-pointer"
                    title="Clear all offline storage"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Offline Mode Alert Banner */}
        {offlineMode && (
          <div className="mt-3.5 px-3 py-2 rounded-lg bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-xs font-mono flex items-center justify-between gap-2 shadow-inner">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>
                <strong>Offline Mode Active:</strong> Playback is strictly sourced from local device storage without network requests.
              </span>
            </div>
            <button
              onClick={handleToggleOfflineMode}
              className="text-[11px] text-emerald-400 hover:text-emerald-200 underline cursor-pointer shrink-0"
            >
              Turn Off
            </button>
          </div>
        )}

        {/* Search & Filter Bar */}
        {tracks.length > 0 && (
          <div className="mt-4 flex items-center gap-2">
            <div className="relative flex-1 max-w-md">
              <Search className="w-3.5 h-3.5 text-[#71717a] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search downloaded songs by title, artist..."
                className="w-full bg-[#131317] border border-[#22222c] focus:border-emerald-500/60 rounded-lg pl-9 pr-3 py-1.5 text-xs text-[#f4f4f5] placeholder-[#71717a] font-mono focus:outline-none transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[#71717a] hover:text-white"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Main Track List Content */}
      <div className="p-4 sm:p-6 flex-1 min-h-0">
        {tracks.length === 0 ? (
          /* Empty State */
          <div className="h-full min-h-[380px] flex flex-col items-center justify-center text-center p-6 border border-dashed border-[#202028] rounded-2xl bg-[#0d0d11]/40">
            <div className="w-16 h-16 rounded-2xl bg-[#14141c] border border-[#22222e] flex items-center justify-center text-[#71717a] mb-4 shadow-xl">
              <DownloadCloud className="w-8 h-8 text-emerald-400/80" />
            </div>
            <h3 className="text-base font-semibold text-white mb-1.5">
              No offline songs saved yet
            </h3>
            <p className="text-xs text-[#8e8e96] max-w-sm leading-relaxed mb-6">
              Download any track by tapping the download icon (<span className="text-white">⬇</span>) in Curator, Liked Songs, or PlayerBar. Downloaded audio is stored directly on your Mac or Android device for zero-buffering offline playback.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2.5">
              {onNavigateTab && (
                <>
                  <button
                    onClick={() => onNavigateTab('curator')}
                    className="px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-white text-xs font-mono font-medium flex items-center gap-2 transition-all cursor-pointer shadow-md"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Browse Curator</span>
                  </button>
                  <button
                    onClick={() => onNavigateTab('favorites')}
                    className="px-4 py-2 rounded-xl bg-[#15151c] hover:bg-[#1d1d26] border border-[#262632] text-xs font-mono text-[#f4f4f5] flex items-center gap-2 transition-colors cursor-pointer"
                  >
                    <Heart className="w-3.5 h-3.5 text-rose-400 fill-rose-400/30" />
                    <span>View Liked Songs</span>
                  </button>
                </>
              )}
            </div>
          </div>
        ) : filteredTracks.length === 0 ? (
          <div className="text-center py-12 text-[#71717a] text-xs font-mono">
            No downloaded songs match "{searchQuery}"
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-hidden rounded-xl border border-[#1f1f26] bg-[#0d0d11]">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#1f1f26] text-[11px] font-mono uppercase tracking-wider text-[#71717a] bg-[#121217]">
                    <th className="py-2.5 px-4 w-12 text-center">#</th>
                    <th className="py-2.5 px-4">Title & Artist</th>
                    <th className="py-2.5 px-4 w-24">Duration</th>
                    <th className="py-2.5 px-4 w-28">Storage Size</th>
                    <th className="py-2.5 px-4 w-28">Saved</th>
                    <th className="py-2.5 px-4 w-28 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#181820] text-xs font-mono">
                  {filteredTracks.map((t, idx) => {
                    const isCur = currentTrack && currentTrack.video_id === t.video_id
                    const isCurPlaying = isCur && isPlaying

                    return (
                      <tr
                        key={t.video_id || idx}
                        onClick={() => onPlayTrack(t, filteredTracks)}
                        className={`group hover:bg-[#15151d] transition-colors cursor-pointer ${
                          isCur ? 'bg-[#161622]' : ''
                        }`}
                      >
                        {/* Index / Play Status */}
                        <td className="py-2.5 px-4 text-center text-[#71717a]">
                          {isCurPlaying ? (
                            <div className="flex items-end justify-center gap-0.5 h-3.5 w-3.5 mx-auto">
                              <span className="w-1 bg-emerald-400 rounded-full animate-[bounce_0.8s_infinite_100ms] h-full" />
                              <span className="w-1 bg-emerald-400 rounded-full animate-[bounce_0.8s_infinite_300ms] h-2/3" />
                              <span className="w-1 bg-emerald-400 rounded-full animate-[bounce_0.8s_infinite_200ms] h-4/5" />
                            </div>
                          ) : (
                            <span className="group-hover:hidden">{idx + 1}</span>
                          )}
                          <Play className={`w-3.5 h-3.5 text-white fill-current mx-auto hidden ${!isCurPlaying ? 'group-hover:block' : ''}`} />
                        </td>

                        {/* Title & Artist & Artwork */}
                        <td className="py-2.5 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-md bg-[#181820] overflow-hidden shrink-0 border border-[#242430]">
                              {t.thumbnail ? (
                                <img
                                  src={t.thumbnail}
                                  alt=""
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-[#71717a]">
                                  <FileAudio className="w-4 h-4" />
                                </div>
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className={`font-medium truncate ${isCur ? 'text-emerald-400' : 'text-[#f4f4f5]'}`}>
                                {t.title}
                              </div>
                              <div className="text-[11px] text-[#8e8e96] truncate">
                                {t.artist}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Duration */}
                        <td className="py-2.5 px-4 text-[#a1a1aa]">
                          {t.duration_text || '--:--'}
                        </td>

                        {/* Size */}
                        <td className="py-2.5 px-4 text-emerald-400/90">
                          {formatBytes(t.size)}
                        </td>

                        {/* Date Added */}
                        <td className="py-2.5 px-4 text-[#71717a]">
                          {formatDate(t.downloadedAt)}
                        </td>

                        {/* Action Buttons */}
                        <td className="py-2.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5 opacity-90 group-hover:opacity-100">
                            <div className="relative">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setQueueMenuIdx(queueMenuIdx === `off-d-${idx}` ? null : `off-d-${idx}`)
                                }}
                                title="Queue options"
                                className={`p-1.5 rounded hover:bg-[#20202a] transition-colors cursor-pointer ${
                                  queueMenuIdx === `off-d-${idx}` ? 'text-sky-400 bg-sky-500/20' : 'text-[#8e8e96] hover:text-sky-300'
                                }`}
                              >
                                <ListPlus className="w-3.5 h-3.5" />
                              </button>
                              {queueMenuIdx === `off-d-${idx}` && (
                                <div className="absolute right-0 bottom-full mb-1 w-36 py-1 bg-[#14141c] border border-[#262638] rounded-xl shadow-2xl z-40 text-xs font-medium text-left animate-in fade-in zoom-in-95 duration-100">
                                  <button
                                    onClick={() => {
                                      onPlayNext && onPlayNext(t)
                                      setQueueMenuIdx(null)
                                    }}
                                    className="w-full text-left px-3 py-1.5 hover:bg-[#1e1e2c] text-[#f4f4f5] flex items-center gap-2 cursor-pointer"
                                  >
                                    <span className="text-sky-400 font-bold">⚡</span>
                                    <span>Play Next</span>
                                  </button>
                                  <button
                                    onClick={() => {
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
                              onClick={(e) => handleReDownload(t, e)}
                              title="Save copy to Downloads folder"
                              className="p-1.5 rounded hover:bg-[#20202a] text-[#8e8e96] hover:text-white transition-colors cursor-pointer"
                            >
                              <DownloadCloud className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={(e) => handleDelete(t.video_id, e)}
                              disabled={isDeletingId === t.video_id}
                              title="Delete from offline storage"
                              className="p-1.5 rounded hover:bg-rose-500/20 text-[#8e8e96] hover:text-rose-400 transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Touch Card List */}
            <div className="md:hidden flex flex-col gap-2">
              {filteredTracks.map((t, idx) => {
                const isCur = currentTrack && currentTrack.video_id === t.video_id
                const isCurPlaying = isCur && isPlaying

                return (
                  <div
                    key={t.video_id || idx}
                    onClick={() => onPlayTrack(t, filteredTracks)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                      isCur
                        ? 'bg-[#151522] border-emerald-500/40 shadow-sm'
                        : 'bg-[#0f0f13] border-[#1f1f26] hover:bg-[#14141a]'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="relative w-11 h-11 rounded-lg bg-[#181820] overflow-hidden shrink-0 border border-[#242430]">
                        {t.thumbnail ? (
                          <img
                            src={t.thumbnail}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[#71717a]">
                            <FileAudio className="w-5 h-5" />
                          </div>
                        )}
                        {isCurPlaying && (
                          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                          </div>
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className={`text-xs font-medium truncate ${isCur ? 'text-emerald-400 font-semibold' : 'text-[#f4f4f5]'}`}>
                          {t.title}
                        </div>
                        <div className="text-[11px] text-[#8e8e96] truncate mt-0.5">
                          {t.artist}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] font-mono text-[#71717a] mt-1">
                          <span>{t.duration_text || '--:--'}</span>
                          <span>•</span>
                          <span className="text-emerald-400/90">{formatBytes(t.size)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <div className="relative">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setQueueMenuIdx(queueMenuIdx === `off-m-${idx}` ? null : `off-m-${idx}`)
                          }}
                          className={`p-2 rounded-full cursor-pointer transition-colors ${
                            queueMenuIdx === `off-m-${idx}` ? 'text-sky-300 bg-sky-500/20' : 'text-[#8e8e96] hover:text-sky-300'
                          }`}
                          title="Queue options"
                        >
                          <ListPlus className="w-4 h-4" />
                        </button>
                        {queueMenuIdx === `off-m-${idx}` && (
                          <div className="absolute right-0 bottom-full mb-1 w-36 py-1 bg-[#14141c] border border-[#262638] rounded-xl shadow-2xl z-40 text-xs font-medium text-left animate-in fade-in zoom-in-95 duration-100">
                            <button
                              onClick={() => {
                                onPlayNext && onPlayNext(t)
                                setQueueMenuIdx(null)
                              }}
                              className="w-full text-left px-3 py-2 hover:bg-[#1e1e2c] text-[#f4f4f5] flex items-center gap-2 cursor-pointer"
                            >
                              <span className="text-sky-400 font-bold">⚡</span>
                              <span>Play Next</span>
                            </button>
                            <button
                              onClick={() => {
                                onAddToQueue && onAddToQueue(t)
                                setQueueMenuIdx(null)
                              }}
                              className="w-full text-left px-3 py-2 hover:bg-[#1e1e2c] text-[#a1a1aa] hover:text-white flex items-center gap-2 cursor-pointer"
                            >
                              <span className="text-emerald-400 font-bold">+</span>
                              <span>Add to Queue</span>
                            </button>
                          </div>
                        )}
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          onPlayTrack(t, filteredTracks)
                        }}
                        className={`p-2 rounded-full cursor-pointer ${
                          isCurPlaying
                            ? 'bg-emerald-500 text-black'
                            : 'bg-[#181822] text-[#f4f4f5] border border-[#262634]'
                        }`}
                      >
                        {isCurPlaying ? (
                          <Pause className="w-3.5 h-3.5 fill-current" />
                        ) : (
                          <Play className="w-3.5 h-3.5 fill-current" />
                        )}
                      </button>

                      <button
                        onClick={(e) => handleDelete(t.video_id, e)}
                        disabled={isDeletingId === t.video_id}
                        className="p-2 text-[#71717a] hover:text-rose-400 cursor-pointer"
                        title="Delete track"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
