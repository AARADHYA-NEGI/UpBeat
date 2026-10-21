import React, { useState } from 'react'
import { RefreshCw, ExternalLink, SlidersHorizontal, Heart, KeyRound, X, Check } from 'lucide-react'
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
  const ytTabs = safariStatus?.yt_tabs || []
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

  return (
    <>
      <header className="pt-safe bg-[#0d0d0f] border-b border-[#222226] select-none flex-shrink-0 z-30">
        <div className="h-12 px-3 sm:px-4 flex items-center justify-between gap-2">
          {/* Left: Presets/Drawer Button, Brand & Desktop View Switcher */}
          <div className="flex items-center gap-2.5 sm:gap-6 min-w-0">
            <div className="flex items-center gap-2">
              <button
                onClick={onToggleSidebar}
                className="lg:hidden p-1.5 rounded-md bg-[#141418] border border-[#28282e] text-[#c4c4cc] active:text-white transition-colors cursor-pointer"
                title="Listening Modes & Intensity"
                aria-label="Listening Modes & Intensity"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-400" />
              </button>

              <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.6)] flex-shrink-0" />
              <span className="text-xs sm:text-[13px] font-semibold tracking-tight text-[#f5f5f5]">
                UpBeat
              </span>
              <span className="text-[11px] font-mono text-[#8e8e93] hidden md:inline">
                / studio
              </span>
            </div>

            {/* Desktop Tab Switcher (Mobile uses bottom navigation bar) */}
            <nav className="hidden sm:flex items-center gap-1">
              <button
                onClick={() => setActiveTab('curator')}
                className={`px-3 py-1 rounded-md text-xs transition-all cursor-pointer ${
                  activeTab === 'curator'
                    ? 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 font-medium'
                    : 'text-[#a3a3a3] hover:text-[#f5f5f5] hover:bg-[#16161a]'
                }`}
              >
                Curator
              </button>

              <button
                onClick={() => setActiveTab('favorites')}
                className={`px-3 py-1 rounded-md text-xs transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'favorites'
                    ? 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 font-medium'
                    : 'text-[#a3a3a3] hover:text-[#f5f5f5] hover:bg-[#16161a]'
                }`}
              >
                <Heart className={`w-3 h-3 ${favoritesCount > 0 ? 'text-rose-400 fill-rose-400' : 'text-[#8e8e93]'}`} />
                <span>Favorites</span>
                <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded ${
                  activeTab === 'favorites'
                    ? 'bg-indigo-500/20 text-indigo-200'
                    : 'bg-[#1a1a1f] text-[#a3a3a3]'
                }`}>
                  {favoritesCount}
                </span>
              </button>

              <button
                onClick={() => setActiveTab('library')}
                className={`px-3 py-1 rounded-md text-xs transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'library'
                    ? 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 font-medium'
                    : 'text-[#a3a3a3] hover:text-[#f5f5f5] hover:bg-[#16161a]'
                }`}
              >
                <span>Library</span>
                <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded ${
                  activeTab === 'library'
                    ? 'bg-indigo-500/20 text-indigo-200'
                    : 'bg-[#1a1a1f] text-[#a3a3a3]'
                }`}>
                  {extractedCount}
                </span>
              </button>

              <button
                onClick={() => setActiveTab('dna')}
                className={`px-3 py-1 rounded-md text-xs transition-all cursor-pointer ${
                  activeTab === 'dna'
                    ? 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 font-medium'
                    : 'text-[#a3a3a3] hover:text-[#f5f5f5] hover:bg-[#16161a]'
                }`}
              >
                Taste Profile
              </button>
            </nav>
          </div>

          {/* Right: Target Model Selector, API Key Button & Desktop Safari Sync */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 flex-shrink-0">
            <div className="flex items-center gap-1.5 bg-[#141418] border border-[#28282e] px-2 py-1 rounded-md text-[11px]">
              <span
                className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                  isFallback ? 'bg-amber-400' : 'bg-emerald-400'
                }`}
              />
              <span className="text-[#9ca3af] font-mono hidden xl:inline">Model:</span>
              <select
                value={selectedModel}
                onChange={(e) => onSelectModel(e.target.value)}
                className="bg-transparent text-[#f5f5f5] font-mono font-medium focus:outline-none cursor-pointer max-w-[125px] sm:max-w-[195px] truncate"
              >
                {models.map((m) => (
                  <option key={m.id} value={m.id} className="bg-[#141418] text-[#f5f5f5]">
                    {m.id}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={() => {
                setApiKeyInput(getStoredApiKey())
                setServerUrlInput(getStoredServerUrl())
                setShowKeyModal(true)
              }}
              title="API Key & Mobile Connection Settings"
              className={`px-2 py-1 rounded-md border text-[11px] flex items-center gap-1 transition-colors cursor-pointer ${
                !hasKeyOrServer
                  ? 'bg-indigo-600/25 border-indigo-500 text-indigo-200 animate-pulse'
                  : 'bg-[#141418] hover:bg-[#1e1e24] border-[#28282e] text-[#c4c4cc] hover:text-indigo-300'
              }`}
            >
              <KeyRound className="w-3.5 h-3.5 text-indigo-400" />
              <span className="hidden xs:inline sm:hidden font-mono">Key</span>
            </button>

            {hasBackend() && (
              <>
                <div className="h-4 w-[1px] bg-[#26262b] hidden md:block" />
                {hasYT ? (
                  <div className="hidden md:flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    <button
                      onClick={onSyncSafari}
                      disabled={isSyncing}
                      className="px-2.5 py-1 rounded-md bg-[#18181c] hover:bg-[#222228] border border-[#2e2e36] text-[11px] text-[#e5e5e5] flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3 h-3 text-indigo-400 ${isSyncing ? 'animate-spin' : ''}`} />
                      <span>{isSyncing ? 'Syncing' : 'Sync Safari'}</span>
                    </button>
                  </div>
                ) : (
                  <div className="hidden md:flex items-center gap-2">
                    <button
                      onClick={() => onOpenSafari('yt_liked')}
                      className="px-2.5 py-1 rounded-md bg-[#18181c] hover:bg-[#222228] border border-[#2e2e36] text-[11px] text-[#e5e5e5] flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <span>Open YT</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </header>

      {/* Mobile / Standalone API Configuration Modal */}
      {showKeyModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#121216] border border-[#282830] rounded-xl p-5 shadow-2xl">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-indigo-400" />
                <h3 className="text-sm font-semibold text-white">UpBeat Mobile & API Setup</h3>
              </div>
              <button
                onClick={() => setShowKeyModal(false)}
                className="p-1 text-[#8e8e93] hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[#a3a3a3] leading-relaxed mb-4">
              To curate playlists directly on your Android phone (on 5G or any Wi-Fi), paste your Gemini API Key below. Optionally, you can also enter your Mac's LAN address when on home Wi-Fi.
            </p>

            <form onSubmit={handleSaveSettings} className="space-y-3.5">
              <div>
                <label className="block text-[11px] font-mono uppercase tracking-wider text-[#b4b4b8] mb-1">
                  Gemini API Key (Recommended for Mobile)
                </label>
                <input
                  type="password"
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  placeholder="AIzaSy..."
                  className="w-full bg-[#0d0d0f] border border-[#282830] focus:border-indigo-500 rounded-lg px-3 py-2.5 text-xs font-mono text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-mono uppercase tracking-wider text-[#b4b4b8] mb-1">
                  Optional Mac Server URL (Home Wi-Fi)
                </label>
                <input
                  type="text"
                  value={serverUrlInput}
                  onChange={(e) => setServerUrlInput(e.target.value)}
                  placeholder="http://192.168.1.4:8000 (leave empty for standalone)"
                  className="w-full bg-[#0d0d0f] border border-[#282830] focus:border-indigo-500 rounded-lg px-3 py-2.5 text-xs font-mono text-white focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowKeyModal(false)}
                  className="px-3 py-2 rounded-lg text-xs text-[#a3a3a3] hover:text-white cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-medium text-white flex items-center gap-1.5 cursor-pointer"
                >
                  {savedBanner ? <Check className="w-3.5 h-3.5" /> : null}
                  <span>{savedBanner ? 'Saved!' : 'Save & Continue'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
