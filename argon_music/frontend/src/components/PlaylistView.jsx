import React, { useState } from 'react'
import {
  Play, Pause, ExternalLink, Loader2, Music,
  ChevronDown, ChevronUp, Heart, Info
} from 'lucide-react'

function cleanMusicalRationale(text) {
  if (!text) return 'Selected for its harmonic and rhythmic alignment.'
  let s = text.split(/(?<=[.!?])\s+/)[0] || text
  // Strip AI-to-AI meta phrasing if present in older cached playlists
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
  return 'bg-indigo-500/15 text-indigo-300 border-indigo-500/35'
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
  onGenerateDefault
}) {
  const [expandedIdx, setExpandedIdx] = useState(null)
  const [showModelDetails, setShowModelDetails] = useState(false)

  if (isGenerating) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 text-center select-none">
        <Loader2 className="w-6 h-6 text-indigo-400 animate-spin mb-3" />
        <p className="text-sm font-medium text-[#f5f5f5]">
          Curating playlist and resolving streams...
        </p>
        <p className="text-xs font-mono text-[#9ca3af] mt-1">
          Target Model: {selectedModel} • Prioritizing direct matches & saved favorites
        </p>
      </div>
    )
  }

  if (!playlist || !playlist.tracks || playlist.tracks.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 text-center select-none">
        <div className="w-10 h-10 rounded-lg border border-[#2a2a32] bg-[#141418] flex items-center justify-center mb-3">
          <Music className="w-4 h-4 text-indigo-400" />
        </div>
        <p className="text-sm font-medium text-[#f5f5f5]">
          No active playlist
        </p>
        <p className="text-xs text-[#9ca3af] mt-1 max-w-xs">
          Enter a prompt above, select a listening mode on the left, or generate from your synced Safari history.
        </p>
        {onGenerateDefault && (
          <button
            onClick={onGenerateDefault}
            className="mt-4 px-3.5 py-2 rounded-md bg-indigo-600 hover:bg-indigo-500 text-xs font-medium text-white transition-colors cursor-pointer"
          >
            Generate from Safari History
          </button>
        )}
      </div>
    )
  }

  const tracks = playlist.tracks || []
  const usedModel = playlist.used_model || selectedModel
  const reqModel = playlist.requested_model || selectedModel
  const didFallback = Boolean(playlist.is_fallback) || usedModel !== reqModel
  const fallbackReason =
    playlist.fallback_reason ||
    (didFallback ? `High demand (HTTP 503) or rate limit on ${reqModel}` : '')
  const latencySec = playlist.latency_ms ? `${(playlist.latency_ms / 1000).toFixed(1)}s` : ''

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Playlist Header */}
      <div className="px-6 py-4 border-b border-[#222226] flex flex-col gap-2 bg-[#0a0a0c]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="text-base sm:text-lg font-semibold text-[#f5f5f5] tracking-tight truncate">
                {playlist.playlist_title || 'Curated Selection'}
              </h2>

              {/* Transparent AI Model Status Pill */}
              <button
                type="button"
                onClick={() => setShowModelDetails((prev) => !prev)}
                title={
                  didFallback
                    ? `Fallback triggered: ${fallbackReason}. Click for model telemetry.`
                    : `Succeeded directly on configured target model (${usedModel}). Click for details.`
                }
                className={`flex items-center gap-1.5 text-[11px] font-mono px-2.5 py-0.5 rounded-md border transition-colors cursor-pointer ${
                  didFallback
                    ? 'bg-amber-500/10 text-amber-200 border-amber-500/30 hover:bg-amber-500/15'
                    : 'bg-emerald-500/10 text-emerald-200 border-emerald-500/25 hover:bg-emerald-500/15'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${didFallback ? 'bg-amber-400' : 'bg-emerald-400'}`} />
                {didFallback ? (
                  <span>
                    Generated by <strong>{usedModel}</strong> · Fallback from {reqModel}
                  </span>
                ) : (
                  <span>
                    Model: <strong>{usedModel}</strong> · Direct{latencySec ? ` (${latencySec})` : ''}
                  </span>
                )}
                <Info className="w-3 h-3 opacity-70 ml-0.5" />
              </button>
            </div>

            <p className="text-xs text-[#a1a1aa] mt-1 truncate max-w-2xl">
              {playlist.subtitle || playlist.vibe_description}
            </p>
          </div>

          {/* Secondary Play All CTA */}
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono text-[#a1a1aa]">
              {tracks.length} tracks
            </span>
            <button
              onClick={() => onPlayTrack(tracks[0], 0)}
              title="Play entire curated playlist from track 01"
              className="px-3.5 py-1.5 rounded-md bg-[#16161c] hover:bg-[#22222a] border border-[#2e2e38] text-[#f5f5f5] text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-current text-indigo-400" />
              <span>Play All</span>
            </button>
          </div>
        </div>

        {/* Expandable AI Fallback Telemetry Banner */}
        {showModelDetails && (
          <div className="mt-1 px-3.5 py-2.5 rounded-md bg-[#121217] border border-[#282832] text-xs flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-[#d4d4d8]">
              <span className="font-mono text-[11px] uppercase text-indigo-400 font-semibold">
                AI Routing Status:
              </span>
              {didFallback ? (
                <span>
                  Target model <code className="text-[#f5f5f5]">{reqModel}</code> returned{' '}
                  <span className="text-amber-300 font-medium">{fallbackReason}</span>. Automatically routed to{' '}
                  <code className="text-emerald-300">{usedModel}</code> so your request completed without failing.
                </span>
              ) : (
                <span>
                  Target model <code className="text-emerald-300">{usedModel}</code> responded directly with HTTP 200 OK
                  {latencySec ? ` in ${latencySec}` : ''}. No fallback required.
                </span>
              )}
            </div>
            <button
              onClick={() => setShowModelDetails(false)}
              className="text-[11px] font-mono text-[#9ca3af] hover:text-white cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}
      </div>

      {/* Track Table */}
      <div className="flex-1 overflow-y-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-[#1f1f24] text-[10px] font-mono uppercase tracking-wider text-[#9ca3af] select-none bg-[#0c0c0f] sticky top-0 z-10">
              <th className="py-2.5 pl-6 pr-2 w-11">#</th>
              <th className="py-2.5 px-3">Track</th>
              <th className="py-2.5 px-3 hidden lg:table-cell">Musical Connection</th>
              <th className="py-2.5 px-3 hidden sm:table-cell w-44">Match & Style</th>
              <th className="py-2.5 px-3 w-20 text-right">Duration</th>
              <th className="py-2.5 pl-2 pr-6 w-24 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#18181d] text-xs">
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
              const isUnavailable = !track.video_id && !isResolvingBatch

              return (
                <React.Fragment key={idx}>
                  <tr
                    onClick={() => onPlayTrack(track, idx)}
                    className={`group transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-500/[0.09] border-l-2 border-l-indigo-500'
                        : isUnavailable
                        ? 'opacity-60 hover:opacity-90 hover:bg-[#131318] border-l-2 border-l-transparent'
                        : 'hover:bg-[#131318] border-l-2 border-l-transparent'
                    }`}
                  >
                    {/* Index / Play Indicator */}
                    <td className="py-3 pl-5 pr-2 font-mono text-xs text-[#9ca3af] w-11">
                      <div className="w-6 h-6 flex items-center justify-center" title={isThisPlaying ? 'Pause track' : 'Play track'}>
                        {isThisPlaying ? (
                          <Pause className="w-4 h-4 text-indigo-400 fill-current" />
                        ) : (
                          <>
                            <span className={isSelected ? 'text-indigo-300 font-semibold group-hover:hidden' : 'group-hover:hidden'}>
                              {(idx + 1).toString().padStart(2, '0')}
                            </span>
                            <Play className="w-4 h-4 text-white fill-current hidden group-hover:block" />
                          </>
                        )}
                      </div>
                    </td>

                    {/* Artwork + Prominent Title + Artist */}
                    <td className="py-3 px-3 max-w-[290px]">
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className={`w-10 h-10 rounded-md bg-[#18181e] border overflow-hidden flex-shrink-0 ${
                          isSelected ? 'border-indigo-500/50 shadow-sm shadow-indigo-500/20' : 'border-[#282830]'
                        }`}>
                          {thumbUrl ? (
                            <img
                              src={thumbUrl}
                              alt=""
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-[#73737a]">
                              <Music className="w-4 h-4" />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className={`text-[13.5px] font-semibold truncate ${
                            isSelected ? 'text-indigo-200' : 'text-[#f5f5f5] group-hover:text-white'
                          }`}>
                            {track.title}
                          </div>
                          <div className="text-xs text-[#a1a1aa] truncate mt-0.5">
                            {track.artist}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Concise Musical Connection (Desktop) */}
                    <td className="py-3 px-3 hidden lg:table-cell max-w-md">
                      <p className="text-xs text-[#c4c4cc] line-clamp-2 leading-relaxed">
                        {shortNote}
                      </p>
                      {isExpanded && moreNote && (
                        <p className="text-[11px] text-indigo-300/90 mt-1 leading-relaxed">
                          {moreNote}
                        </p>
                      )}
                    </td>

                    {/* Match Tier + Style Badge */}
                    <td className="py-3 px-3 hidden sm:table-cell">
                      <div className="flex flex-col items-start gap-1">
                        <span
                          className={`inline-block text-[10px] font-mono px-2 py-0.5 rounded border font-medium ${getTierBadgeStyle(matchTier)}`}
                          title={
                            matchTier === 'Direct Match'
                              ? 'Direct match for your prompt'
                              : matchTier === 'Close Fit'
                              ? 'Closely related musical style or composer'
                              : 'Exploratory pick bridging your taste memory'
                          }
                        >
                          {matchTier}
                        </span>
                        {track.vibe && (
                          <span className="text-[11px] font-mono text-[#a1a1aa] truncate max-w-[140px]">
                            {track.vibe}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Forgiving Duration Column */}
                    <td className="py-3 px-3 font-mono text-xs text-[#a1a1aa] text-right">
                      {validDuration ? (
                        track.duration_text
                      ) : isResolvingBatch ? (
                        <span
                          className="inline-flex items-center justify-end gap-1 text-[11px] text-[#8e8e93]"
                          title="Fetching stream duration from YouTube..."
                        >
                          <Loader2 className="w-3 h-3 animate-spin text-indigo-400" />
                        </span>
                      ) : (
                        <span
                          className="text-[11px] text-[#8e8e93] px-1.5 py-0.5 rounded bg-[#16161c] border border-[#26262e]"
                          title="Stream metadata resolved on play"
                        >
                          Ready
                        </span>
                      )}
                    </td>

                    {/* Actions: Heart (Favorite) + Expand Detail + Open in Safari */}
                    <td
                      className="py-3 pl-2 pr-6 text-right"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => onToggleFavorite && onToggleFavorite(track)}
                          title={isFav ? 'Saved in Favorites memory (Click to remove)' : 'Like track & save to Favorites memory'}
                          aria-label={isFav ? 'Remove from Favorites' : 'Save to Favorites'}
                          className={`p-1.5 rounded hover:bg-[#22222a] transition-colors cursor-pointer ${
                            isFav ? 'text-rose-400' : 'text-[#8e8e93] hover:text-rose-300'
                          }`}
                        >
                          <Heart className={`w-3.5 h-3.5 ${isFav ? 'fill-rose-500 text-rose-500' : ''}`} />
                        </button>

                        <button
                          onClick={() => setExpandedIdx(expandedIdx === idx ? null : idx)}
                          title="Show musical details"
                          aria-label="Show musical details"
                          className="lg:hidden p-1.5 rounded hover:bg-[#22222a] text-[#a1a1aa] hover:text-white transition-colors cursor-pointer"
                        >
                          {expandedIdx === idx ? (
                            <ChevronUp className="w-3.5 h-3.5" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5" />
                          )}
                        </button>

                        <button
                          onClick={() => onPushToSafari(track)}
                          title="Open track directly in Safari YouTube tab"
                          aria-label="Open in Safari"
                          className="p-1.5 rounded hover:bg-[#22222a] text-[#a1a1aa] hover:text-white transition-colors cursor-pointer"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>

                  {/* Expandable Rationale Drawer for narrower widths */}
                  {expandedIdx === idx && (
                    <tr className="lg:hidden bg-[#101015] border-l-2 border-l-indigo-500/60">
                      <td colSpan={6} className="px-6 py-2.5 text-xs text-[#c4c4cc] leading-relaxed">
                        <span className="font-mono text-[10px] uppercase text-indigo-400 mr-2">
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
