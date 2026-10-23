import React, { useState } from 'react'

export const MOOD_CHIPS = [
  { id: 'all', label: 'All', query: 'Popular music mix' },
  { id: 'workout', label: 'Work out', query: 'High energy workout motivation tracks' },
  { id: 'relax', label: 'Relax', query: 'Chill relaxing ambient lofi music' },
  { id: 'commute', label: 'Commute', query: 'Upbeat road trip commute music' },
  { id: 'energise', label: 'Energise', query: 'High BPM energetic electronic dance tracks' },
  { id: 'feelgood', label: 'Feel good', query: 'Happy feel good upbeat songs playlist' },
  { id: 'romance', label: 'Romance', query: 'Romantic acoustic melodies love songs' },
  { id: 'party', label: 'Party', query: 'Party club bangers dance remix' },
  { id: 'sad', label: 'Sad', query: 'Emotional melancholic slow acoustic songs' },
  { id: 'focus', label: 'Focus', query: 'Deep focus instrumental ambient electronic beats' },
  { id: 'sleep', label: 'Sleep', query: 'Deep sleep soothing ambient delta waves' },
  { id: 'anime', label: 'Anime OST', query: 'High-impact orchestral rock Hiroyuki Sawano anime openings' },
  { id: 'sawano', label: 'Sawano OST', query: 'Hiroyuki Sawano best epic soundtrack mix' },
  { id: 'hindi', label: 'Hindi Trending', query: 'New Hindi songs latest releases' },
  { id: 'lofi', label: 'Lo-Fi', query: 'Nocturnal lofi hip hop chill study beats' }
]

export default function CuratorPrompt({
  setPrompt,
  onGenerate,
  onDirectSearch,
  searchMode = 'direct',
  isGenerating,
  isSearching
}) {
  const [activeChip, setActiveChip] = useState('all')
  const busy = isGenerating || isSearching

  const handleChipClick = (chip) => {
    setActiveChip(chip.id)
    if (setPrompt) setPrompt(chip.query)
    if (searchMode === 'curator' && onGenerate) {
      onGenerate(chip.query)
    } else if (onDirectSearch) {
      onDirectSearch(chip.query)
    }
  }

  return (
    <div className="bg-transparent px-3.5 sm:px-6 pt-3 pb-1 select-none flex-shrink-0 z-20">
      {/* Horizontal Mood / Activity Chips Carousel */}
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
      </div>
    </div>
  )
}
