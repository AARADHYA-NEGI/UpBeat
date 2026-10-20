import React from 'react'
import { RefreshCw, ExternalLink, X, Heart, RotateCcw } from 'lucide-react'

export const PRESET_MODES = [
  {
    id: 'focus',
    label: 'Deep Focus / Terminal',
    character: 'Minimal Synth • Instrumental',
    energy: 60,
    prompt: 'Focused instrumental electronic, minimal synth, and atmospheric OSTs for deep programming sessions'
  },
  {
    id: 'ost',
    label: 'Cinematic & Anime OST',
    character: 'Orchestral Rock • Sawano',
    energy: 78,
    prompt: 'High-impact orchestral rock, Hiroyuki Sawano style soundtracks, and Monogatari / anime openings'
  },
  {
    id: 'velocity',
    label: 'High-Velocity Flow',
    character: 'Liquid DnB • Dark Synth',
    energy: 88,
    prompt: 'Fast-paced drum & bass, dark synthwave, and driving electronic rhythm for high-speed execution'
  },
  {
    id: 'nocturne',
    label: 'Late Night / Downtempo',
    character: 'Nocturnal Lo-Fi • Ambient',
    energy: 42,
    prompt: 'Nocturnal lo-fi, ambient textures, and understated melodic pieces for late-night work'
  },
  {
    id: 'indie',
    label: 'Alt / Math Rock & J-Rock',
    character: 'Intricate Guitar • Melodic',
    energy: 72,
    prompt: 'Intricate guitar work, math rock, Japanese alternative rock, and crisp melodic arrangements'
  }
]

