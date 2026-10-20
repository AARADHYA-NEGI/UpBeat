import React, { useState } from 'react'
import { RefreshCw, ExternalLink, PanelLeft, Heart, KeyRound, X, Check } from 'lucide-react'
import { getStoredApiKey, setStoredApiKey, getStoredServerUrl, setStoredServerUrl } from '../standaloneApi'

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
  onToggleSidebar
}) {
  const [showKeyModal, setShowKeyModal] = useState(false)
  const [apiKeyInput, setApiKeyInput] = useState(() => getStoredApiKey())
  const [serverUrlInput, setServerUrlInput] = useState(() => getStoredServerUrl())
  const [savedBanner, setSavedBanner] = useState(false)

  const hasYT = safariStatus?.has_yt
  const ytTabs = safariStatus?.yt_tabs || []

  const isFallback = lastModelStatus?.isFallback
  const statusTooltip = isFallback
    ? `Target model (${selectedModel}) fell back to ${lastModelStatus.usedModel}: ${lastModelStatus.reason}`
    : `Target model (${selectedModel}) is active and responding directly`

  const handleSaveSettings = (e) => {
    e.preventDefault()
    setStoredApiKey(apiKeyInput)
    setStoredServerUrl(serverUrlInput)
    setSavedBanner(true)
    setTimeout(() => {
      setSavedBanner(false)
      setShowKeyModal(false)
    }, 650)
  }

  return (
    <>
      <header className="h-12 bg-[#0d0d0f] border-b border-[#222226] px-3 sm:px-4 flex items-center justify-between select-none flex-shrink-0 z-30">
        {/* Left: Mobile Drawer Button, Brand & View Switcher */}
        <div className="flex items-center gap-3 sm:gap-6">
          <div className="flex items-center gap-2">
            <button
              onClick={onToggleSidebar}
              className="lg:hidden p-1.5 rounded hover:bg-[#1c1c21] text-[#a3a3a3] hover:text-white transition-colors cursor-pointer"
              title="Toggle Sidebar Controls"
              aria-label="Toggle Sidebar Controls"
            >
              <PanelLeft className="w-4 h-4" />
            </button>

            <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.6)]" />
            <span className="text-xs font-semibold tracking-tight text-[#f5f5f5]">
              UpBeat
            </span>
            <span className="text-[11px] font-mono text-[#8e8e93] hidden sm:inline">
              / studio
            </span>
          </div>

          <nav className="flex items-center gap-1">
            <button
              onClick={() => setActiveTab('curator')}
              className={`px-2.5 sm:px-3 py-1 rounded-md text-xs transition-all cursor-pointer ${
                activeTab === 'curator'
                  ? 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 font-medium'
                  : 'text-[#a3a3a3] hover:text-[#f5f5f5] hover:bg-[#16161a]'
              }`}
            >
              Curator
            </button>

            <button
              onClick={() => setActiveTab('favorites')}
              className={`px-2.5 sm:px-3 py-1 rounded-md text-xs transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'favorites'
                  ? 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 font-medium'
                  : 'text-[#a3a3a3] hover:text-[#f5f5f5] hover:bg-[#16161a]'
              }`}
              title="View songs saved in your persistent Favorites memory"
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
              className={`px-2.5 sm:px-3 py-1 rounded-md text-xs transition-all hidden md:flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'library'
                  ? 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 font-medium'
                  : 'text-[#a3a3a3] hover:text-[#f5f5f5] hover:bg-[#16161a]'
              }`}
              title="View raw tracks synced from your Safari YouTube tabs"
            >
              <span>Safari Library</span>
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
              className={`px-2.5 sm:px-3 py-1 rounded-md text-xs transition-all cursor-pointer hidden sm:inline-flex ${
                activeTab === 'dna'
                  ? 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 font-medium'
                  : 'text-[#a3a3a3] hover:text-[#f5f5f5] hover:bg-[#16161a]'
              }`}
            >
              Taste Profile
            </button>
          </nav>
        </div>

        {/* Right: Target Model, API/Mobile Settings & Safari Bridge */}
        <div className="flex items-center gap-2 sm:gap-3">
          <div
            className="flex items-center gap-1.5 sm:gap-2 bg-[#141418] border border-[#28282e] px-2 sm:px-2.5 py-1 rounded-md text-[11px]"
            title={statusTooltip}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                isFallback ? 'bg-amber-400' : 'bg-emerald-400'
              }`}
            />
            <span className="text-[#9ca3af] font-mono hidden md:inline">Target Model:</span>
            <select
              value={selectedModel}
              onChange={(e) => onSelectModel(e.target.value)}
              className="bg-transparent text-[#f5f5f5] font-mono font-medium focus:outline-none cursor-pointer max-w-[130px] sm:max-w-[210px] truncate"
            >
              {models.map((m) => (
                <option key={m.id} value={m.id} className="bg-[#141418] text-[#f5f5f5]">
                  {m.name ? `${m.id} — ${m.name}` : m.id}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => setShowKeyModal(true)}
            title="Configure Gemini API Key & Mobile Server Connection"
            className="p-1.5 rounded-md bg-[#141418] hover:bg-[#1e1e24] border border-[#28282e] text-[#a3a3a3] hover:text-indigo-300 transition-colors cursor-pointer"
          >
            <KeyRound className="w-3.5 h-3.5" />
          </button>

          <div className="h-4 w-[1px] bg-[#26262b] hidden sm:block" />

          {hasYT ? (
            <div className="hidden sm:flex items-center gap-2.5">
              <div
                className="hidden md:flex items-center gap-1.5 text-[11px] text-[#b4b4b8] font-mono"
                title={`Connected to Safari tab: ${ytTabs[0]?.title || 'YouTube'}`}
              >
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span className="truncate max-w-[140px]">
                  {ytTabs[0]?.title || 'Safari Connected'}
                </span>
              </div>
              <button
                onClick={onSyncSafari}
                disabled={isSyncing}
                title="Pull latest liked videos and history from open Safari YouTube tabs"
                className="px-2.5 py-1 rounded-md bg-[#18181c] hover:bg-[#222228] border border-[#2e2e36] text-[11px] text-[#e5e5e5] flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 text-indigo-400 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>{isSyncing ? 'Syncing' : 'Sync Safari'}</span>
              </button>
            </div>
          ) : (
            <div className="hidden sm:flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#737373]" />
              <span className="text-[11px] text-[#a3a3a3] font-mono hidden md:inline">
                No YouTube tab
              </span>
              <button
                onClick={() => onOpenSafari('yt_liked')}
                title="Open your YouTube Liked Videos playlist in Safari"
                className="px-2.5 py-1 rounded-md bg-[#18181c] hover:bg-[#222228] border border-[#2e2e36] text-[11px] text-[#e5e5e5] flex items-center gap-1 transition-colors cursor-pointer"
              >
                <span>Open YT Likes</span>
                <ExternalLink className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Mobile / Standalone API Configuration Modal */}
      {showKeyModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#121216] border border-[#282830] rounded-xl p-5 shadow-2xl">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-indigo-400" />
                <h3 className="text-sm font-semibold text-white">UpBeat Mobile & API Settings</h3>
              </div>
              <button
                onClick={() => setShowKeyModal(false)}
                className="p-1 text-[#8e8e93] hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[#a3a3a3] leading-relaxed mb-4">
              On macOS, UpBeat uses your local backend automatically. On Android APK / standalone mobile mode, enter your Gemini API Key (or your Mac's LAN URL) to curate anywhere.
            </p>

            <form onSubmit={handleSaveSettings} className="space-y-3.5">
              <div>
                <label className="block text-[11px] font-mono uppercase tracking-wider text-[#b4b4b8] mb-1">
                  Gemini API Key (For Standalone Android APK)
                </label>
                <input
                  type="password"
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  placeholder="AIzaSy..."
                  className="w-full bg-[#0d0d0f] border border-[#282830] focus:border-indigo-500 rounded-md px-3 py-2 text-xs font-mono text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-mono uppercase tracking-wider text-[#b4b4b8] mb-1">
                  Optional Mac Server URL (Wi-Fi Sync)
                </label>
                <input
                  type="text"
                  value={serverUrlInput}
                  onChange={(e) => setServerUrlInput(e.target.value)}
                  placeholder="e.g. http://192.168.1.10:8000 (leave empty on Mac)"
                  className="w-full bg-[#0d0d0f] border border-[#282830] focus:border-indigo-500 rounded-md px-3 py-2 text-xs font-mono text-white focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowKeyModal(false)}
                  className="px-3 py-1.5 rounded-md text-xs text-[#a3a3a3] hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-md bg-indigo-600 hover:bg-indigo-500 text-xs font-medium text-white flex items-center gap-1.5 cursor-pointer"
                >
                  {savedBanner ? <Check className="w-3.5 h-3.5" /> : null}
                  <span>{savedBanner ? 'Saved' : 'Save Settings'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
