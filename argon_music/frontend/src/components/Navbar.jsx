import React, { useState } from 'react'
import {
  RefreshCw, Menu, Settings, Sparkles, ChevronDown, Search, Loader2, X, Check, Music
} from 'lucide-react'
import { getStoredApiKey, setStoredApiKey, getStoredServerUrl, setStoredServerUrl, hasBackend } from '../standaloneApi'
import { GoogleIcon } from './GoogleAuthModal'

export default function Navbar({
  models = [],
  selectedModel,
  onSelectModel,
  safariStatus,
  onSyncSafari,
  isSyncing,
  setActiveTab,
  onToggleSidebar,
  showKeyModal: controlledShowModal,
  setShowKeyModal: setControlledShowModal,
  prompt = '',
  setPrompt,
  onDirectSearch,
  onGenerate,
  searchMode = 'direct',
  setSearchMode,
  isGenerating = false,
  isSearching = false,
  googleUser,
  onOpenGoogleModal
}) {
  const [internalShowModal, setInternalShowModal] = useState(false)
  const showKeyModal = controlledShowModal !== undefined ? controlledShowModal : internalShowModal
  const setShowKeyModal = setControlledShowModal || setInternalShowModal

  const [apiKeyInput, setApiKeyInput] = useState(() => getStoredApiKey())
  const [serverUrlInput, setServerUrlInput] = useState(() => getStoredServerUrl())
  const [savedBanner, setSavedBanner] = useState(false)
  const [isSearchFocused, setIsSearchFocused] = useState(false)

  const hasYT = safariStatus?.has_yt
  const hasKeyOrServer = Boolean(getStoredApiKey()) || hasBackend()
  const busy = isGenerating || isSearching

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

  const handleSearchSubmit = (e) => {
    if (e) e.preventDefault()
    if (!prompt || !prompt.trim() || busy) return
    if (searchMode === 'curator' && onGenerate) {
      onGenerate(prompt)
    } else if (onDirectSearch) {
      onDirectSearch(prompt)
    }
  }

  const isAiMode = searchMode === 'curator'

  return (
    <>
      <header className="pt-safe bg-[#030305]/95 backdrop-blur-xl border-b border-white/[0.06] select-none flex-shrink-0 z-30 sticky top-0 transition-colors">
        <div className="h-14 px-3 sm:px-6 flex items-center justify-between gap-4">
          
          {/* Left: Clean Brand (No version clutter, no breadcrumbs) */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={onToggleSidebar}
              className="p-2 rounded-full hover:bg-white/[0.08] active:bg-white/[0.12] text-zinc-300 hover:text-white transition-all cursor-pointer"
              title="Toggle sidebar (Cmd+B)"
              aria-label="Toggle navigation drawer"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Clean UpBeat Brand: Music note symbol and UpBeat, nothing else */}
            <div
              onClick={() => setActiveTab && setActiveTab('curator')}
              className="flex items-center gap-2 cursor-pointer group"
              title="UpBeat"
            >
              <Music className="w-5 h-5 text-white" />
              <span className="font-bold text-white text-lg tracking-tight">UpBeat</span>
            </div>
          </div>

          {/* Center: Dispersed, Roomy Search Pill with Contextual AI Model Selector */}
          <div className="flex-1 max-w-xl lg:max-w-2xl mx-2 sm:mx-6 flex items-center justify-center min-w-0">
            <form
              onSubmit={handleSearchSubmit}
              className={`w-full h-10 sm:h-11 rounded-full flex items-center gap-2.5 px-3.5 sm:px-4 transition-all ${
                isSearchFocused
                  ? 'bg-[#18181b] border border-white/30 shadow-lg shadow-black/50 ring-1 ring-white/20'
                  : 'bg-white/[0.08] hover:bg-white/[0.12] border border-white/[0.08]'
              }`}
            >
              <button
                type="submit"
                disabled={busy}
                className="text-zinc-400 hover:text-white transition-colors cursor-pointer shrink-0"
                title="Search"
              >
                {busy ? (
                  <Loader2 className="w-4 h-4 animate-spin text-rose-400" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
              </button>

              <input
                type="text"
                value={prompt}
                onChange={(e) => setPrompt && setPrompt(e.target.value)}
                onFocus={() => setIsSearchFocused(true)}
                onBlur={() => setIsSearchFocused(false)}
                placeholder={
                  isAiMode
                    ? 'Describe mood, anime, soundtrack, or vibe for Gemini...'
                    : 'Search songs, albums, artists, podcasts...'
                }
                className="w-full bg-transparent text-xs sm:text-sm text-white placeholder:text-zinc-400 focus:outline-none min-w-0"
              />

              {/* Clear button if text present */}
              {Boolean(prompt) && !busy && (
                <button
                  type="button"
                  onClick={() => setPrompt && setPrompt('')}
                  className="p-1 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer shrink-0"
                  title="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}

              {/* AI Curate Toggle Button */}
              {setSearchMode && (
                <button
                  type="button"
                  onClick={() => setSearchMode(isAiMode ? 'direct' : 'curator')}
                  className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border transition-all shrink-0 cursor-pointer ${
                    isAiMode
                      ? 'bg-purple-500/25 text-purple-200 border-purple-500/50 shadow-sm'
                      : 'bg-white/[0.06] text-zinc-400 hover:text-white border-white/[0.08] hover:border-white/20'
                  }`}
                  title={isAiMode ? 'Switch to Regular Search' : 'Enable Gemini AI Curator'}
                >
                  <Sparkles className={`w-3.5 h-3.5 ${isAiMode ? 'text-purple-300' : 'text-zinc-400'}`} />
                  <span className="hidden sm:inline">AI Curate</span>
                </button>
              )}

              {/* AI Model Selector: ONLY VISIBLE WHEN AI CURATE IS ACTIVE (Saves space on top!) */}
              {isAiMode && models.length > 0 && (
                <div className="flex items-center gap-1 bg-purple-950/50 border border-purple-500/30 px-2 py-0.5 rounded-full text-[11px] font-mono shrink-0 animate-in fade-in duration-150">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-400 shrink-0" />
                  <select
                    value={selectedModel}
                    onChange={(e) => onSelectModel && onSelectModel(e.target.value)}
                    className="bg-transparent text-purple-200 focus:outline-none cursor-pointer max-w-[110px] sm:max-w-[150px] truncate"
                  >
                    {models.map((m) => (
                      <option key={m.id} value={m.id} className="bg-[#141418] text-white">
                        {m.name || m.id}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-2.5 h-2.5 text-purple-400 pointer-events-none -ml-0.5" />
                </div>
              )}
            </form>
          </div>

          {/* Right: Dispersed Actions (Safari Sync, Settings, User Profile) */}
          <div className="flex items-center gap-3 sm:gap-4 shrink-0">
            {/* Safari Sync Button */}
            {hasBackend() && (
              <button
                onClick={onSyncSafari}
                disabled={isSyncing}
                title="Sync playing tabs from Safari"
                className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.08] text-xs font-mono text-zinc-300 hover:text-white transition-colors cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-rose-400 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>{isSyncing ? 'Syncing...' : 'Safari'}</span>
              </button>
            )}

            {/* Settings & Setup Button */}
            <button
              onClick={() => {
                setApiKeyInput(getStoredApiKey())
                setServerUrlInput(getStoredServerUrl())
                setShowKeyModal(true)
              }}
              title="Settings & Setup"
              className={`p-2 rounded-full border text-xs flex items-center justify-center transition-colors cursor-pointer ${
                !hasKeyOrServer
                  ? 'bg-rose-500/20 border-rose-500/50 text-rose-300 animate-pulse'
                  : 'bg-white/[0.06] hover:bg-white/[0.12] border-white/[0.08] text-zinc-400 hover:text-white'
              }`}
            >
              <Settings className="w-4 h-4" />
            </button>

            {/* Google Profile Avatar */}
            {onOpenGoogleModal && (
              googleUser ? (
                <button
                  onClick={onOpenGoogleModal}
                  title={`Google Connected: ${googleUser.name || googleUser.email}`}
                  className="relative p-0.5 rounded-full border border-white/20 hover:border-white/50 transition-all cursor-pointer group"
                >
                  {googleUser.picture ? (
                    <img src={googleUser.picture} alt="" className="w-8 h-8 rounded-full object-cover" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-rose-500 via-purple-600 to-indigo-600 text-white text-xs font-bold flex items-center justify-center">
                      {(googleUser.name || 'A')[0].toUpperCase()}
                    </div>
                  )}
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-[#030305]" />
                </button>
              ) : (
                <button
                  onClick={onOpenGoogleModal}
                  title="Sign In with Google"
                  className="px-3.5 py-1.5 rounded-full border border-white/[0.15] bg-white/[0.08] hover:bg-white/[0.15] text-zinc-200 hover:text-white flex items-center gap-1.5 text-xs font-medium transition-colors cursor-pointer"
                >
                  <GoogleIcon className="w-3.5 h-3.5" />
                  <span>Sign In</span>
                </button>
              )
            )}
          </div>

        </div>
      </header>

      {/* Settings Modal */}
      {showKeyModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#131317] border border-[#262630] rounded-2xl p-5 shadow-2xl">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Settings className="w-4 h-4 text-rose-400" />
                <h3 className="text-sm font-semibold text-[#f4f4f5]">Studio Settings & Setup</h3>
              </div>
              <button
                onClick={() => setShowKeyModal(false)}
                className="p-1 rounded-md text-[#71717a] hover:text-white hover:bg-[#1c1c24] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[#a1a1aa] leading-relaxed mb-4">
              Enter your Gemini API key below for custom AI curation.
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
                  className="w-full bg-[#0d0d10] border border-[#262630] focus:border-rose-500 rounded-xl px-3 py-2.5 text-xs font-mono text-[#f4f4f5] focus:outline-none"
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
                  className="w-full bg-[#0d0d10] border border-[#262630] focus:border-rose-500 rounded-xl px-3 py-2.5 text-xs font-mono text-[#f4f4f5] focus:outline-none"
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
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 active:scale-95 text-xs font-mono font-medium text-white flex items-center gap-1.5 cursor-pointer shadow-md"
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
