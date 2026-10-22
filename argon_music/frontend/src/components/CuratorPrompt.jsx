import React from 'react'
import { Loader2, ArrowRight, Sparkles, Search, ListMusic, X } from 'lucide-react'

export default function CuratorPrompt({
  prompt,
  setPrompt,
  onGenerate,
  onDirectSearch,
  searchMode = 'direct',
  setSearchMode,
  isGenerating,
  isSearching,
  selectedModel
}) {
  const aiSuggestions = [
    'Monogatari Series / Japanese math-pop & jazz-rock',
    'Hiroyuki Sawano / Attack on Titan orchestral intensity',
    'Focused late-night coding with minimal electronic & OSTs',
    'Dark synthwave & industrial midtempo',
    'Ambient downtempo for deep problem solving'
  ]

  const directSuggestions = [
    'New Hindi Songs',
    'Hindi Hits 2025',
    'Monogatari Songs',
    'Arijit Singh Best Songs',
    'Bollywood Dance Hitlist',
    'Daft Punk'
  ]

  const busy = isGenerating || isSearching
  const activeSuggestions = searchMode === 'direct' ? directSuggestions : aiSuggestions

  const handleSubmit = (e) => {
    if (e) e.preventDefault()
    if (!prompt.trim() || busy) return
    if (searchMode === 'direct' && onDirectSearch) {
      onDirectSearch(prompt)
    } else {
      onGenerate(prompt)
    }
  }

  return (
    <div className="bg-[#0a0a0d] border-b border-[#1c1c22] px-3 sm:px-6 py-3 sm:py-4 flex-shrink-0 select-none">
      <form onSubmit={handleSubmit}>
        {/* Antigravity Floating Prompt Card */}
        <div className="relative rounded-2xl bg-[#131318] border border-[#24242e] focus-within:border-sky-500/50 hover:border-[#2f2f3c] shadow-lg shadow-black/40 transition-all p-3 sm:p-3.5">
          {/* Upper section: Input & Clear */}
          <div className="flex items-center gap-2.5">
            <div className="flex-shrink-0">
              {searchMode === 'direct' ? (
                <Search className="w-4 h-4 text-sky-400" />
              ) : (
                <Sparkles className="w-4 h-4 text-indigo-400" />
              )}
            </div>
            <input
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
                        ? 'bg-sky-500/15 text-sky-300 border border-sky-500/30 font-medium shadow-xs'
                        : 'text-[#8e8e96] hover:text-[#e4e4e7]'
                    }`}
                    title="Instant YouTube & YT Music search (0 AI tokens)"
                  >
                    <Search className="w-3 h-3" />
                    <span>Search (0 Tok)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSearchMode('ai')}
                    className={`px-2 sm:px-2.5 py-1 rounded-md flex items-center gap-1.5 transition-all cursor-pointer ${
                      searchMode === 'ai'
                        ? 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 font-medium shadow-xs'
                        : 'text-[#8e8e96] hover:text-[#e4e4e7]'
                    }`}
                    title="Custom AI playlist curation via Gemini"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>AI Curate</span>
                  </button>
                </div>
              )}

              {/* Engine / Model Indicator Pill */}
              <span className="hidden md:inline-flex items-center gap-1.5 text-[10px] font-mono px-2 py-1 rounded-md bg-[#0e0e13] border border-[#202028] text-[#8e8e96]">
                <span className={`w-1.5 h-1.5 rounded-full ${searchMode === 'direct' ? 'bg-sky-400' : 'bg-indigo-400'}`} />
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
                    ? 'bg-sky-500 hover:bg-sky-400 active:scale-95 text-white shadow-md shadow-sky-500/30'
                    : 'bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white shadow-md shadow-indigo-500/30'
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

      {/* Quick Prompt Chips */}
      <div className="flex items-center gap-1.5 mt-2.5 overflow-x-auto no-scrollbar sm:flex-wrap pb-0.5">
        <span className="text-[10px] font-mono uppercase tracking-wider text-[#71717a] mr-1 flex items-center gap-1 flex-shrink-0">
          {searchMode === 'direct' ? (
            <>
              <ListMusic className="w-3 h-3 text-sky-400" />
              <span className="text-sky-400/90">Instant (0 Tok):</span>
            </>
          ) : (
            <>
              <Sparkles className="w-3 h-3 text-indigo-400" />
              <span className="text-indigo-400/90">AI Prompts:</span>
            </>
          )}
        </span>
        {activeSuggestions.map((s, idx) => {
          const isCurrent = prompt.toLowerCase() === s.toLowerCase()
          return (
            <button
              key={idx}
              type="button"
              onClick={() => {
                setPrompt(s)
                if (searchMode === 'direct' && onDirectSearch) {
                  onDirectSearch(s)
                } else {
                  onGenerate(s)
                }
              }}
              disabled={busy}
              className={`px-2.5 py-1 rounded-md border text-[11px] whitespace-nowrap transition-all cursor-pointer flex-shrink-0 ${
                isCurrent
                  ? searchMode === 'direct'
                    ? 'bg-sky-500/15 border-sky-500/40 text-sky-200 font-medium'
                    : 'bg-indigo-500/15 border-indigo-500/40 text-indigo-200 font-medium'
                  : 'bg-[#121217] hover:bg-[#1a1a22] border-[#22222a] hover:border-[#2e2e38] text-[#a1a1aa] hover:text-[#f4f4f5]'
              }`}
            >
              {s}
            </button>
          )
        })}
      </div>
    </div>
  )
}
