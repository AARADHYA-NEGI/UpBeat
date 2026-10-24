import React, { useState } from 'react'
import {
  X, Search, Link2, Sparkles, Plus, Check, Loader2, Music, RefreshCw, Heart
} from 'lucide-react'
import { searchYouTubeMusicList, importYouTubePlaylistStandalone } from '../standaloneApi'

export function Youtube({ className = 'w-4 h-4' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  )
}

export default function YouTubeTasteSyncModal({
  isOpen,
  onClose,
  onAddSeedTrack,
  onAddMultipleSeedTracks,
  onAnalyzeTaste,
  onSyncSafari,
  isSyncing,
  hasBackend,
  favoritesCount = 0
}) {
  const [activeTab, setActiveTab] = useState('search') // 'search' | 'url' | 'liked'
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [isSearching, setIsSearching] = useState(false)
  const [addedIds, setAddedIds] = useState(new Set())

  const [playlistUrl, setPlaylistUrl] = useState('')
  const [isImporting, setIsImporting] = useState(false)

  if (!isOpen) return null

  const handleSearchSubmit = async (e) => {
    if (e) e.preventDefault()
    if (!searchQuery.trim() || isSearching) return
    setIsSearching(true)
    try {
      const results = await searchYouTubeMusicList(searchQuery.trim())
      setSearchResults(results)
    } finally {
      setIsSearching(false)
    }
  }

  const handleAddTrack = (track) => {
    if (!track) return
    onAddSeedTrack(track)
    setAddedIds((prev) => new Set([...prev, track.video_id]))
  }

  const handleImportPlaylist = async (e) => {
    if (e) e.preventDefault()
    if (!playlistUrl.trim() || isImporting) return
    setIsImporting(true)
    try {
      const tracks = await importYouTubePlaylistStandalone(playlistUrl.trim())
      if (tracks && tracks.length) {
        onAddMultipleSeedTracks(tracks)
        setPlaylistUrl('')
        onClose()
      }
    } finally {
      setIsImporting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 select-none">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/75 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-lg bg-[#0e0e13] border border-[#242430] rounded-2xl shadow-2xl flex flex-col max-h-[85vh] z-10 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#20202a] flex items-center justify-between bg-[#131319]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500">
              <Youtube className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">
                Sync YouTube Taste & Seeds
              </h3>
              <p className="text-[11px] text-[#8e8e96] font-mono">
                Curate your Taste Profile on Android & Mac
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#71717a] hover:text-white hover:bg-[#1c1c24] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center border-b border-[#1f1f28] bg-[#0c0c10] px-3 sm:px-4 text-xs font-mono">
          <button
            onClick={() => setActiveTab('search')}
            className={`py-2.5 px-3 border-b-2 font-medium transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'search'
                ? 'border-rose-500 text-white'
                : 'border-transparent text-[#71717a] hover:text-[#a1a1aa]'
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            <span>Search YouTube</span>
          </button>

          <button
            onClick={() => setActiveTab('url')}
            className={`py-2.5 px-3 border-b-2 font-medium transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'url'
                ? 'border-rose-500 text-white'
                : 'border-transparent text-[#71717a] hover:text-[#a1a1aa]'
            }`}
          >
            <Link2 className="w-3.5 h-3.5" />
            <span>Import Playlist URL</span>
          </button>

          <button
            onClick={() => setActiveTab('liked')}
            className={`py-2.5 px-3 border-b-2 font-medium transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'liked'
                ? 'border-rose-500 text-white'
                : 'border-transparent text-[#71717a] hover:text-[#a1a1aa]'
            }`}
          >
            <Heart className="w-3.5 h-3.5" />
            <span>Liked Songs ({favoritesCount})</span>
          </button>
        </div>

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          {activeTab === 'search' && (
            <div className="space-y-4">
              <form onSubmit={handleSearchSubmit} className="relative">
                <Search className="w-4 h-4 text-[#71717a] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Look up favorite artists, songs, anime OSTs..."
                  className="w-full bg-[#14141a] border border-[#242432] focus:border-rose-500/60 rounded-xl pl-9 pr-20 py-2.5 text-xs text-white placeholder-[#71717a] font-mono focus:outline-none transition-colors"
                />
                <button
                  type="submit"
                  disabled={isSearching || !searchQuery.trim()}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-mono font-medium disabled:opacity-40 transition-colors cursor-pointer"
                >
                  {isSearching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Search'}
                </button>
              </form>

              {searchResults.length === 0 ? (
                <div className="py-8 text-center text-xs text-[#71717a] font-mono border border-dashed border-[#1f1f28] rounded-xl p-4">
                  <p>Search YouTube to find tracks you love.</p>
                  <p className="mt-1 text-[11px] text-[#52525b]">
                    Tap "+" next to any song to add it as a seed for your Taste Profile.
                  </p>
                </div>
              ) : (
                <div className="space-y-1.5 max-h-72 overflow-y-auto">
                  {searchResults.map((t) => {
                    const isAdded = addedIds.has(t.video_id)
                    return (
                      <div
                        key={t.video_id}
                        className="p-2 rounded-lg bg-[#121218] hover:bg-[#181822] border border-[#1f1f2a] flex items-center justify-between gap-3 transition-colors"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-9 h-9 rounded-md bg-[#181822] overflow-hidden shrink-0 border border-[#282834]">
                            {t.thumbnail ? (
                              <img src={t.thumbnail} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <Music className="w-3.5 h-3.5 text-[#71717a] m-auto mt-2.5" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-medium text-white truncate">{t.title}</div>
                            <div className="text-[11px] text-[#8e8e96] truncate">{t.artist}</div>
                          </div>
                        </div>

                        <button
                          onClick={() => handleAddTrack(t)}
                          disabled={isAdded}
                          className={`p-1.5 rounded-lg flex items-center gap-1 text-[11px] font-mono transition-all cursor-pointer ${
                            isAdded
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                              : 'bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30'
                          }`}
                        >
                          {isAdded ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                              <span className="hidden sm:inline">Added</span>
                            </>
                          ) : (
                            <>
                              <Plus className="w-3.5 h-3.5 text-rose-400" />
                              <span className="hidden sm:inline">Add Seed</span>
                            </>
                          )}
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === 'url' && (
            <form onSubmit={handleImportPlaylist} className="space-y-4">
              <div>
                <label className="block text-[11px] font-mono uppercase tracking-wider text-[#a1a1aa] mb-2">
                  Paste YouTube or YouTube Music Link
                </label>
                <input
                  type="text"
                  value={playlistUrl}
                  onChange={(e) => setPlaylistUrl(e.target.value)}
                  placeholder="https://music.youtube.com/playlist?list=... or video URL"
                  className="w-full bg-[#14141a] border border-[#242432] focus:border-rose-500/60 rounded-xl px-3 py-2.5 text-xs text-white placeholder-[#71717a] font-mono focus:outline-none transition-colors"
                />
              </div>

              <button
                type="submit"
                disabled={isImporting || !playlistUrl.trim()}
                className="w-full py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 active:scale-98 text-xs font-mono font-medium text-white flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer disabled:opacity-40"
              >
                {isImporting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Extracting Tracks from YouTube...</span>
                  </>
                ) : (
                  <>
                    <Link2 className="w-3.5 h-3.5" />
                    <span>Import Playlist Seeds</span>
                  </>
                )}
              </button>
            </form>
          )}

          {activeTab === 'liked' && (
            <div className="space-y-4 text-center py-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500 mx-auto mb-2">
                <Heart className="w-6 h-6 fill-rose-500/30" />
              </div>
              <h4 className="text-sm font-semibold text-white">
                Generate Profile from {favoritesCount} Liked Songs
              </h4>
              <p className="text-xs text-[#8e8e96] max-w-sm mx-auto leading-relaxed">
                UpBeat will analyze all your hearted songs on this device and build your tailored Sonic Taste DNA profile with genres, BPM, and archetypes.
              </p>

              <button
                onClick={async () => {
                  await onAnalyzeTaste()
                  onClose()
                }}
                disabled={favoritesCount === 0 || isSyncing}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-indigo-600 hover:from-rose-500 hover:to-indigo-500 text-white text-xs font-mono font-medium inline-flex items-center gap-2 shadow-lg transition-all cursor-pointer disabled:opacity-40"
              >
                {isSyncing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                <span>Re-analyze My Taste Profile</span>
              </button>
            </div>
          )}
        </div>

        {/* Footer: Safari fallback on Mac */}
        {hasBackend && onSyncSafari && (
          <div className="p-3 bg-[#0a0a0e] border-t border-[#1a1a24] flex items-center justify-between text-[11px] font-mono text-[#71717a]">
            <span>On macOS? You can also extract open Safari tabs.</span>
            <button
              onClick={() => {
                onSyncSafari()
                onClose()
              }}
              disabled={isSyncing}
              className="text-indigo-400 hover:text-indigo-300 underline cursor-pointer"
            >
              Sync Safari Tabs
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