export default function Sidebar({
  tasteDna,
  energyLevel,
  setEnergyLevel,
  trackCount,
  setTrackCount,
  activePresetId,
  onSelectPreset,
  extractedCount,
  favoritesCount = 0,
  onOpenFavoritesTab,
  onSyncSafari,
  isSyncing,
  onOpenSafari,
  isOpenMobile,
  onCloseMobile
}) {
  const activePreset = PRESET_MODES.find((p) => p.id === activePresetId)
  const isPresetCustomized = activePreset && energyLevel !== activePreset.energy

  const sidebarContent = (
    <aside className="w-68 bg-[#0d0d0f] border-r border-[#222226] flex-shrink-0 flex flex-col justify-between overflow-y-auto select-none h-full">
      <div className="p-4 flex flex-col gap-5">
        {/* Mobile Header */}
        {isOpenMobile && (
          <div className="flex items-center justify-between lg:hidden pb-2 border-b border-[#222226]">
            <span className="text-xs font-semibold text-[#f5f5f5]">Controls & Presets</span>
            <button
              onClick={onCloseMobile}
              className="p-1 rounded hover:bg-[#1c1c22] text-[#a3a3a3] hover:text-white"
              title="Close Sidebar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Safari Source & Favorites Memory Section */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-mono uppercase tracking-wider text-[#9ca3af] font-medium">
              Taste Memory
            </span>
            <div className="flex items-center gap-2 text-[11px] font-mono">
              <button
                onClick={onOpenFavoritesTab}
                title="View your hearted Favorites memory"
                className="text-rose-300 hover:text-rose-200 flex items-center gap-1 cursor-pointer"
              >
                <Heart className="w-3 h-3 fill-rose-400 text-rose-400" />
                <span>{favoritesCount} liked</span>
              </button>
              <span className="text-[#52525b]">•</span>
              <span className="text-[#d4d4d8]" title="Tracks extracted from Safari">
                {extractedCount} seeds
              </span>
            </div>
          </div>

          <button
            onClick={onSyncSafari}
            disabled={isSyncing}
            title="Extract latest liked songs and history from your open Safari YouTube tabs"
            className="w-full py-1.5 px-3 bg-[#16161a] hover:bg-[#1f1f26] border border-[#2a2a32] rounded-md text-xs text-[#f5f5f5] font-medium flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-indigo-400 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Reading Safari DOM...' : 'Sync Active YT Tabs'}</span>
          </button>

          <div className="grid grid-cols-2 gap-1.5 mt-2">
            <button
              onClick={() => onOpenSafari('yt_liked')}
              title="Open YouTube Liked Videos playlist in Safari"
              className="py-1.5 px-2.5 bg-[#121215] hover:bg-[#1a1a20] border border-[#242429] text-[#b4b4b8] hover:text-[#f5f5f5] text-[11px] rounded-md flex items-center justify-between transition-colors cursor-pointer"
            >
              <span>YT Likes</span>
              <ExternalLink className="w-3 h-3 text-[#8e8e93]" />
            </button>
            <button
              onClick={() => onOpenSafari('yt_history')}
              title="Open YouTube Watch History in Safari"
              className="py-1.5 px-2.5 bg-[#121215] hover:bg-[#1a1a20] border border-[#242429] text-[#b4b4b8] hover:text-[#f5f5f5] text-[11px] rounded-md flex items-center justify-between transition-colors cursor-pointer"
            >
              <span>YT History</span>
              <ExternalLink className="w-3 h-3 text-[#8e8e93]" />
            </button>
          </div>
        </div>

        <div className="h-[1px] bg-[#1e1e24]" />

        {/* Expressive Presets synchronized with Intensity Slider */}
        <div>
          <span className="text-[11px] font-mono uppercase tracking-wider text-[#9ca3af] font-medium block mb-2.5">
            Listening Modes
          </span>
          <div className="flex flex-col gap-1.5">
            {PRESET_MODES.map((p) => {
              const isSelected = activePresetId === p.id
              const displayedEnergy = isSelected ? energyLevel : p.energy
              const isModified = isSelected && energyLevel !== p.energy

              return (
                <button
                  key={p.id}
                  onClick={() => {
                    onSelectPreset(p)
                    if (isOpenMobile && onCloseMobile) onCloseMobile()
                  }}
                  title={` Curate "${p.label}" (Default intensity: ${p.energy}%)`}
                  className={`w-full px-3 py-2 rounded-md text-left transition-all cursor-pointer border ${
                    isSelected
                      ? 'bg-indigo-500/[0.12] border-indigo-500/40 border-l-2 border-l-indigo-500 text-white shadow-sm'
                      : 'bg-[#121216]/60 hover:bg-[#18181e] border-[#1f1f26] text-[#d4d4d8] hover:text-white'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-xs truncate ${isSelected ? 'font-semibold text-white' : 'font-medium text-[#e4e4e7]'}`}>
                      {p.label}
                    </span>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {isModified && (
                        <span
                          className="text-[9px] font-mono px-1 py-0.2 rounded bg-indigo-500/20 text-indigo-300"
                          title={`Preset default is ${p.energy}%, currently customized to ${energyLevel}%`}
                        >
                          custom
                        </span>
                      )}
                      <span className={`text-[10px] font-mono ${isSelected ? 'text-indigo-300 font-medium' : 'text-[#a1a1aa]'}`}>
                        {displayedEnergy}%
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 mt-1">
                    <span className={`text-[10px] truncate ${isSelected ? 'text-indigo-200/80' : 'text-[#9ca3af]'}`}>
                      {p.character}
                    </span>
                    <div className="w-10 h-1 rounded-full bg-[#22222a] overflow-hidden flex-shrink-0">
                      <div
                        className={`h-full rounded-full transition-all ${isSelected ? 'bg-indigo-400' : 'bg-[#6366f1]/60'}`}
                        style={{ width: `${displayedEnergy}%` }}
                      />
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        <div className="h-[1px] bg-[#1e1e24]" />

        {/* Parameters */}
        <div className="flex flex-col gap-4">
          <span className="text-[11px] font-mono uppercase tracking-wider text-[#9ca3af] font-medium block">
            Parameters
          </span>

          <div>
            <div className="flex justify-between items-center text-xs mb-2">
              <div className="flex items-center gap-1.5">
                <span className="text-[#d4d4d8]">Intensity</span>
                {isPresetCustomized && (
                  <button
                    onClick={() => setEnergyLevel(activePreset.energy)}
                    title={`Reset intensity to ${activePreset.label} default (${activePreset.energy}%)`}
                    className="text-[10px] font-mono text-indigo-400 hover:text-indigo-300 flex items-center gap-0.5 cursor-pointer"
                  >
                    <RotateCcw className="w-2.5 h-2.5" />
                    <span>reset ({activePreset.energy}%)</span>
                  </button>
                )}
              </div>
              <span className="font-mono text-xs font-medium text-indigo-300">
                {energyLevel}%
              </span>
            </div>
            <input
              type="range"
              min="10"
              max="100"
              value={energyLevel}
              onChange={(e) => setEnergyLevel(Number(e.target.value))}
              style={{
                background: `linear-gradient(to right, #6366f1 0%, #6366f1 ${energyLevel}%, #26262e ${energyLevel}%, #26262e 100%)`
              }}
              className="w-full argon-slider cursor-pointer"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs mb-2">
              <span className="text-[#d4d4d8]">Track Count</span>
              <span className="font-mono text-xs font-medium text-[#e4e4e7]">{trackCount}</span>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {[6, 8, 12, 16].map((n) => (
                <button
                  key={n}
                  onClick={() => setTrackCount(n)}
                  className={`py-1 rounded-md text-xs font-mono transition-all cursor-pointer border ${
                    trackCount === n
                      ? 'bg-indigo-500/20 text-indigo-200 border-indigo-500/50 font-semibold'
                      : 'bg-[#141418] text-[#a1a1aa] hover:text-[#f5f5f5] border-[#24242b]'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Profile Snapshot */}
      {tasteDna && (
        <div className="p-4 border-t border-[#222226] bg-[#0a0a0c]">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-mono uppercase text-[#9ca3af] font-medium">
              Profile
            </span>
            <span className="text-[10px] font-mono text-[#a1a1aa]">
              {tasteDna.sonic_attributes?.tempo || '120-140 BPM'}
            </span>
          </div>
          <div className="text-xs font-semibold text-[#f5f5f5] truncate">
            {tasteDna.archetype || 'Listener Profile'}
          </div>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {(tasteDna.primary_genres || []).slice(0, 3).map((g, i) => (
              <span
                key={i}
                className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#16161b] text-[#b4b4b8] border border-[#26262e]"
              >
                {g}
              </span>
            ))}
          </div>
        </div>
      )}
    </aside>
  )

  return (
    <>
      <div className="hidden lg:flex h-full">
        {sidebarContent}
      </div>

      {isOpenMobile && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs"
            onClick={onCloseMobile}
          />
          <div className="relative z-10 h-full">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  )
}
