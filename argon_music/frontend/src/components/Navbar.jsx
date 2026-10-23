import React, { useState } from 'react'
import {
  RefreshCw, ExternalLink, PanelLeft, Heart, KeyRound,
  X, Check, Settings, Sparkles, Layers, Fingerprint, ChevronDown, DownloadCloud
} from 'lucide-react'
import { getStoredApiKey, setStoredApiKey, getStoredServerUrl, setStoredServerUrl, hasBackend } from '../standaloneApi'

export default function Navbar({
  models = [],
  selectedModel,
  onSelectModel,
  lastModelStatus,
  safariStatus,
  onSyncSafari,
  onOpenSafari,
  isSyncing,
  activeTab,
  setActiveTab,
  extractedCount = 0,
  favoritesCount = 0,
  offlineCount = 0,
  isSidebarOpen = true,
  onToggleSidebar,
  showKeyModal: controlledShowModal,
  setShowKeyModal: setControlledShowModal
}) {
  const [internalShowModal, setInternalShowModal] = useState(false)
  const showKeyModal = controlledShowModal !== undefined ? controlledShowModal : internalShowModal
  const setShowKeyModal = setControlledShowModal || setInternalShowModal

  const [apiKeyInput, setApiKeyInput] = useState(() => getStoredApiKey())
  const [serverUrlInput, setServerUrlInput] = useState(() => getStoredServerUrl())
  const [savedBanner, setSavedBanner] = useState(false)

  const hasYT = safariStatus?.has_yt
  const isFallback = lastModelStatus?.isFallback
  const hasKeyOrServer = Boolean(getStoredApiKey()) || hasBackend()

  const handleSaveSettings = (e) => {
    e.preventDefault()
    setStoredApiKey(apiKeyInput)
    setStoredServerUrl(serverUrlInput)
    setSavedBanner(true)
    setTimeout(() => {
      setSavedBanner(false)
      setShowKeyModal(false)
    }, 550)
  }

  const getBreadcrumbTitle = () => {
    if (activeTab === 'favorites') return 'Liked Favorites'
    if (activeTab === 'library') return 'Seed Library'
    if (activeTab === 'dna') return 'Taste Profile'
    if (activeTab === 'offline') return 'Offline Downloads'
    return 'Curator Studio'
  }

  return (
    <>
      <header className="pt-safe bg-[#0d0d10] border-b border-[#202026] select-none flex-shrink-0 z-30">
        <div className="h-12 px-3 sm:px-4 flex items-center justify-between gap-3">
          {/* Left: Antigravity Breadcrumbs & Sidebar Toggle */}
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              onClick={onToggleSidebar}
              className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                isSidebarOpen
                  ? 'bg-[#181822] border-[#2c2c38] text-sky-400 shadow-xs'
                  : 'bg-[#141418] border-[#24242c] text-[#8e8e96] hover:text-[#f4f4f5] hover:border-[#32323c]'
              }`}
              title={isSidebarOpen ? "Collapse sidebar (Cmd+B)" : "Expand sidebar (Cmd+B)"}
              aria-label="Toggle sidebar"
            >
              <PanelLeft className="w-4 h-4" />
            </button>

            {/* Breadcrumb Navigation */}
            <div className="flex items-center gap-1.5 text-xs font-mono min-w-0">
              <span
                onClick={() => setActiveTab('curator')}
                className="text-[#71717a] hover:text-[#e4e4e7] transition-colors cursor-pointer truncate hidden sm:inline"
                title="UpBeat v3.0+1.0 :|| Thrice Upon a Time"
              >
                UpBeat
              </span>
              <span className="hidden sm:inline-block text-[9px] font-mono px-1 py-0.2 rounded bg-[#181820] text-[#71717a] border border-[#24242e]" title="Evangelion: 3.0+1.0 Thrice Upon a Time">
                3.0+1.0 :||
              </span>
              <span className="text-[#3f3f46] hidden sm:inline">/</span>
              <div className="flex items-center gap-1.5 truncate">
                <span className="text-[#f4f4f5] font-medium tracking-tight truncate">
                  {getBreadcrumbTitle()}
                </span>
                <span
                  className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)] flex-shrink-0"
                  title="Engine Online"
                />
              </div>
            </div>
          </div>

          {/* Center: Desktop Antigravity View Switcher */}
          <nav className="hidden lg:flex items-center gap-1 bg-[#121216] border border-[#22222a] p-0.5 rounded-lg text-xs font-mono">
            <button
              onClick={() => setActiveTab('curator')}
              className={`px-3 py-1 rounded-md transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'curator'
                  ? 'bg-[#1e1e26] text-[#f4f4f5] font-medium shadow-xs border border-[#2c2c38]'
                  : 'text-[#8e8e96] hover:text-[#e4e4e7]'
              }`}
            >
              <Sparkles className="w-3 h-3 text-sky-400" />
              <span>Curator</span>
            </button>

            <button
              onClick={() => setActiveTab('favorites')}
              className={`px-3 py-1 rounded-md transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'favorites'
                  ? 'bg-[#1e1e26] text-[#f4f4f5] font-medium shadow-xs border border-[#2c2c38]'
                  : 'text-[#8e8e96] hover:text-[#e4e4e7]'
              }`}
            >
              <Heart className={`w-3 h-3 ${favoritesCount > 0 ? 'text-rose-400 fill-rose-400' : 'text-[#8e8e96]'}`} />
              <span>Favorites</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-[#181820] text-[#a1a1aa] border border-[#262632]">
                {favoritesCount}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('library')}
              className={`px-3 py-1 rounded-md transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'library'
                  ? 'bg-[#1e1e26] text-[#f4f4f5] font-medium shadow-xs border border-[#2c2c38]'
                  : 'text-[#8e8e96] hover:text-[#e4e4e7]'
              }`}
            >
              <Layers className="w-3 h-3 text-indigo-400" />
              <span>Seeds</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-[#181820] text-[#a1a1aa] border border-[#262632]">
                {extractedCount}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('dna')}
              className={`px-3 py-1 rounded-md transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'dna'
                  ? 'bg-[#1e1e26] text-[#f4f4f5] font-medium shadow-xs border border-[#2c2c38]'
                  : 'text-[#8e8e96] hover:text-[#e4e4e7]'
              }`}
            >
              <Fingerprint className="w-3 h-3 text-emerald-400" />
              <span>Taste DNA</span>
            </button>

            <button
              onClick={() => setActiveTab('offline')}
              className={`px-3 py-1 rounded-md transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'offline'
                  ? 'bg-[#1e1e26] text-[#f4f4f5] font-medium shadow-xs border border-emerald-500/30'
                  : 'text-[#8e8e96] hover:text-[#e4e4e7]'
              }`}
            >
              <DownloadCloud className="w-3 h-3 text-emerald-400" />
              <span>Offline</span>
              {offlineCount > 0 && (
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                  {offlineCount}
                </span>
              )}
            </button>
          </nav>

          {/* Right: Antigravity Model Pill, Sync & Settings */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Model Pill matching the Antigravity prompt bar dropdown */}
            <div className="flex items-center gap-1.5 bg-[#141418] hover:bg-[#181820] border border-[#24242c] hover:border-[#2f2f3a] px-2.5 py-1 rounded-lg text-xs font-mono transition-colors">
              <span
                className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                  isFallback ? 'bg-amber-400' : 'bg-sky-400'
                }`}
              />
              <select
                value={selectedModel}
                onChange={(e) => onSelectModel(e.target.value)}
                className="bg-transparent text-[#e4e4e7] focus:outline-none cursor-pointer max-w-[130px] sm:max-w-[190px] truncate"
              >
                {models.map((m) => (
                  <option key={m.id} value={m.id} className="bg-[#141418] text-[#f4f4f5]">
                    {m.name || m.id}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3 h-3 text-[#71717a] pointer-events-none -ml-0.5" />
            </div>

            {/* Desktop Safari Sync Button */}
            {hasBackend() && (
              <>
                {hasYT ? (
                  <button
                    onClick={onSyncSafari}
                    disabled={isSyncing}
                    title="Sync actively playing YouTube tabs from Safari"
                    className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#141418] hover:bg-[#1a1a20] border border-[#24242c] text-xs font-mono text-[#e4e4e7] transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3 h-3 text-sky-400 ${isSyncing ? 'animate-spin' : ''}`} />
                    <span>{isSyncing ? 'Syncing...' : 'Safari'}</span>
                  </button>
                ) : (
                  <button
                    onClick={() => onOpenSafari('yt_liked')}
                    title="Open YouTube Music in Safari"
                    className="hidden md:flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#141418] hover:bg-[#1a1a20] border border-[#24242c] text-xs font-mono text-[#a1a1aa] hover:text-[#f4f4f5] transition-colors cursor-pointer"
                  >
                    <span>Safari</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                )}
              </>
            )}

            {/* Settings & Setup Button */}
            <button
              onClick={() => {
                setApiKeyInput(getStoredApiKey())
                setServerUrlInput(getStoredServerUrl())
                setShowKeyModal(true)
              }}
              title="Settings & Gemini API Key Setup"
              className={`p-1.5 rounded-lg border text-xs font-mono flex items-center justify-center transition-colors cursor-pointer ${
                !hasKeyOrServer
                  ? 'bg-sky-500/20 border-sky-400 text-sky-300 animate-pulse'
                  : 'bg-[#141418] hover:bg-[#1a1a20] border-[#24242c] hover:border-[#32323c] text-[#a1a1aa] hover:text-white'
              }`}
            >
              <Settings className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* Antigravity Settings Modal */}
      {showKeyModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#131317] border border-[#262630] rounded-2xl p-5 shadow-2xl">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Settings className="w-4 h-4 text-sky-400" />
                <h3 className="text-sm font-semibold text-[#f4f4f5]">Studio Settings & Engine Setup</h3>
              </div>
              <button
                onClick={() => setShowKeyModal(false)}
                className="p-1 rounded-md text-[#71717a] hover:text-white hover:bg-[#1c1c24] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[#a1a1aa] leading-relaxed mb-4">
              To curate AI playlists directly on mobile devices without relying on a Mac host, enter your Gemini API Key below. On your local home network, you can optionally configure your Mac's backend URL.
            </p>

            <form onSubmit={handleSaveSettings} className="space-y-3.5">
              <div>
                <label className="block text-[11px] font-mono uppercase tracking-wider text-[#a1a1aa] mb-1.5">
                  Gemini API Key
                </label>
                <input
                  type="password"
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  placeholder="AIzaSy..."
                  className="w-full bg-[#0d0d10] border border-[#262630] focus:border-sky-500 rounded-xl px-3 py-2.5 text-xs font-mono text-[#f4f4f5] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-mono uppercase tracking-wider text-[#a1a1aa] mb-1.5">
                  Mac Backend Server URL (Optional)
                </label>
                <input
                  type="text"
                  value={serverUrlInput}
                  onChange={(e) => setServerUrlInput(e.target.value)}
                  placeholder="http://192.168.1.4:8000"
                  className="w-full bg-[#0d0d10] border border-[#262630] focus:border-sky-500 rounded-xl px-3 py-2.5 text-xs font-mono text-[#f4f4f5] focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowKeyModal(false)}
                  className="px-3 py-2 rounded-xl text-xs font-mono text-[#a1a1aa] hover:text-white hover:bg-[#181820] cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 active:scale-95 text-xs font-mono font-medium text-white flex items-center gap-1.5 cursor-pointer shadow-md"
                >
                  {savedBanner ? <Check className="w-3.5 h-3.5" /> : null}
                  <span>{savedBanner ? 'Saved' : 'Save Changes'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
