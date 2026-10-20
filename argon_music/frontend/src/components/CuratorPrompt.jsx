import React from 'react'
import { Loader2, CornerDownLeft } from 'lucide-react'

export default function CuratorPrompt({
  prompt,
  setPrompt,
  onGenerate,
  isGenerating
}) {
  const suggestions = [
    'Focused late-night coding with minimal electronic & OSTs',
    'Hiroyuki Sawano / Attack on Titan style orchestral intensity',
    'Monogatari Series / Japanese math-pop & jazz-rock',
    'Dark synthwave & industrial midtempo',
    'Ambient downtempo for deep problem solving'
  ]

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!prompt.trim() || isGenerating) return
    onGenerate(prompt)
  }

  return (
    <div className="border-b border-[#222226] bg-[#0d0d0f] px-6 py-4">
      <form onSubmit={handleSubmit} className="flex items-center gap-2.5">
        <div className="flex-1 flex items-center bg-[#131317] border border-[#2a2a32] focus-within:border-indigo-500/70 rounded-md px-3.5 py-2 transition-colors">
          <span className="text-xs font-mono text-indigo-400 mr-2.5 select-none font-semibold">
            &gt;
          </span>
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe direction, genre, mood, or context..."
            className="w-full bg-transparent text-xs sm:text-sm text-[#f5f5f5] placeholder:text-[#73737a] focus:outline-none"
          />
        </div>

        <button
          type="submit"
          disabled={isGenerating || !prompt.trim()}
          className="px-4 py-2 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs flex items-center gap-2 transition-all shadow-sm shadow-indigo-500/20 disabled:opacity-40 cursor-pointer flex-shrink-0"
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Generating</span>
            </>
          ) : (
            <>
              <span>Generate</span>
              <CornerDownLeft className="w-3.5 h-3.5 opacity-80" />
            </>
          )}
        </button>
      </form>

      {/* Wrapping Suggestion Chips (no horizontal clipping) */}
      <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
        {suggestions.map((s, idx) => {
          const isCurrent = prompt === s
          return (
            <button
              key={idx}
              type="button"
              onClick={() => {
                setPrompt(s)
                onGenerate(s)
              }}
              disabled={isGenerating}
              className={`px-2.5 py-1 rounded-md border text-[11px] transition-colors cursor-pointer ${
                isCurrent
                  ? 'bg-indigo-500/15 border-indigo-500/40 text-indigo-200 font-medium'
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
