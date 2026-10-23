import React from 'react'
import { X, Play, Trash2, ListMusic, Music, CornerDownRight, Sparkles } from 'lucide-react'

export default function QueueDrawer({
  isOpen,
  onClose,
  queue = [],
  currentTrack,
  isPlaying,
  onPlayTrack,
  onRemoveFromQueue,
  onClearQueue,
  upcomingTracks = []
}) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex justify-end select-none">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Drawer Panel */}
      <div className="relative w-full max-w-md bg-[#0d0d12] border-l border-[#202028] h-full flex flex-col z-10 shadow-2xl animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#202028] flex items-center justify-between bg-[#111116]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
              <ListMusic className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-white">Playback Queue</h3>
                {queue.length > 0 && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-300 border border-sky-500/30">
                    {queue.length}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-[#71717a] font-mono mt-0.5">
                Tracks will play sequentially
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {queue.length > 0 && (
              <button
                onClick={onClearQueue}
                className="text-[11px] font-mono text-[#a1a1aa] hover:text-rose-400 px-2 py-1 rounded hover:bg-[#1a1418] transition-colors cursor-pointer"
                title="Clear all queued songs"
              >
                Clear Queue
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-[#71717a] hover:text-white hover:bg-[#1c1c24] transition-colors cursor-pointer"
              title="Close Queue"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 divide-y divide-[#1a1a24] space-y-5">
          {/* Section: Now Playing */}
          {currentTrack && (
            <div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-400 font-semibold block mb-2.5">
                Now Playing
              </span>
              <div className="p-3 rounded-xl bg-[#14141d] border border-emerald-500/30 flex items-center gap-3 shadow-inner">
                <div className="relative w-11 h-11 rounded-lg bg-[#181822] overflow-hidden shrink-0 border border-[#262634]">
                  {currentTrack.thumbnail ? (
                    <img src={currentTrack.thumbnail} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[#71717a]">
                      <Music className="w-4 h-4" />
                    </div>
                  )}
                  {isPlaying && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <div className="flex items-end gap-0.5 h-3.5">
                        <span className="w-0.5 bg-emerald-400 h-full animate-[bounce_0.8s_infinite_100ms]" />
                        <span className="w-0.5 bg-emerald-400 h-2/3 animate-[bounce_0.8s_infinite_300ms]" />
                        <span className="w-0.5 bg-emerald-400 h-4/5 animate-[bounce_0.8s_infinite_200ms]" />
                      </div>
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-white truncate">
                    {currentTrack.title}
                  </div>
                  <div className="text-[11px] text-[#8e8e96] truncate mt-0.5">
                    {currentTrack.artist}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Section: Up Next in Queue */}
          <div className="pt-4">
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#a1a1aa] font-semibold">
                Queued Next ({queue.length})
              </span>
              {queue.length > 0 && (
                <span className="text-[10px] font-mono text-sky-400">Plays First</span>
              )}
            </div>

            {queue.length === 0 ? (
              <div className="py-8 px-4 text-center border border-dashed border-[#202028] rounded-xl bg-[#0f0f14]/50">
                <CornerDownRight className="w-5 h-5 text-[#52525b] mx-auto mb-2" />
                <p className="text-xs text-[#a1a1aa] font-medium">Your queue is empty</p>
                <p className="text-[11px] text-[#71717a] mt-1 max-w-xs mx-auto">
                  Click the queue icon (<strong>+</strong>) on any song to play it next.
                </p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {queue.map((t, idx) => (
                  <div
                    key={`${t.video_id || t.title}-${idx}`}
                    className="group p-2.5 rounded-lg bg-[#111117] hover:bg-[#161622] border border-[#1f1f2a] flex items-center justify-between gap-3 transition-colors cursor-pointer"
                    onClick={() => onPlayTrack(t, idx)}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-[10px] font-mono text-[#52525b] w-4 text-center">
                        {idx + 1}
                      </span>
                      <div className="w-9 h-9 rounded-md bg-[#181822] overflow-hidden shrink-0 border border-[#242430]">
                        {t.thumbnail ? (
                          <img src={t.thumbnail} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[#71717a]">
                            <Music className="w-3.5 h-3.5" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-medium text-[#f4f4f5] truncate">
                          {t.title}
                        </div>
                        <div className="text-[10.5px] text-[#8e8e96] truncate">
                          {t.artist}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          onRemoveFromQueue(idx)
                        }}
                        className="p-1 rounded text-[#71717a] hover:text-rose-400 hover:bg-[#201014] transition-colors cursor-pointer"
                        title="Remove from queue"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section: Next from Playlist */}
          {upcomingTracks.length > 0 && (
            <div className="pt-4">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#71717a] font-semibold block mb-2.5">
                Next Up from Playlist
              </span>
              <div className="space-y-1">
                {upcomingTracks.slice(0, 8).map((t, idx) => (
                  <div
                    key={`up-${t.video_id || idx}`}
                    className="p-2 rounded-lg hover:bg-[#14141a] flex items-center justify-between gap-2.5 text-xs text-[#a1a1aa] transition-colors cursor-pointer"
                    onClick={() => onPlayTrack(t)}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="text-[10px] font-mono text-[#52525b] w-4 text-center">
                        {idx + 1}
                      </span>
                      <div className="min-w-0">
                        <div className="text-xs text-[#e4e4e7] truncate">{t.title}</div>
                        <div className="text-[10px] text-[#71717a] truncate">{t.artist}</div>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono text-[#52525b] shrink-0">
                      {t.duration_text || ''}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
