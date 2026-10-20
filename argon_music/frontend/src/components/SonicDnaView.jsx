import React, { useState } from 'react'
import { RefreshCw, ExternalLink, Search, Music, Heart, Play, Sparkles } from 'lucide-react'

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
  onCurateSimilar
}) {
  const [filter, setFilter] = useState('')

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
      <div className="flex-1 flex flex-col min-h-0 bg-[#0a0a0c]">
        <div className="px-6 py-4 border-b border-[#222226] flex flex-wrap items-center justify-between gap-4 bg-[#0d0d0f]">
          <div>
            <div className="flex items-center gap-2">
              <Heart className="w-4 h-4 fill-rose-500 text-rose-500" />
              <h2 className="text-sm font-semibold text-[#f5f5f5]">
                Saved Favorites Memory ({favorites.length})
              </h2>
            </div>
            <p className="text-xs text-[#a1a1aa] mt-0.5">
              Persisted to disk • Used as your highest-priority taste signal during AI playlist curation
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            {favorites.length > 0 && (
              <>
                <div className="flex items-center bg-[#141418] border border-[#282830] rounded-md px-2.5 py-1">
                  <Search className="w-3.5 h-3.5 text-[#8e8e93] mr-2" />
                  <input
                    type="text"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    placeholder="Filter favorites..."
                    className="bg-transparent text-xs text-[#f5f5f5] placeholder:text-[#73737a] focus:outline-none w-36 sm:w-44"
                  />
                </div>

                <button
                  onClick={() => onPlayTrack(favorites[0], 0)}
                  title="Play your saved favorites"
                  className="px-3 py-1.5 rounded-md bg-[#16161c] hover:bg-[#22222a] border border-[#2e2e38] text-xs text-[#f5f5f5] flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5 fill-current text-indigo-400" />
                  <span>Play Favorites</span>
                </button>

                {onCurateFromFavorites && (
                  <button
                    onClick={onCurateFromFavorites}
                    title="Generate a fresh playlist inspired by your hearted songs"
                    className="px-3.5 py-1.5 rounded-md bg-indigo-600 hover:bg-indigo-500 text-xs font-medium text-white flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Curate from Favorites</span>
                  </button>
                )}
              </>
            )}
          </div>
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
                <tr className="border-b border-[#1f1f24] text-[10px] font-mono uppercase tracking-wider text-[#9ca3af] bg-[#0c0c0f] sticky top-0 z-10">
                  <th className="py-2.5 pl-6 pr-2 w-10">#</th>
                  <th className="py-2.5 px-3">Title</th>
                  <th className="py-2.5 px-3">Artist</th>
                  <th className="py-2.5 px-3 hidden sm:table-cell">Style</th>
                  <th className="py-2.5 px-3 text-right pr-6">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#18181d] text-xs">
                {filteredFavs.map((t, idx) => {
                  const thumb = t.thumbnail || (t.video_id ? `https://i.ytimg.com/vi/${t.video_id}/hqdefault.jpg` : '')
                  return (
                    <tr
                      key={idx}
                      onClick={() => onPlayTrack(t, idx)}
                      className="group hover:bg-[#131318] transition-colors cursor-pointer"
                    >
                      <td className="py-2.5 pl-6 pr-2 font-mono text-xs text-[#9ca3af]">
                        {(idx + 1).toString().padStart(2, '0')}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded bg-[#18181e] border border-[#282830] overflow-hidden flex-shrink-0">
                            {thumb ? (
                              <img src={thumb} alt="" className="w-full h-full object-cover" loading="lazy" />
                            ) : (
                              <Music className="w-3.5 h-3.5 text-[#73737a] m-auto mt-2.5" />
                            )}
                          </div>
                          <span className="font-semibold text-[13px] text-[#f5f5f5] truncate max-w-md">
                            {t.title}
                          </span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-[#b4b4b8] truncate max-w-[200px]">
                        {t.artist}
                      </td>
                      <td className="py-2.5 px-3 hidden sm:table-cell">
                        <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-[#16161c] text-[#b4b4b8] border border-[#282832]">
                          {t.vibe || 'Favorite'}
                        </span>
                      </td>
                      <td
                        className="py-2.5 pl-3 pr-6 text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-end gap-1.5">
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
                              className="px-2.5 py-1 rounded bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/30 text-[11px] font-mono text-indigo-200 hover:text-white transition-colors cursor-pointer"
                            >
                              Curate Similar
                            </button>
                          )}
                          <button
                            onClick={() => onPushToSafari(t)}
                            title="Open in Safari"
                            className="p-1.5 rounded hover:bg-[#22222a] text-[#a1a1aa] hover:text-white transition-colors cursor-pointer"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </button>
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

  // 2. SAFARI LIBRARY VIEW
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
      <div className="flex-1 flex flex-col min-h-0 bg-[#0a0a0c]">
        <div className="px-6 py-4 border-b border-[#222226] flex flex-wrap items-center justify-between gap-4 bg-[#0d0d0f]">
          <div>
            <h2 className="text-sm font-semibold text-[#f5f5f5]">
              Safari YouTube Library ({extractedTracks.length})
            </h2>
            <p className="text-xs text-[#a1a1aa]">
              Extracted directly from active YouTube & YouTube Music tabs in Safari
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center bg-[#141418] border border-[#282830] rounded-md px-2.5 py-1">
              <Search className="w-3.5 h-3.5 text-[#8e8e93] mr-2" />
              <input
                type="text"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Filter tracks..."
                className="bg-transparent text-xs text-[#f5f5f5] placeholder:text-[#73737a] focus:outline-none w-44"
              />
            </div>

            <button
              onClick={onSyncSafari}
              disabled={isSyncing}
              title="Re-scan open Safari YouTube tabs"
              className="px-3 py-1.5 rounded-md bg-[#18181c] hover:bg-[#22222a] border border-[#2e2e36] text-xs text-[#e5e5e5] flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-indigo-400 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filteredTracks.length === 0 ? (
            <div className="p-12 text-center text-xs text-[#a1a1aa]">
              No matching tracks in library. Open YouTube Liked Videos or History in Safari and click Sync Safari.
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#1f1f24] text-[10px] font-mono uppercase tracking-wider text-[#9ca3af] bg-[#0c0c0f] sticky top-0 z-10">
                  <th className="py-2.5 pl-6 pr-2 w-10">#</th>
                  <th className="py-2.5 px-3">Title</th>
                  <th className="py-2.5 px-3">Channel / Artist</th>
                  <th className="py-2.5 px-3 text-right pr-6">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#18181d] text-xs">
                {filteredTracks.map((t, idx) => {
                  const thumb = t.thumbnail || (t.video_id ? `https://i.ytimg.com/vi/${t.video_id}/hqdefault.jpg` : '')
                  const isFav = isTrackFavorite ? isTrackFavorite(t) : false
                  return (
                    <tr
                      key={idx}
                      onClick={() => onPlayTrack(t, idx)}
                      className="group hover:bg-[#131318] transition-colors cursor-pointer"
                    >
                      <td className="py-2.5 pl-6 pr-2 font-mono text-xs text-[#9ca3af]">
                        {(idx + 1).toString().padStart(2, '0')}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded bg-[#18181e] border border-[#282830] overflow-hidden flex-shrink-0">
                            {thumb ? (
                              <img src={thumb} alt="" className="w-full h-full object-cover" loading="lazy" />
                            ) : (
                              <Music className="w-3.5 h-3.5 text-[#73737a] m-auto mt-2.5" />
                            )}
                          </div>
                          <span className="font-semibold text-[13px] text-[#f5f5f5] truncate max-w-md">
                            {t.title}
                          </span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-[#b4b4b8] truncate max-w-[200px]">
                        {t.artist}
                      </td>
                      <td
                        className="py-2.5 pl-3 pr-6 text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-end gap-1.5">
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
                              className="px-2.5 py-1 rounded bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/30 text-[11px] font-mono text-indigo-200 hover:text-white transition-colors cursor-pointer"
                            >
                              Curate Similar
                            </button>
                          )}
                          <button
                            onClick={() => onPushToSafari(t)}
                            title="Open in Safari"
                            className="p-1.5 rounded hover:bg-[#22222a] text-[#a1a1aa] hover:text-white transition-colors cursor-pointer"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </button>
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

  // 3. TASTE PROFILE VIEW
  return (
    <div className="flex-1 overflow-y-auto p-6 bg-[#0a0a0c]">
      <div className="max-w-4xl flex flex-col gap-6">
        <div className="border border-[#222228] bg-[#0d0d10] rounded-lg p-6">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-mono uppercase tracking-wider text-indigo-400 font-medium">
              Taste Profile Analysis
            </span>
            <button
              onClick={onSyncSafari}
              disabled={isSyncing}
              className="px-3 py-1 rounded-md bg-[#16161c] hover:bg-[#22222a] border border-[#2a2a34] text-xs text-[#e5e5e5] flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-indigo-400 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>Re-analyze from Safari</span>
            </button>
          </div>

          <h2 className="text-xl font-semibold text-[#f5f5f5] tracking-tight">
            {tasteDna?.archetype || 'Listener Profile'}
          </h2>
          <p className="text-xs sm:text-sm text-[#c4c4cc] mt-2 leading-relaxed max-w-2xl">
            {tasteDna?.summary || 'Connect Safari to analyze listening habits.'}
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
            <div className="p-3.5 rounded-md bg-[#131318] border border-[#22222a]">
              <span className="text-[10px] font-mono uppercase text-[#9ca3af] block">Tempo Range</span>
              <span className="text-sm font-mono font-semibold text-[#f5f5f5] mt-1 block">
                {tasteDna?.sonic_attributes?.tempo || '120-130 BPM'}
              </span>
            </div>
            <div className="p-3.5 rounded-md bg-[#131318] border border-[#22222a]">
              <span className="text-[10px] font-mono uppercase text-[#9ca3af] block">Electronic Ratio</span>
              <span className="text-sm font-mono font-semibold text-indigo-300 mt-1 block">
                {tasteDna?.sonic_attributes?.electronic_balance ?? 70}%
              </span>
            </div>
            <div className="p-3.5 rounded-md bg-[#131318] border border-[#22222a]">
              <span className="text-[10px] font-mono uppercase text-[#9ca3af] block">Hearted Memory</span>
              <span className="text-sm font-mono font-semibold text-rose-300 mt-1 block">
                {favorites.length} liked
              </span>
            </div>
            <div className="p-3.5 rounded-md bg-[#131318] border border-[#22222a]">
              <span className="text-[10px] font-mono uppercase text-[#9ca3af] block">Safari Seeds</span>
              <span className="text-sm font-mono font-semibold text-[#f5f5f5] mt-1 block">
                {extractedTracks.length} items
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="border border-[#222228] bg-[#0d0d10] rounded-lg p-5">
            <span className="text-[11px] font-mono uppercase tracking-wider text-[#9ca3af] font-medium block mb-3">
              Primary Genres
            </span>
            <div className="flex flex-wrap gap-2">
              {(tasteDna?.primary_genres || ['Soundtrack', 'Electronic', 'Alternative']).map((g, i) => (
                <span
                  key={i}
                  className="px-3 py-1 rounded-md bg-indigo-500/10 border border-indigo-500/30 text-xs font-mono text-indigo-200"
                >
                  {g}
                </span>
              ))}
            </div>
          </div>

          <div className="border border-[#222228] bg-[#0d0d10] rounded-lg p-5">
            <span className="text-[11px] font-mono uppercase tracking-wider text-[#9ca3af] font-medium block mb-3">
              Key Artists & Channels
            </span>
            <div className="flex flex-wrap gap-2">
              {(tasteDna?.top_artists || []).map((a, i) => (
                <span
                  key={i}
                  className="px-3 py-1 rounded-md bg-[#14141a] border border-[#282832] text-xs font-mono text-[#e4e4e7]"
                >
                  {a}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
