import React from 'react'
import { Loader2, CornerDownLeft, Sparkles, Search, ListMusic } from 'lucide-react'

export default function CuratorPrompt({
  prompt,
  setPrompt,
  onGenerate,
  onDirectSearch,
  searchMode = 'direct',
  setSearchMode,
  isGenerating,
  isSearching
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
    e.preventDefault()
    if (!prompt.trim() || busy) return
    if (searchMode === 'direct' && onDirectSearch) {
      onDirectSearch(prompt)
    } else {
      onGenerate(prompt)
    }
  }

  return (
    <div className="border-b border-[#222226] bg-[#0d0d0f] px-3.5 py-2.5 sm:px-6 sm:py-3.5 flex-shrink-0">
      <form onSubmit={handleSubmit} className="flex items-center gap-1.5 sm:gap-2">
        {/* Mode Toggle Pill inside/beside input */}
        {setSearchMode && (
          <div className="hidden md:flex items-center bg-[#131317] border border-[#2a2a32] rounded-lg p-0.5 text-[11px] font-mono flex-shrink-0">
            <button
              type="button"
              onClick={() => setSearchMode('direct')}
              className={`px-2.5 py-1.5 rounded-md flex items-center gap-1.5 transition-colors cursor-pointer ${
                searchMode === 'direct'
                  ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-500/40 font-semibold'
                  : 'text-[#9ca3af] hover:text-[#e4e4e7]'
              }`}
              title="Direct YouTube Music search for playlists & songs (0 AI tokens)"
            >
              <Search className="w-3 h-3" />
              <span>Search (0 Tokens)</span>
            </button>
            <button
              type="button"
              onClick={() => setSearchMode('ai')}
              className={`px-2.5 py-1.5 rounded-md flex items-center gap-1.5 transition-colors cursor-pointer ${
                searchMode === 'ai'
                  ? 'bg-indigo-500/20 text-indigo-200 border border-indigo-500/40 font-semibold'
                  : 'text-[#9ca3af] hover:text-[#e4e4e7]'
              }`}
              title="Custom AI playlist curation via Gemini"
            >
              <Sparkles className="w-3 h-3" />
              <span>AI Curate</span>
            </button>
          </div>
        )}

        <div className={`flex-1 flex items-center bg-[#131317] border rounded-lg px-3 py-2 transition-colors min-w-0 ${
          searchMode === 'direct'
            ? 'border-[#2a2a32] focus-within:border-emerald-500/70'
            : 'border-[#2a2a32] focus-within:border-indigo-500/70'
        }`}>
          {searchMode === 'direct' ? (
            <Search className="w-3.5 h-3.5 text-emerald-400 mr-2 flex-shrink-0" />
          ) : (
            <span className="text-xs font-mono text-indigo-400 mr-2 select-none font-semibold">
              &gt;
            </span>
          )}
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={
              searchMode === 'direct'
                ? 'Search playlist or song (e.g. "new hindi songs", "kesariya") — 0 tokens...'
                : 'Describe mood, anime, soundtrack, or vibe for AI curation...'
            }
            className="w-full bg-transparent text-xs sm:text-sm text-[#f5f5f5] placeholder:text-[#73737a] focus:outline-none min-w-0"
          />
        </div>

        {/* Direct Search Button (0 Tokens — always accessible with 1 tap) */}
        {onDirectSearch && (
          <button
            type="button"
            onClick={() => {
              if (!prompt.trim() || busy) return
              if (setSearchMode) setSearchMode('direct')
              onDirectSearch(prompt)
            }}
            disabled={busy || !prompt.trim()}
            title="Direct Search for prepared playlists & songs (0 AI tokens)"
            className={`px-3 sm:px-3.5 py-2 rounded-lg font-medium text-xs flex items-center gap-1.5 transition-all disabled:opacity-40 cursor-pointer flex-shrink-0 border ${
              searchMode === 'direct'
                ? 'bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-500 text-white border-emerald-500/50 shadow-sm shadow-emerald-500/20'
                : 'bg-[#17171d] hover:bg-[#202028] text-[#e4e4e7] border-[#2e2e38]'
            }`}
          >
            {isSearching ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span className="hidden xs:inline">Searching</span>
              </>
            ) : (
              <>
                <Search className="w-3.5 h-3.5" />
                <span>Search</span>
              </>
            )}
          </button>
        )}

        {/* AI Curate Button */}
        <button
          type="button"
          onClick={() => {
            if (!prompt.trim() || busy) return
            if (setSearchMode) setSearchMode('ai')
            onGenerate(prompt)
          }}
          disabled={busy || !prompt.trim()}
          title="Generate custom AI playlist with Gemini"
          className={`px-3 sm:px-3.5 py-2 rounded-lg font-medium text-xs flex items-center gap-1.5 transition-all disabled:opacity-40 cursor-pointer flex-shrink-0 border ${
            searchMode === 'ai'
              ? 'bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-500 text-white border-indigo-500/50 shadow-sm shadow-indigo-500/20'
              : 'bg-[#17171d] hover:bg-[#202028] text-indigo-300 border-indigo-500/30'
          }`}
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span className="hidden xs:inline">Curating</span>
            </>
          ) : (
            <>
              <Sparkles className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">AI Curate</span>
              <span className="sm:hidden">AI</span>
              <CornerDownLeft className="w-3.5 h-3.5 opacity-80 hidden lg:inline" />
            </>
          )}
        </button>
      </form>

      {/* Single-row horizontal scroll on mobile, wrapping chips on desktop */}
      <div className="flex items-center gap-1.5 mt-2 overflow-x-auto no-scrollbar sm:flex-wrap pb-0.5">
        <span className="text-[10px] font-mono uppercase tracking-wider text-[#73737a] mr-1 flex items-center gap-1 flex-shrink-0">
          {searchMode === 'direct' ? (
            <>
              <ListMusic className="w-3 h-3 text-emerald-400" />
              <span className="text-emerald-400/90">Instant (0 Tokens):</span>
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
              className={`px-2.5 py-1 rounded-md border text-[11px] whitespace-nowrap transition-colors cursor-pointer flex-shrink-0 ${
                isCurrent
                  ? searchMode === 'direct'
                    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-200 font-medium'
                    : 'bg-indigo-500/15 border-indigo-500/40 text-indigo-200 font-medium'
                  : 'bg-[#141418] hover:bg-[#1e1e24] border-[#26262e] text-[#b4b4b8] hover:text-[#f5f5f5]'
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
