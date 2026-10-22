import React, { useState } from 'react'
import {
  Play, Pause, ExternalLink, Loader2, Music,
  ChevronDown, ChevronUp, Heart, Info, KeyRound, ListMusic, Disc, Sparkles
} from 'lucide-react'

function cleanMusicalRationale(text) {
  if (!text) return 'Selected for its harmonic and rhythmic alignment.'
  let s = text.split(/(?<=[.!?])\s+/)[0] || text
  s = s
    .replace(/,?\s*appealing to the user'?s? (broader )?(interest|taste|history|appreciation)[^.]*/i, '')
    .replace(/,?\s*(which )?(aligns|fitting|matching|connecting|echoing) (with )?the user'?s? [^.]*/i, '')
    .replace(/^This (iconic |classic )?track /i, '')
  if (s.length > 0) {
    s = s.charAt(0).toUpperCase() + s.slice(1)
    if (!/[.!?]$/.test(s)) s += '.'
  }
  return s
}

function extraDetail(track) {
  if (track.detail) return track.detail
  if (!track.reason) return ''
  const parts = track.reason.split(/(?<=[.!?])\s+/)
  return parts.length > 1 ? parts.slice(1).join(' ') : ''
}

function getTierBadgeStyle(tier) {
  if (tier === 'Close Fit') {
    return 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
  }
  if (tier === 'Exploratory') {
    return 'bg-amber-500/10 text-amber-300 border-amber-500/30'
  }
  return 'bg-sky-500/15 text-sky-300 border-sky-500/35'
}

export default function PlaylistView({
  playlist,
  currentTrack,
  isPlaying,
  selectedModel,
  isResolvingBatch,
  isTrackFavorite,
  onToggleFavorite,
  onPlayTrack,
  onPushToSafari,
  isGenerating,
  isSearching,
  isLoadingPlaylistBrowse,
  onSelectMatchedPlaylist,
  onSelectYoutubeResults,
  onSelectDirectSongs,
  onGenerateDefault,
  onSelectStarter,
  needsSetup,
  onOpenSettings
}) {
  const [expandedIdx, setExpandedIdx] = useState(null)
  const [showModelDetails, setShowModelDetails] = useState(false)

  if (isGenerating || isSearching) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 sm:p-12 text-center select-none bg-[#0a0a0d]">
        <div className="w-12 h-12 rounded-2xl bg-[#131318] border border-[#24242e] flex items-center justify-center mb-4 shadow-lg">
          <Loader2 className={`w-5 h-5 animate-spin ${isSearching ? 'text-sky-400' : 'text-indigo-400'}`} />
        </div>
        <p className="text-sm font-semibold text-[#f4f4f5]">
          {isSearching
            ? 'Searching YouTube & YT Music...'
            : 'Curating playlist & resolving streams...'}
        </p>
        <p className="text-xs font-mono text-[#8e8e96] mt-1.5">
          {isSearching ? 'Direct Stream Match • 0 AI Tokens' : `Model Engine: ${selectedModel}`}
        </p>
      </div>
    )
  }

  if (!playlist || !playlist.tracks || playlist.tracks.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 sm:p-12 text-center select-none bg-[#0a0a0d]">
        <div className="w-12 h-12 rounded-2xl border border-[#22222a] bg-[#121217] flex items-center justify-center mb-4 shadow-lg shadow-black/40">
          <Music className="w-5 h-5 text-sky-400" />
        </div>
        <p className="text-sm font-semibold text-[#f4f4f5]">
          Ready to search or curate
        </p>
        <p className="text-xs text-[#8e8e96] mt-1 max-w-sm">
          Search any song, artist, or YouTube playlist (0 tokens), or tap a starter genre below.
        </p>

        {onSelectStarter && (
          <div className="flex flex-wrap items-center justify-center gap-2 mt-5 max-w-lg">
            {[
              { label: 'Trending Hits', query: 'Trending music hits 2025' },
              { label: 'Lofi & Chill', query: 'Lofi hip hop beats to relax' },
              { label: 'New Hindi Songs', query: 'New Hindi Songs' },
              { label: 'Hip-Hop / Rap', query: 'Hip-Hop and Rap hits' },
              { label: 'Gym Motivation', query: 'Gym workout motivation music' },
              { label: 'Anime Vibes', query: 'Anime opening songs best' }
            ].map((s) => (
              <button
                key={s.label}
                onClick={() => onSelectStarter(s.query)}
                className="px-3 py-1.5 rounded-full bg-[#121217] hover:bg-[#1a1a22] border border-[#22222a] hover:border-[#2e2e38] text-[11px] font-medium text-[#d4d4dc] hover:text-white transition-all cursor-pointer shadow-xs"
              >
                {s.label}
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2.5 mt-5">
          {needsSetup && onOpenSettings && (
            <button
              onClick={onOpenSettings}
              className="px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-medium text-white flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>Set Gemini API Key</span>
            </button>
          )}
          {onGenerateDefault && (
            <button
              onClick={onGenerateDefault}
              className="px-3.5 py-2 rounded-lg bg-[#14141a] hover:bg-[#1c1c24] border border-[#262632] hover:border-[#32323e] text-xs font-medium text-[#f4f4f5] transition-colors cursor-pointer shadow-xs"
            >
              Curate Default Mix
            </button>
          )}
        </div>
      </div>
    )
  }

  const tracks = playlist.tracks || []
  const isDirectSearch = Boolean(playlist.is_direct_search)
  const matchedPlaylists = playlist.matched_playlists || []
  const youtubeResults = playlist.youtube_results || []
  const songResults = playlist.song_results || []
  const activeSource = playlist.active_source || (youtubeResults.length > 0 ? 'youtube' : 'songs')
  const activeBrowseId = playlist.active_browse_id || ''

  const usedModel = playlist.used_model || selectedModel
  const reqModel = playlist.requested_model || selectedModel
  const didFallback = !isDirectSearch && (Boolean(playlist.is_fallback) || usedModel !== reqModel)
  const fallbackReason =
    playlist.fallback_reason ||
    (didFallback ? `High demand (HTTP 503) or rate limit on ${reqModel}` : '')
  const latencySec = playlist.latency_ms ? `${(playlist.latency_ms / 1000).toFixed(1)}s` : ''

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#0a0a0d]">
      {/* Mobile / First-run API Setup Banner */}
      {needsSetup && onOpenSettings && (
        <div className="px-3.5 py-2 bg-indigo-500/10 border-b border-indigo-500/25 flex items-center justify-between gap-2">
          <span className="text-[11px] text-indigo-200 leading-snug">
            Direct Search works with 0 setup. Add a Gemini API Key only if you want custom AI curation.
          </span>
          <button
            onClick={onOpenSettings}
            className="px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-medium flex items-center gap-1 flex-shrink-0 cursor-pointer"
          >
            <KeyRound className="w-3 h-3" />
            <span>Configure</span>
          </button>
        </div>
      )}

      {/* Antigravity Session Diff Header */}
      <div className="px-3.5 py-3 sm:px-6 sm:py-3.5 border-b border-[#1c1c22] flex flex-col gap-1.5 bg-[#0d0d11] flex-shrink-0 select-none">
        <div className="flex items-start sm:items-center justify-between gap-2.5">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm sm:text-base font-semibold text-[#f4f4f5] tracking-tight truncate">
                {playlist.playlist_title || 'Curated Selection'}
              </h2>

              {isDirectSearch ? (
                <span className="flex items-center gap-1.5 text-[10px] sm:text-[11px] font-mono px-2 py-0.5 rounded-full border bg-sky-500/10 text-sky-200 border-sky-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
                  <span>DIRECT • 0 TOKENS</span>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowModelDetails((prev) => !prev)}
                  className={`flex items-center gap-1.5 text-[10px] sm:text-[11px] font-mono px-2 py-0.5 rounded-full border transition-colors cursor-pointer ${
                    didFallback
                      ? 'bg-amber-500/10 text-amber-200 border-amber-500/30'
                      : 'bg-indigo-500/10 text-indigo-200 border-indigo-500/25'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${didFallback ? 'bg-amber-400' : 'bg-indigo-400'}`} />
                  <span className="truncate max-w-[160px] sm:max-w-none">
                    {didFallback ? `${usedModel} (Fallback)` : `${usedModel}${latencySec ? ` · ${latencySec}` : ''}`}
                  </span>
                  <Info className="w-3 h-3 opacity-70" />
                </button>
              )}
            </div>

            <p className="text-[11px] text-[#8e8e96] mt-0.5 line-clamp-1 max-w-2xl font-mono">
              {playlist.subtitle || playlist.vibe_description}
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-shrink-0">
            <span className="text-[11px] font-mono text-[#71717a] hidden sm:inline">
              {tracks.length} tracks
            </span>
            <button
              onClick={() => onPlayTrack(tracks[0], 0)}
              className="px-3 py-1.5 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/40 text-sky-200 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs active:scale-95"
            >
              <Play className="w-3.5 h-3.5 fill-current text-sky-400" />
              <span>Play All</span>
            </button>
          </div>
        </div>

        {/* Direct Search: YouTube Results (Red), YT Music Songs (Purple) & Playlists (Emerald) Switcher Strip */}
        {isDirectSearch && (youtubeResults.length > 0 || songResults.length > 0 || matchedPlaylists.length > 0) && (
          <div className="flex items-center gap-1.5 mt-1.5 overflow-x-auto no-scrollbar pb-0.5">
            {youtubeResults.length > 0 && (
              <button
                type="button"
                onClick={() => onSelectYoutubeResults && onSelectYoutubeResults()}
                disabled={isLoadingPlaylistBrowse}
                className={`px-2.5 py-1 rounded-md border text-[11px] font-medium flex items-center gap-1.5 whitespace-nowrap transition-all cursor-pointer flex-shrink-0 ${
                  activeSource === 'youtube'
                    ? 'bg-rose-500/20 border-rose-500/60 text-rose-200 font-semibold shadow-xs'
                    : 'bg-[#121217] hover:bg-[#1a1a22] border-[#22222a] hover:border-rose-500/40 text-[#8e8e96] hover:text-rose-200'
                }`}
              >
                <Play className="w-3 h-3 text-rose-500 fill-rose-500" />
                <span>YouTube Results ({youtubeResults.length})</span>
              </button>
            )}

            {songResults.length > 0 && (
              <button
                type="button"
                onClick={() => onSelectDirectSongs && onSelectDirectSongs()}
                disabled={isLoadingPlaylistBrowse}
                className={`px-2.5 py-1 rounded-md border text-[11px] font-medium flex items-center gap-1.5 whitespace-nowrap transition-all cursor-pointer flex-shrink-0 ${
                  activeSource === 'songs'
                    ? 'bg-purple-500/20 border-purple-500/60 text-purple-200 font-semibold shadow-xs'
                    : 'bg-[#121217] hover:bg-[#1a1a22] border-[#22222a] hover:border-purple-500/40 text-[#8e8e96] hover:text-purple-200'
                }`}
              >
                <Disc className="w-3 h-3 text-purple-400" />
                <span>YT Music Songs ({songResults.length})</span>
              </button>
            )}

            {matchedPlaylists.map((pl) => {
              const isActivePl = activeSource === 'playlist' && activeBrowseId === pl.browse_id
              return (
                <button
                  key={pl.browse_id}
                  type="button"
                  onClick={() => onSelectMatchedPlaylist && onSelectMatchedPlaylist(pl)}
                  disabled={isLoadingPlaylistBrowse}
                  className={`px-2.5 py-1 rounded-md border text-[11px] flex items-center gap-1.5 whitespace-nowrap transition-all cursor-pointer flex-shrink-0 ${
                    isActivePl
                      ? 'bg-emerald-500/20 border-emerald-500/60 text-emerald-200 font-semibold shadow-xs'
                      : 'bg-[#121217] hover:bg-[#1a1a22] border-[#22222a] hover:border-emerald-500/40 text-[#8e8e96] hover:text-emerald-200'
                  }`}
                >
                  {isLoadingPlaylistBrowse && isActivePl ? (
                    <Loader2 className="w-3 h-3 animate-spin text-emerald-400" />
                  ) : (
                    <ListMusic className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                  )}
                  <span className="truncate max-w-[200px]">{pl.title}</span>
                  {pl.is_editorial && (
                    <span className="text-[9px] font-mono px-1 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                      Official
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        )}

        {showModelDetails && !isDirectSearch && (
          <div className="mt-1 px-3 py-2 rounded-lg bg-[#121218] border border-[#22222a] text-[11px] sm:text-xs flex items-center justify-between gap-2">
            <div className="text-[#d4d4d8]">
              <span className="font-mono text-[10px] uppercase text-indigo-400 font-semibold mr-1.5">
                AI Status:
              </span>
              {didFallback ? (
                <span>
                  Target <code className="text-[#f4f4f5]">{reqModel}</code> hit{' '}
                  <span className="text-amber-300">{fallbackReason}</span> &rarr; fulfilled by{' '}
                  <code className="text-emerald-300">{usedModel}</code>.
                </span>
              ) : (
                <span>
                  Target <code className="text-indigo-300">{usedModel}</code> responded directly
                  {latencySec ? ` in ${latencySec}` : ''}.
                </span>
              )}
            </div>
            <button
              onClick={() => setShowModelDetails(false)}
              className="text-[11px] font-mono text-[#8e8e96] hover:text-white cursor-pointer"
            >
              Hide
            </button>
          </div>
        )}
      </div>

      {/* Scrollable Track Area */}
      <div className="flex-1 overflow-y-auto divide-y divide-[#15151c]">
        {/* MOBILE TRACK CARDS (< 640px) */}
        <div className="sm:hidden divide-y divide-[#15151c]">
          {tracks.map((track, idx) => {
            const isSelected = currentTrack && (
              (currentTrack.video_id && currentTrack.video_id === track.video_id) ||
              (currentTrack.title === track.title && currentTrack.artist === track.artist)
            )
            const isThisPlaying = isSelected && isPlaying
            const isExpanded = expandedIdx === idx
            const shortNote = cleanMusicalRationale(track.reason)
            const moreNote = extraDetail(track)
            const validDuration = track.duration_text && track.duration_text !== '--:--'
            const thumbUrl = track.thumbnail || (track.video_id ? `https://i.ytimg.com/vi/${track.video_id}/hqdefault.jpg` : '')
            const isFav = isTrackFavorite ? isTrackFavorite(track) : false
            const matchTier = track.match_tier || 'Direct Match'

            return (
              <div
                key={idx}
                onClick={() => onPlayTrack(track, idx)}
                className={`px-3.5 py-2.5 transition-colors active:bg-[#14141a] ${
                  isSelected
                    ? 'bg-sky-500/[0.08] border-l-2 border-l-sky-400'
                    : 'border-l-2 border-l-transparent'
                }`}
              >
                <div className="flex items-center gap-3">
                  {/* Artwork with overlay play state */}
                  <div className={`w-11 h-11 rounded-md bg-[#14141a] border overflow-hidden flex-shrink-0 relative ${
                    isSelected ? 'border-sky-500/60' : 'border-[#22222a]'
                  }`}>
                    {thumbUrl ? (
                      <img src={thumbUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[#71717a]">
                        <Music className="w-4 h-4" />
                      </div>
                    )}
                    <div className={`absolute inset-0 flex items-center justify-center bg-black/45 ${
                      isSelected ? 'opacity-100' : 'opacity-0'
                    }`}>
                      {isThisPlaying ? (
                        <Pause className="w-4 h-4 text-white fill-current" />
                      ) : (
                        <Play className="w-4 h-4 text-white fill-current ml-0.5" />
                      )}
                    </div>
                  </div>

                  {/* Title, Artist, Badge & Duration */}
                  <div className="min-w-0 flex-1">
                    <div className={`text-[13.5px] font-semibold truncate ${
                      isSelected ? 'text-sky-200' : 'text-[#f4f4f5]'
                    }`}>
                      {track.title}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5 text-xs text-[#8e8e96]">
                      <span className="truncate">{track.artist}</span>
                      {validDuration && (
                        <>
                          <span className="text-[#3f3f46]">&bull;</span>
                          <span className="font-mono text-[11px] flex-shrink-0">{track.duration_text}</span>
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className={`inline-block text-[9.5px] font-mono px-1.5 py-0.2 rounded border ${getTierBadgeStyle(matchTier)}`}>
                        {matchTier}
                      </span>
                      {track.vibe && (
                        <span className="text-[10px] font-mono text-[#71717a] truncate">
                          {track.vibe}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Mobile Actions */}
                  <div className="flex items-center gap-0.5 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => onToggleFavorite && onToggleFavorite(track)}
                      className={`p-2 rounded-md ${
                        isFav ? 'text-rose-400' : 'text-[#71717a]'
                      }`}
                      aria-label="Favorite"
                    >
                      <Heart className={`w-4 h-4 ${isFav ? 'fill-rose-500 text-rose-500' : ''}`} />
                    </button>
                    <button
                      onClick={() => setExpandedIdx(isExpanded ? null : idx)}
                      className="p-2 rounded-md text-[#71717a]"
                      aria-label="Details"
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Musical rationale preview / expanded detail */}
                <p className={`text-[11.5px] text-[#a1a1aa] mt-1.5 leading-relaxed ${isExpanded ? '' : 'line-clamp-1'}`}>
                  {shortNote} {isExpanded && moreNote ? moreNote : ''}
                </p>
              </div>
            )
          })}
        </div>

        {/* DESKTOP ANTIGRAVITY TABLE (>= 640px) */}
        <table className="hidden sm:table w-full text-left border-collapse select-none">
          <thead>
            <tr className="border-b border-[#1c1c22] text-[10px] font-mono uppercase tracking-wider text-[#71717a] bg-[#0c0c10] sticky top-0 z-10">
              <th className="py-2.5 pl-6 pr-2 w-11">#</th>
              <th className="py-2.5 px-3">Track</th>
              <th className="py-2.5 px-3 hidden lg:table-cell">Musical Connection</th>
              <th className="py-2.5 px-3 w-44">Match & Style</th>
              <th className="py-2.5 px-3 w-20 text-right">Duration</th>
              <th className="py-2.5 pl-2 pr-6 w-24 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#15151c] text-xs">
            {tracks.map((track, idx) => {
              const isSelected = currentTrack && (
                (currentTrack.video_id && currentTrack.video_id === track.video_id) ||
                (currentTrack.title === track.title && currentTrack.artist === track.artist)
              )
              const isThisPlaying = isSelected && isPlaying
              const isExpanded = expandedIdx === idx || isSelected
              const shortNote = cleanMusicalRationale(track.reason)
              const moreNote = extraDetail(track)
              const validDuration = track.duration_text && track.duration_text !== '--:--'
              const thumbUrl = track.thumbnail || (track.video_id ? `https://i.ytimg.com/vi/${track.video_id}/hqdefault.jpg` : '')
              const isFav = isTrackFavorite ? isTrackFavorite(track) : false
              const matchTier = track.match_tier || 'Direct Match'

              return (
                <React.Fragment key={idx}>
                  <tr
                    onClick={() => onPlayTrack(track, idx)}
                    className={`group transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-sky-500/[0.08] border-l-2 border-l-sky-400'
                        : 'hover:bg-[#121217] border-l-2 border-l-transparent'
                    }`}
                  >
                    <td className="py-3 pl-5 pr-2 font-mono text-xs text-[#71717a] w-11">
                      <div className="w-6 h-6 flex items-center justify-center">
                        {isThisPlaying ? (
                          <Pause className="w-4 h-4 text-sky-400 fill-current" />
                        ) : (
                          <>
                            <span className={isSelected ? 'text-sky-300 font-semibold group-hover:hidden' : 'group-hover:hidden'}>
                              {(idx + 1).toString().padStart(2, '0')}
                            </span>
                            <Play className="w-4 h-4 text-white fill-current hidden group-hover:block" />
                          </>
                        )}
                      </div>
                    </td>

                    <td className="py-3 px-3 max-w-[290px]">
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className={`w-10 h-10 rounded-md bg-[#14141a] border overflow-hidden flex-shrink-0 ${
                          isSelected ? 'border-sky-500/50 shadow-xs shadow-sky-500/20' : 'border-[#22222a]'
                        }`}>
                          {thumbUrl ? (
                            <img src={thumbUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-[#71717a]">
                              <Music className="w-4 h-4" />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className={`text-[13.5px] font-semibold truncate ${
                            isSelected ? 'text-sky-200' : 'text-[#f4f4f5] group-hover:text-white'
                          }`}>
                            {track.title}
                          </div>
                          <div className="text-xs text-[#8e8e96] truncate mt-0.5">
                            {track.artist}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-3 hidden lg:table-cell max-w-md">
                      <p className="text-xs text-[#a1a1aa] line-clamp-2 leading-relaxed">
                        {shortNote}
                      </p>
                      {isExpanded && moreNote && (
                        <p className="text-[11px] text-sky-300/90 mt-1 leading-relaxed">
                          {moreNote}
                        </p>
                      )}
                    </td>

                    <td className="py-3 px-3">
                      <div className="flex flex-col items-start gap-1">
                        <span className={`inline-block text-[10px] font-mono px-2 py-0.5 rounded border font-medium ${getTierBadgeStyle(matchTier)}`}>
                          {matchTier}
                        </span>
                        {track.vibe && (
                          <span className="text-[11px] font-mono text-[#8e8e96] truncate max-w-[140px]">
                            {track.vibe}
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="py-3 px-3 font-mono text-xs text-[#8e8e96] text-right">
                      {validDuration ? (
                        track.duration_text
                      ) : isResolvingBatch ? (
                        <Loader2 className="w-3 h-3 animate-spin text-sky-400 inline" />
                      ) : (
                        <span className="text-[11px] text-[#71717a] px-1.5 py-0.5 rounded bg-[#121217] border border-[#202028]">
                          Ready
                        </span>
                      )}
                    </td>

                    <td className="py-3 pl-2 pr-6 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => onToggleFavorite && onToggleFavorite(track)}
                          className={`p-1.5 rounded-md hover:bg-[#1a1a22] transition-colors cursor-pointer ${
                            isFav ? 'text-rose-400' : 'text-[#71717a] hover:text-rose-300'
                          }`}
                        >
                          <Heart className={`w-3.5 h-3.5 ${isFav ? 'fill-rose-500 text-rose-500' : ''}`} />
                        </button>
                        <button
                          onClick={() => setExpandedIdx(expandedIdx === idx ? null : idx)}
                          className="lg:hidden p-1.5 rounded-md hover:bg-[#1a1a22] text-[#8e8e96] hover:text-white transition-colors cursor-pointer"
                        >
                          {expandedIdx === idx ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          onClick={() => onPushToSafari(track)}
                          className="p-1.5 rounded-md hover:bg-[#1a1a22] text-[#71717a] hover:text-white transition-colors cursor-pointer"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>

                  {expandedIdx === idx && (
                    <tr className="lg:hidden bg-[#0e0e13] border-l-2 border-l-sky-500/60">
                      <td colSpan={6} className="px-6 py-2.5 text-xs text-[#a1a1aa] leading-relaxed">
                        <span className="font-mono text-[10px] uppercase text-sky-400 mr-2">
                          {matchTier}:
                        </span>
                        {shortNote} {moreNote}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
