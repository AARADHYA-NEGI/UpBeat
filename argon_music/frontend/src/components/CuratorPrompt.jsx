import React, { useState } from 'react'
import { Sparkles, Search, ChevronRight, SlidersHorizontal, X, Loader2, ArrowRight } from 'lucide-react'

export const MOOD_CHIPS = [
  { id: 'all', label: 'All', query: 'Popular music mix', mode: 'direct' },
  { id: 'workout', label: 'Work out', query: 'High energy workout motivation tracks', mode: 'direct' },
  { id: 'relax', label: 'Relax', query: 'Chill relaxing ambient lofi music', mode: 'direct' },
  { id: 'commute', label: 'Commute', query: 'Upbeat road trip commute music', mode: 'direct' },
  { id: 'energise', label: 'Energise', query: 'High BPM energetic electronic dance tracks', mode: 'direct' },
  { id: 'feelgood', label: 'Feel good', query: 'Happy feel good upbeat songs playlist', mode: 'direct' },
  { id: 'romance', label: 'Romance', query: 'Romantic acoustic melodies love songs', mode: 'direct' },
  { id: 'party', label: 'Party', query: 'Party club bangers dance remix', mode: 'direct' },
  { id: 'sad', label: 'Sad', query: 'Emotional melancholic slow acoustic songs', mode: 'direct' },
  { id: 'focus', label: 'Focus', query: 'Deep focus instrumental ambient electronic beats', mode: 'direct' },
  { id: 'sleep', label: 'Sleep', query: 'Deep sleep soothing ambient delta waves', mode: 'direct' },
  { id: 'anime', label: 'Anime OST', query: 'High-impact orchestral rock Hiroyuki Sawano anime openings', mode: 'direct' },
  { id: 'sawano', label: 'Hiroyuki Sawano', query: 'Hiroyuki Sawano best epic soundtrack mix', mode: 'direct' },
  { id: 'hindi', label: 'Hindi Trending', query: 'New Hindi songs latest releases', mode: 'direct' },
  { id: 'lofi', label: 'Lo-Fi', query: 'Nocturnal lofi hip hop chill study beats', mode: 'direct' }
]

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
  const [activeChip, setActiveChip] = useState('all')
  const [showAdvancedBar, setShowAdvancedBar] = useState(false)
  const busy = isGenerating || isSearching

  const handleChipClick = (chip) => {
    setActiveChip(chip.id)
    if (setPrompt) setPrompt(chip.query)
    if (chip.mode === 'direct' && onDirectSearch) {
      onDirectSearch(chip.query)
    } else if (onGenerate) {
      onGenerate(chip.query)
    }
  }

  const handleCustomSubmit = (e) => {
    if (e) e.preventDefault()
    if (!prompt.trim() || busy) return
    if (searchMode === 'direct' && onDirectSearch) {
      onDirectSearch(prompt)
    } else if (onGenerate) {
      onGenerate(prompt)
    }
  }

  return (
    <div className="bg-transparent px-3 sm:px-6 pt-3 pb-1 select-none flex-shrink-0 z-20">
      {/* Horizontal Mood / Activity Chips Carousel (Matches Screenshot Row!) */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
        {MOOD_CHIPS.map((chip) => {
          const isSelected = activeChip === chip.id
          return (
            <button
              key={chip.id}
              onClick={() => handleChipClick(chip)}
              disabled={busy}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all cursor-pointer shrink-0 border ${
                isSelected
                  ? 'bg-white text-black font-semibold border-white shadow-sm'
                  : 'bg-white/[0.08] hover:bg-white/[0.15] text-zinc-300 hover:text-white border-white/[0.06]'
              }`}
            >
              {chip.label}
            </button>
          )
        })}

        {/* Custom Prompt Toggle Pill */}
        <button
          onClick={() => setShowAdvancedBar((prev) => !prev)}
          className={`p-1.5 rounded-lg text-xs transition-colors shrink-0 cursor-pointer border ${
            showAdvancedBar
              ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
              : 'bg-white/[0.06] hover:bg-white/[0.12] text-zinc-400 hover:text-white border-white/[0.06]'
          }`}
          title="Toggle Custom Prompt & AI Fine-Tuning"
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Optional Collapsible Advanced AI Prompt Bar */}
      {showAdvancedBar && (
        <form
          onSubmit={handleCustomSubmit}
          className="mt-3 p-3 rounded-2xl bg-[#121217]/90 border border-white/10 backdrop-blur-md animate-in fade-in slide-in-from-top-2 duration-150"
        >
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-4 h-4 text-purple-400 shrink-0" />
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt && setPrompt(e.target.value)}
              placeholder="Custom AI prompt (e.g. Hiroyuki Sawano style orchestral rock with Japanese vocals)..."
              className="w-full bg-transparent text-xs sm:text-sm text-white placeholder:text-zinc-500 focus:outline-none"
              disabled={busy}
            />
            {Boolean(prompt) && !busy && (
              <button
                type="button"
                onClick={() => setPrompt && setPrompt('')}
                className="p-1 rounded-full text-zinc-400 hover:text-white hover:bg-white/10"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              type="submit"
              disabled={busy || !prompt.trim()}
              className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-30 shadow-md"
            >
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowRight className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">Curate</span>
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
