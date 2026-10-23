import React, { useRef, useEffect } from 'react'
import { Loader2, ArrowRight, Sparkles, Search, X } from 'lucide-react'

export default function CuratorPrompt({
  prompt,
  setPrompt,
  onGenerate,
  onDirectSearch,
  searchMode = 'direct',
  setSearchMode,
  isGenerating,
  isSearching,
  selectedModel,
  isOpen = true,
  onClose,
  onOpen
}) {
  const busy = isGenerating || isSearching
  const inputRef = useRef(null)

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  const handleSubmit = (e) => {
    if (e) e.preventDefault()
    if (!prompt.trim() || busy) return
    if (searchMode === 'direct' && onDirectSearch) {
      onDirectSearch(prompt)
    } else {
      onGenerate(prompt)
    }
  }

  if (!isOpen) {
    return (
      <div className="bg-[#0a0a0d] px-3 sm:px-6 pt-2.5 pb-1 select-none flex-shrink-0">
        <button
          onClick={onOpen}
          className="w-full px-3.5 py-2 rounded-xl bg-[#131318]/90 hover:bg-[#181822] border border-[#22222a] hover:border-sky-500/40 text-left flex items-center justify-between gap-3 text-xs text-[#71717a] hover:text-[#e4e4e7] transition-all cursor-pointer shadow-xs group"
        >
          <div className="flex items-center gap-2.5 truncate">
            <Search className="w-3.5 h-3.5 text-sky-400 group-hover:scale-110 transition-transform" />
            <span className="truncate">{prompt ? `"${prompt}"` : 'Search any song, artist, playlist, or AI vibe...'}</span>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#1c1c24] text-[#8e8e96] shrink-0 border border-[#262630] group-hover:text-sky-300">
            Open Search
          </span>
        </button>
      </div>
    )
  }

  return (
    <div className="bg-[#0a0a0d] border-b border-[#1c1c22] px-3 sm:px-6 py-3 sm:py-3.5 flex-shrink-0 select-none animate-in fade-in slide-in-from-top-2 duration-150">
      <form onSubmit={handleSubmit}>
        {/* Antigravity Floating Prompt Card */}
        <div className="relative rounded-2xl bg-[#131318] border border-[#24242e] focus-within:border-sky-500/50 hover:border-[#2f2f3c] shadow-lg shadow-black/40 transition-all p-3 sm:p-3.5">
          {/* Upper section: Input & Clear & Close */}
          <div className="flex items-center gap-2.5">
            <div className="flex-shrink-0">
              {searchMode === 'direct' ? (
                <Search className="w-4 h-4 text-emerald-400" />
              ) : (
                <Sparkles className="w-4 h-4 text-purple-400" />
              )}
            </div>
            <input
              ref={inputRef}
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSubmit(e)
                }
              }}
              placeholder={
                searchMode === 'direct'
                  ? 'Search any song, artist, album, or YouTube playlist (0 tokens)...'
                  : 'Describe mood, anime, soundtrack, or vibe for AI curation...'
              }
              className="w-full bg-transparent text-xs sm:text-sm text-[#f4f4f5] placeholder:text-[#6e6e78] focus:outline-none min-w-0 font-normal"
              disabled={busy}
            />
            {Boolean(prompt) && !busy && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setPrompt('')
                }}
                className="p-1 rounded-md text-[#71717a] hover:text-[#f4f4f5] hover:bg-[#1e1e26] transition-colors cursor-pointer flex-shrink-0"
                title="Clear text"
                aria-label="Clear text"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="p-1 rounded-md text-[#71717a] hover:text-white hover:bg-[#1e1e26] transition-colors cursor-pointer flex-shrink-0"
                title="Collapse Search Bar"
                aria-label="Collapse"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Divider line */}
          <div className="h-[1px] bg-[#1d1d24] my-2.5" />

          {/* Lower section: Mode selector pills + circular Antigravity action button */}
          <div className="flex items-center justify-between gap-2 pt-0.5">
            {/* Mode selector pills */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {setSearchMode && (
                <div className="flex items-center bg-[#0d0d11] border border-[#22222a] rounded-lg p-0.5 text-[11px] font-mono">
                  <button
                    type="button"
                    onClick={() => setSearchMode('direct')}
                    className={`px-2 sm:px-2.5 py-1 rounded-md flex items-center gap-1.5 transition-all cursor-pointer ${
                      searchMode === 'direct'
                        ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/40 font-semibold shadow-xs'
                        : 'text-[#8e8e96] hover:text-[#e4e4e7]'
                    }`}
                    title="Instant YouTube & YT Music search (0 AI tokens)"
                  >
                    <Search className="w-3 h-3 text-emerald-400" />
                    <span>Search (0 Tok)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSearchMode('ai')}
                    className={`px-2 sm:px-2.5 py-1 rounded-md flex items-center gap-1.5 transition-all cursor-pointer ${
                      searchMode === 'ai'
                        ? 'bg-purple-500/20 text-purple-200 border border-purple-500/40 font-semibold shadow-xs'
                        : 'text-[#8e8e96] hover:text-[#e4e4e7]'
                    }`}
                    title="Custom AI playlist curation via Gemini"
                  >
                    <Sparkles className="w-3 h-3 text-purple-400" />
                    <span>AI Curate</span>
                  </button>
                </div>
              )}

              {/* Engine / Model Indicator Pill */}
              <span className="hidden md:inline-flex items-center gap-1.5 text-[10px] font-mono px-2 py-1 rounded-md bg-[#0e0e13] border border-[#202028] text-[#8e8e96]">
                <span className={`w-1.5 h-1.5 rounded-full ${searchMode === 'direct' ? 'bg-emerald-400' : 'bg-purple-400'}`} />
                <span>{searchMode === 'direct' ? 'Direct Match • 0 Tok' : (selectedModel || 'Gemini 3.8 Flash')}</span>
              </span>
            </div>

            {/* Right: Enter hint + Antigravity circular submit button */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="hidden sm:inline text-[10px] font-mono text-[#52525b] select-none">
                ↵ Enter
              </span>

              <button
                type="submit"
                disabled={busy || !prompt.trim()}
                title={searchMode === 'direct' ? 'Execute Direct Search' : 'Execute AI Curation'}
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${
                  searchMode === 'direct'
                    ? 'bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-white shadow-md shadow-emerald-500/30'
                    : 'bg-gradient-to-tr from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 active:scale-95 text-white shadow-md shadow-purple-500/30'
                }`}
              >
                {busy ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ArrowRight className="w-4 h-4 stroke-[2.5]" />
                )}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}
