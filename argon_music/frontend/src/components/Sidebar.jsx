import React from 'react'
import {
  RefreshCw, ExternalLink, X, Heart, RotateCcw, Plus, Radio, Sliders, DownloadCloud,
  Home, Compass, Sparkles, Disc, Dna
} from 'lucide-react'

export const PRESET_MODES = [
  {
    id: 'focus',
    label: 'Deep Focus / Terminal',
    character: 'Minimal Synth • Instrumental',
    energy: 60,
    theme: 'emerald',
    prompt: 'Focused instrumental electronic, minimal synth, and atmospheric OSTs for deep programming sessions'
  },
  {
    id: 'ost',
    label: 'Cinematic & Anime OST',
    character: 'Orchestral Rock • Sawano',
    energy: 78,
    theme: 'amber',
    prompt: 'High-impact orchestral rock, Hiroyuki Sawano style soundtracks, and Monogatari / anime openings'
  },
  {
    id: 'velocity',
    label: 'High-Velocity Flow',
    character: 'Liquid DnB • Dark Synth',
    energy: 88,
    theme: 'cyan',
    prompt: 'Fast-paced drum & bass, dark synthwave, and driving electronic rhythm for high-speed execution'
  },
  {
    id: 'nocturne',
    label: 'Late Night / Downtempo',
    character: 'Nocturnal Lo-Fi • Ambient',
    energy: 42,
    theme: 'violet',
    prompt: 'Nocturnal lo-fi, ambient textures, and understated melodic pieces for late-night work'
  },
  {
    id: 'indie',
    label: 'Alt / Math Rock & J-Rock',
    character: 'Intricate Guitar • Melodic',
    energy: 72,
    theme: 'rose',
    prompt: 'Intricate guitar work, math rock, Japanese alternative rock, and crisp melodic arrangements'
  }
]

