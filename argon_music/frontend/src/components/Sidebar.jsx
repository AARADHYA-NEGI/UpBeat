import React from 'react'
import { RefreshCw, ExternalLink, X, Heart, RotateCcw, Plus, Radio, Sliders } from 'lucide-react'

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
  onNewSession,
  extractedCount = 0,
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
    <aside className="w-72 bg-[#0d0d10] border-r border-[#202026] flex-shrink-0 flex flex-col justify-between overflow-y-auto select-none h-full">
      <div className="p-4 flex flex-col gap-4">
        {/* Mobile Header */}
        {isOpenMobile && (
          <div className="flex items-center justify-between lg:hidden pb-2 border-b border-[#202026]">
            <span className="text-xs font-semibold text-[#f4f4f5]">Controls & Presets</span>
            <button
              onClick={onCloseMobile}
              className="p-1 rounded-md hover:bg-[#1a1a22] text-[#8e8e96] hover:text-[#f4f4f5] transition-colors"
              title="Close Sidebar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Antigravity Primary Action: New Session */}
        <button
          onClick={() => {
            if (onNewSession) onNewSession()
            if (isOpenMobile && onCloseMobile) onCloseMobile()
          }}
          className="w-full py-2 px-3 rounded-lg bg-[#15151c] hover:bg-[#1c1c24] border border-[#24242e] hover:border-sky-500/40 text-xs font-medium text-[#f4f4f5] flex items-center justify-center gap-2 transition-all shadow-xs cursor-pointer group"
          title="Start fresh session / clear search prompt"
        >
          <Plus className="w-3.5 h-3.5 text-sky-400 group-hover:scale-110 transition-transform" />
          <span>New Session</span>
        </button>

        {/* Taste Memory Section */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#71717a] font-semibold">
              Taste Memory
            </span>
            <div className="flex items-center gap-2 text-[10px] font-mono">
              <button
                onClick={onOpenFavoritesTab}
                title="View your hearted Favorites memory"
                className="text-rose-400 hover:text-rose-300 flex items-center gap-1 cursor-pointer"
              >
                <Heart className="w-2.5 h-2.5 fill-rose-400 text-rose-400" />
                <span>{favoritesCount} liked</span>
              </button>
              <span className="text-[#3f3f46]">•</span>
              <span className="text-[#a1a1aa]" title="Tracks extracted from Safari">
                {extractedCount} seeds
              </span>
            </div>
          </div>

          <button
            onClick={onSyncSafari}
            disabled={isSyncing}
            title="Extract latest liked songs and history from your open Safari YouTube tabs"
            className="w-full py-1.5 px-3 bg-[#131317] hover:bg-[#1b1b22] border border-[#22222a] hover:border-[#2f2f3c] rounded-md text-xs text-[#f4f4f5] font-medium flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-sky-400 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Reading Safari DOM...' : 'Sync Active YT Tabs'}</span>
          </button>

          <div className="grid grid-cols-2 gap-1.5 mt-2">
            <button
              onClick={() => onOpenSafari('yt_liked')}
              title="Open YouTube Liked Videos playlist in Safari"
              className="py-1.5 px-2.5 bg-[#101014] hover:bg-[#181820] border border-[#202026] text-[#a1a1aa] hover:text-[#f4f4f5] text-[11px] rounded-md flex items-center justify-between transition-colors cursor-pointer"
            >
              <span>YT Likes</span>
              <ExternalLink className="w-3 h-3 text-[#71717a]" />
            </button>
            <button
              onClick={() => onOpenSafari('yt_history')}
              title="Open YouTube Watch History in Safari"
              className="py-1.5 px-2.5 bg-[#101014] hover:bg-[#181820] border border-[#202026] text-[#a1a1aa] hover:text-[#f4f4f5] text-[11px] rounded-md flex items-center justify-between transition-colors cursor-pointer"
            >
              <span>YT History</span>
              <ExternalLink className="w-3 h-3 text-[#71717a]" />
            </button>
          </div>
        </div>

        <div className="h-[1px] bg-[#1c1c24]" />

        {/* Antigravity Listening Modes List */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#71717a] font-semibold">
              Listening Modes
            </span>
            <Radio className="w-3 h-3 text-[#52525b]" />
          </div>

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
                  title={`Curate "${p.label}" (Default intensity: ${p.energy}%)`}
                  className={`w-full px-3 py-2 rounded-lg text-left transition-all cursor-pointer border ${
                    isSelected
                      ? 'bg-[#161622] border-sky-500/40 border-l-2 border-l-sky-400 text-white shadow-xs'
                      : 'bg-[#111116]/80 hover:bg-[#17171e] border-[#1e1e26] text-[#d4d4d8] hover:text-white'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-xs truncate ${isSelected ? 'font-semibold text-white' : 'font-medium text-[#e4e4e7]'}`}>
                      {p.label}
                    </span>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {isModified && (
                        <span
                          className="text-[9px] font-mono px-1 py-0.2 rounded bg-sky-500/20 text-sky-300"
                          title={`Preset default is ${p.energy}%, currently customized to ${energyLevel}%`}
                        >
                          custom
                        </span>
                      )}
                      <span className={`text-[10px] font-mono ${isSelected ? 'text-sky-300 font-semibold' : 'text-[#71717a]'}`}>
                        {displayedEnergy}%
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 mt-1">
                    <span className={`text-[10px] truncate ${isSelected ? 'text-sky-200/80' : 'text-[#8e8e96]'}`}>
                      {p.character}
                    </span>
                    <div className="w-10 h-1 rounded-full bg-[#1e1e28] overflow-hidden flex-shrink-0">
                      <div
                        className={`h-full rounded-full transition-all ${isSelected ? 'bg-sky-400' : 'bg-[#38bdf8]/50'}`}
                        style={{ width: `${displayedEnergy}%` }}
                      />
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        <div className="h-[1px] bg-[#1c1c24]" />

        {/* Parameters Section */}
        <div className="flex flex-col gap-3.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#71717a] font-semibold">
              Parameters
            </span>
            <Sliders className="w-3 h-3 text-[#52525b]" />
          </div>

          <div>
            <div className="flex justify-between items-center text-xs mb-2">
              <div className="flex items-center gap-1.5">
                <span className="text-[#d4d4d8]">Intensity</span>
                {isPresetCustomized && (
                  <button
                    onClick={() => setEnergyLevel(activePreset.energy)}
                    title={`Reset intensity to ${activePreset.label} default (${activePreset.energy}%)`}
                    className="text-[10px] font-mono text-sky-400 hover:text-sky-300 flex items-center gap-0.5 cursor-pointer"
                  >
                    <RotateCcw className="w-2.5 h-2.5" />
                    <span>reset ({activePreset.energy}%)</span>
                  </button>
                )}
              </div>
              <span className="font-mono text-xs font-semibold text-sky-300">
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
                background: `linear-gradient(to right, #0284c7 0%, #38bdf8 ${energyLevel}%, #22222a ${energyLevel}%, #22222a 100%)`
              }}
              className="w-full argon-slider cursor-pointer"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs mb-2">
              <span className="text-[#d4d4d8]">Track Count</span>
              <span className="font-mono text-xs font-semibold text-[#f4f4f5]">{trackCount}</span>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {[6, 8, 12, 16].map((n) => (
                <button
                  key={n}
                  onClick={() => setTrackCount(n)}
                  className={`py-1 rounded-md text-xs font-mono transition-all cursor-pointer border ${
                    trackCount === n
                      ? 'bg-sky-500/20 text-sky-200 border-sky-500/50 font-semibold shadow-xs'
                      : 'bg-[#121216] text-[#8e8e96] hover:text-[#f4f4f5] border-[#202028]'
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
        <div className="p-3.5 border-t border-[#202026] bg-[#09090c]">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-mono uppercase text-[#71717a] font-semibold">
              Profile
            </span>
            <span className="text-[10px] font-mono text-[#8e8e96]">
              {tasteDna.sonic_attributes?.tempo || '120-140 BPM'}
            </span>
          </div>
          <div className="text-xs font-semibold text-[#f4f4f5] truncate">
            {tasteDna.archetype || 'Listener Profile'}
          </div>
          <div className="flex flex-wrap gap-1 mt-2">
            {(tasteDna.primary_genres || []).slice(0, 3).map((g, i) => (
              <span
                key={i}
                className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#131318] text-[#a1a1aa] border border-[#22222a]"
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
