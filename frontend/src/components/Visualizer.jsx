import React from 'react'

export default function Visualizer({ isPlaying = false, bars = 16, className = "" }) {
  const heights = [
    'h-2', 'h-4', 'h-6', 'h-3', 'h-5', 'h-7', 'h-4', 'h-6',
    'h-5', 'h-7', 'h-3', 'h-6', 'h-4', 'h-5', 'h-3', 'h-2'
  ]

  return (
    <div className={`flex items-end gap-1 h-8 px-2 ${className}`}>
      {Array.from({ length: bars }).map((_, i) => (
        <span
          key={i}
          className={`w-1 rounded-full transition-all duration-300 ${
            isPlaying
              ? 'bg-gradient-to-t from-purple-500 to-cyan-400 animate-pulse'
              : 'bg-slate-700 h-1.5'
          } ${isPlaying ? heights[i % heights.length] : ''}`}
          style={{
            animationDelay: `${(i * 0.08).toFixed(2)}s`,
            animationDuration: isPlaying ? `${0.6 + (i % 5) * 0.2}s` : '0s'
          }}
        />
      ))}
    </div>
  )
}