const MODE_THEMES = {
  emerald: {
    selected: 'bg-[#101b15] border-emerald-500/50 border-l-2 border-l-emerald-400 text-white shadow-xs',
    hover: 'hover:border-emerald-500/30 hover:bg-[#121614]',
    tag: 'bg-emerald-500/20 text-emerald-300',
    percent: 'text-emerald-300 font-semibold',
    character: 'text-emerald-200/80',
    barActive: 'bg-emerald-400',
    barInactive: 'bg-emerald-500/30',
    sliderHex: '#10b981'
  },
  amber: {
    selected: 'bg-[#1b1710] border-amber-500/50 border-l-2 border-l-amber-400 text-white shadow-xs',
    hover: 'hover:border-amber-500/30 hover:bg-[#161411]',
    tag: 'bg-amber-500/20 text-amber-300',
    percent: 'text-amber-300 font-semibold',
    character: 'text-amber-200/80',
    barActive: 'bg-amber-400',
    barInactive: 'bg-amber-500/30',
    sliderHex: '#f59e0b'
  },
  cyan: {
    selected: 'bg-[#10191f] border-cyan-500/50 border-l-2 border-l-cyan-400 text-white shadow-xs',
    hover: 'hover:border-cyan-500/30 hover:bg-[#11161a]',
    tag: 'bg-cyan-500/20 text-cyan-300',
    percent: 'text-cyan-300 font-semibold',
    character: 'text-cyan-200/80',
    barActive: 'bg-cyan-400',
    barInactive: 'bg-cyan-500/30',
    sliderHex: '#06b6d4'
  },
  violet: {
    selected: 'bg-[#171222] border-violet-500/50 border-l-2 border-l-violet-400 text-white shadow-xs',
    hover: 'hover:border-violet-500/30 hover:bg-[#14111c]',
    tag: 'bg-violet-500/20 text-violet-300',
    percent: 'text-violet-300 font-semibold',
    character: 'text-violet-200/80',
    barActive: 'bg-violet-400',
    barInactive: 'bg-violet-500/30',
    sliderHex: '#a855f7'
  },
  rose: {
    selected: 'bg-[#1d1217] border-rose-500/50 border-l-2 border-l-rose-400 text-white shadow-xs',
    hover: 'hover:border-rose-500/30 hover:bg-[#191115]',
    tag: 'bg-rose-500/20 text-rose-300',
    percent: 'text-rose-300 font-semibold',
    character: 'text-rose-200/80',
    barActive: 'bg-rose-400',
    barInactive: 'bg-rose-500/30',
    sliderHex: '#f43f5e'
  }
}

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
  offlineCount = 0,
  offlineStorageSize = '0 B',
  activeTab = 'curator',
  setActiveTab,
  onOpenFavoritesTab,
  onOpenOfflineTab,
  onSyncSafari,
  isSyncing,
  onOpenSafari,
  isOpenDesktop = true,
  isOpenMobile,
  onCloseMobile,
  onToggleSidebar
}) {
  const activePreset = PRESET_MODES.find((p) => p.id === activePresetId)
  const isPresetCustomized = activePreset && energyLevel !== activePreset.energy

  // 1. YouTube Music Slim Vertical Left Rail (Icon + Text Stack)
  const slimRail = (
    <nav className="w-18 bg-[#030305]/95 backdrop-blur-md border-r border-white/[0.06] flex flex-col items-center py-3 select-none h-full shrink-0">
      <div className="flex flex-col items-center gap-2 w-full px-2">
        {/* Home / Curator */}
        <button
          onClick={() => setActiveTab && setActiveTab('curator')}
          className={`w-full py-3 rounded-xl flex flex-col items-center gap-1 transition-all cursor-pointer ${
            activeTab === 'curator'
              ? 'bg-white/10 text-white font-medium shadow-xs'
              : 'text-zinc-400 hover:text-white hover:bg-white/[0.06]'
          }`}
          title="Home / Quick picks"
        >
          <Home className="w-5 h-5" />
          <span className="text-[10px] tracking-tight">Home</span>
        </button>

        {/* Liked Favorites */}
        <button
          onClick={() => {
            if (onOpenFavoritesTab) onOpenFavoritesTab()
            else if (setActiveTab) setActiveTab('favorites')
          }}
          className={`w-full py-3 rounded-xl flex flex-col items-center gap-1 transition-all cursor-pointer relative ${
            activeTab === 'favorites'
              ? 'bg-white/10 text-rose-300 font-medium shadow-xs'
              : 'text-zinc-400 hover:text-white hover:bg-white/[0.06]'
          }`}
          title="Liked Songs"
        >
          <div className="relative">
            <Heart className={`w-5 h-5 ${favoritesCount > 0 ? 'fill-rose-500/40 text-rose-400' : ''}`} />
            {favoritesCount > 0 && (
              <span className="absolute -top-1.5 -right-2 text-[9px] font-mono px-1 rounded-full bg-rose-500/30 text-rose-300 border border-rose-500/40">
                {favoritesCount}
              </span>
            )}
          </div>
          <span className="text-[10px] tracking-tight">Liked</span>
        </button>

        {/* Offline Downloads */}
        <button
          onClick={() => {
            if (onOpenOfflineTab) onOpenOfflineTab()
            else if (setActiveTab) setActiveTab('offline')
          }}
          className={`w-full py-3 rounded-xl flex flex-col items-center gap-1 transition-all cursor-pointer relative ${
            activeTab === 'offline'
              ? 'bg-white/10 text-emerald-300 font-medium shadow-xs'
              : 'text-zinc-400 hover:text-white hover:bg-white/[0.06]'
          }`}
          title="Offline Downloads"
        >
          <div className="relative">
            <DownloadCloud className={`w-5 h-5 ${offlineCount > 0 ? 'text-emerald-400' : ''}`} />
            {offlineCount > 0 && (
              <span className="absolute -top-1.5 -right-2 text-[9px] font-mono px-1 rounded-full bg-emerald-500/30 text-emerald-300 border border-emerald-500/40">
                {offlineCount}
              </span>
            )}
          </div>
          <span className="text-[10px] tracking-tight">Offline</span>
        </button>

        {/* Seeds Library */}
        <button
          onClick={() => setActiveTab && setActiveTab('library')}
          className={`w-full py-3 rounded-xl flex flex-col items-center gap-1 transition-all cursor-pointer relative ${
            activeTab === 'library'
              ? 'bg-white/10 text-white font-medium shadow-xs'
              : 'text-zinc-400 hover:text-white hover:bg-white/[0.06]'
          }`}
          title="Seed Library"
        >
          <Disc className="w-5 h-5" />
          <span className="text-[10px] tracking-tight">Seeds</span>
        </button>

        {/* Taste Profile */}
        <button
          onClick={() => setActiveTab && setActiveTab('dna')}
          className={`w-full py-3 rounded-xl flex flex-col items-center gap-1 transition-all cursor-pointer relative ${
            activeTab === 'dna'
              ? 'bg-white/10 text-white font-medium shadow-xs'
              : 'text-zinc-400 hover:text-white hover:bg-white/[0.06]'
          }`}
          title="Sonic Taste Profile"
        >
          <Dna className="w-5 h-5" />
          <span className="text-[10px] tracking-tight">Profile</span>
        </button>

        {/* Modes Drawer Toggle */}
        <button
          onClick={onToggleSidebar}
          className="w-full py-3 rounded-xl flex flex-col items-center gap-1 transition-all cursor-pointer text-zinc-400 hover:text-white hover:bg-white/[0.06] mt-auto"
          title="Toggle Full Modes Drawer"
        >
          <Sliders className="w-5 h-5" />
          <span className="text-[10px] tracking-tight">Modes</span>
        </button>
      </div>
    </nav>
  )

  // 2. Full Expanded Drawer with Preset Sliders & Diagnostics
  const sidebarContent = (
    <aside className="w-72 bg-[#09090c]/95 backdrop-blur-xl border-r border-white/[0.06] flex-shrink-0 flex flex-col justify-between overflow-y-auto select-none h-full">
      <div className="p-4 flex flex-col gap-4">
        {/* Mobile / Expanded Header */}
        <div className="flex items-center justify-between pb-2 border-b border-white/[0.08]">
          <span className="text-xs font-semibold text-white tracking-wide">Modes & Taste Controls</span>
          <button
            onClick={isOpenMobile ? onCloseMobile : onToggleSidebar}
            className="p-1.5 rounded-full hover:bg-white/[0.1] text-zinc-400 hover:text-white transition-colors cursor-pointer"
            title="Collapse Sidebar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Primary Action: New Session */}
        <button
          onClick={() => {
            if (onNewSession) onNewSession()
            if (isOpenMobile && onCloseMobile) onCloseMobile()
          }}
          className="w-full py-2 px-3 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.08] hover:border-rose-500/40 text-xs font-medium text-white flex items-center justify-center gap-2 transition-all shadow-xs cursor-pointer group"
          title="Start fresh session / clear search prompt"
        >
          <Plus className="w-3.5 h-3.5 text-rose-400 group-hover:scale-110 transition-transform" />
          <span>New Session</span>
        </button>

        {/* Taste Memory Section */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-semibold">
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
              <span className="text-zinc-600">•</span>
              <span className="text-zinc-400" title="Tracks extracted from Safari">
                {extractedCount} seeds
              </span>
            </div>
          </div>

          <button
            onClick={onSyncSafari}
            disabled={isSyncing}
            title="Extract latest liked songs and history from your open Safari YouTube tabs"
            className="w-full py-1.5 px-3 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] hover:border-white/20 rounded-lg text-xs text-zinc-200 font-medium flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-rose-400 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Reading Safari DOM...' : 'Sync Active YT Tabs'}</span>
          </button>

          <div className="grid grid-cols-2 gap-1.5 mt-2">
            <button
              onClick={() => onOpenSafari && onOpenSafari('yt_liked')}
              title="Open YouTube Liked Videos playlist in Safari"
              className="py-1.5 px-2.5 bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.06] text-zinc-400 hover:text-white text-[11px] rounded-lg flex items-center justify-between transition-colors cursor-pointer"
            >
              <span>YT Likes</span>
              <ExternalLink className="w-3 h-3 text-zinc-500" />
            </button>
            <button
              onClick={() => onOpenSafari && onOpenSafari('yt_history')}
              title="Open YouTube Watch History in Safari"
              className="py-1.5 px-2.5 bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.06] text-zinc-400 hover:text-white text-[11px] rounded-lg flex items-center justify-between transition-colors cursor-pointer"
            >
              <span>YT History</span>
              <ExternalLink className="w-3 h-3 text-zinc-500" />
            </button>
          </div>
        </div>

        {/* Offline Storage Section */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-semibold">
              Offline Storage
            </span>
            <div className="flex items-center gap-1.5 text-[10px] font-mono text-emerald-400">
              <DownloadCloud className="w-3 h-3" />
              <span>{offlineCount} {offlineCount === 1 ? 'song' : 'songs'}</span>
            </div>
          </div>

          <button
            onClick={() => {
              if (onOpenOfflineTab) onOpenOfflineTab()
              if (isOpenMobile && onCloseMobile) onCloseMobile()
            }}
            title="Open Offline Downloads library"
            className="w-full py-2 px-3 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] hover:border-emerald-500/30 rounded-xl text-xs text-white font-medium flex items-center justify-between transition-colors cursor-pointer group"
          >
            <div className="flex items-center gap-2">
              <DownloadCloud className="w-3.5 h-3.5 text-emerald-400 group-hover:scale-110 transition-transform" />
              <span>Offline Library</span>
            </div>
            <span className="text-[10px] font-mono text-zinc-400">{offlineStorageSize}</span>
          </button>
        </div>

        <div className="h-[1px] bg-white/[0.08]" />

        {/* UpBeat Listening Modes List */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-semibold">
              Listening Modes
            </span>
            <Radio className="w-3 h-3 text-zinc-500" />
          </div>

          <div className="flex flex-col gap-1.5">
            {PRESET_MODES.map((p) => {
              const isSelected = activePresetId === p.id
              const displayedEnergy = isSelected ? energyLevel : p.energy
              const isModified = isSelected && energyLevel !== p.energy
              const theme = MODE_THEMES[p.theme] || MODE_THEMES.emerald

              return (
                <button
                  key={p.id}
                  onClick={() => {
                    onSelectPreset(p)
                    if (isOpenMobile && onCloseMobile) onCloseMobile()
                  }}
                  className={`w-full p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                    isSelected
                      ? `${theme.selected} shadow-md`
                      : `bg-white/[0.03] border-white/[0.06] ${theme.hover} text-zinc-300`
                  }`}
                >
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="text-xs font-semibold truncate">{p.label}</span>
                    <span className={`text-[10px] font-mono ${theme.percent}`}>
                      {displayedEnergy}%{isModified && '*'}
                    </span>
                  </div>
                  <div className="text-[11px] text-zinc-400 truncate mb-2">
                    {p.character}
                  </div>
                  <div className="h-1 rounded-full bg-white/[0.08] overflow-hidden flex">
                    <div
                      className={`h-full ${theme.barActive} transition-all duration-300`}
                      style={{ width: `${displayedEnergy}%` }}
                    />
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        <div className="h-[1px] bg-white/[0.08]" />

        {/* Global Controls: Track Count & Energy Slider */}
        <div className="flex flex-col gap-3">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-semibold">
                Curated Track Count
              </span>
              <span className="text-xs font-mono font-semibold text-white">{trackCount} songs</span>
            </div>
            <div className="flex items-center gap-1.5">
              {[4, 8, 12, 16, 24].map((count) => (
                <button
                  key={count}
                  onClick={() => setTrackCount(count)}
                  className={`flex-1 py-1 rounded-lg text-xs font-mono font-medium transition-colors cursor-pointer border ${
                    trackCount === count
                      ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                      : 'bg-white/[0.03] border-white/[0.06] text-zinc-400 hover:text-white hover:bg-white/[0.08]'
                  }`}
                >
                  {count}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-semibold">
                  Energy Bias
                </span>
                {isPresetCustomized && (
                  <button
                    onClick={() => setEnergyLevel(activePreset.energy)}
                    title="Reset energy to preset default"
                    className="text-zinc-500 hover:text-white transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-2.5 h-2.5" />
                  </button>
                )}
              </div>
              <span className="text-xs font-mono font-semibold text-rose-400">
                {energyLevel}%
              </span>
            </div>
            <input
              type="range"
              min="10"
              max="100"
              value={energyLevel}
              onChange={(e) => setEnergyLevel(parseInt(e.target.value, 10))}
              className="w-full accent-rose-500 cursor-pointer h-1 bg-white/[0.1] rounded-lg appearance-none"
            />
          </div>
        </div>

        {/* Release Version Info */}
        <div className="pt-2 text-[10px] font-mono text-zinc-500 flex flex-col gap-0.5 border-t border-white/[0.08]">
          <span className="flex items-center justify-between">
            <span className="text-zinc-400 font-medium">UpBeat v3.0+1.0</span>
          </span>
          <span className="text-zinc-500 tracking-wider" title="Evangelion: 3.0+1.0 Thrice Upon a Time">
            :|| THRICE UPON A TIME
          </span>
        </div>
      </div>

      {/* Bottom Profile Snapshot */}
      {tasteDna && (
        <div className="p-3.5 border-t border-white/[0.08] bg-[#030305]/80">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-mono uppercase text-zinc-500 font-semibold">
              Profile
            </span>
            <span className="text-[10px] font-mono text-zinc-400">
              {tasteDna.sonic_attributes?.tempo || '120-140 BPM'}
            </span>
          </div>
          <div className="text-xs font-semibold text-white truncate">
            {tasteDna.archetype || 'Listener Profile'}
          </div>
          <div className="flex flex-wrap gap-1 mt-2">
            {(tasteDna.primary_genres || []).slice(0, 3).map((g, i) => (
              <span
                key={i}
                className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/[0.06] text-zinc-400 border border-white/[0.08]"
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
      {/* Desktop View: Collapsed = 72px YouTube Music Slim Rail, Expanded = Full Drawer */}
      <div className="hidden lg:flex h-full select-none">
        {isOpenDesktop ? sidebarContent : slimRail}
      </div>

      {/* Mobile Overlay Drawer */}
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
