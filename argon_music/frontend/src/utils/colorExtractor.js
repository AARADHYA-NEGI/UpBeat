import { useState, useEffect } from 'react'

export const DEFAULT_LAVENDER_THEME = {
  primary: '#b89df5', // Premium lavender
  accent: '#d4b3ff',  // Soft lilac highlight
  glow: 'rgba(184, 157, 245, 0.45)',
  subtle: 'rgba(184, 157, 245, 0.15)',
  border: 'rgba(184, 157, 245, 0.40)',
  text: '#ffffff',
  contrastText: '#0a0a0f',
  rgb: '184, 157, 245',
  isDark: false
}

function rgbToHsl(r, g, b) {
  r /= 255
  g /= 255
  b /= 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0
  let s = 0
  const l = (max + min) / 2

  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0)
        break
      case g:
        h = (b - r) / d + 2
        break
      case b:
        h = (r - g) / d + 4
        break
    }
    h /= 6
  }

  return [h, s, l]
}

function hslToRgb(h, s, l) {
  let r, g, b

  if (s === 0) {
    r = g = b = l
  } else {
    const hue2rgb = (p, q, t) => {
      let val = t
      if (val < 0) val += 1
      if (val > 1) val -= 1
      if (val < 1 / 6) return p + (q - p) * 6 * val
      if (val < 1 / 2) return q
      if (val < 2 / 3) return p + (q - p) * (2 / 3 - val) * 6
      return p
    }

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s
    const p = 2 * l - q
    r = hue2rgb(p, q, h + 1 / 3)
    g = hue2rgb(p, q, h)
    b = hue2rgb(p, q, h - 1 / 3)
  }

  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)]
}

export function createPaletteFromRgb(r, g, b) {
  const [h, s, l] = rgbToHsl(r, g, b)
  // Boost saturation slightly so transport controls pop vibrantly
  const boostS = Math.min(1, Math.max(0.60, s * 1.15))
  // Keep lightness in the pleasing zone for UI buttons & contrast
  const targetL = Math.max(0.50, Math.min(0.66, l))
  const [pr, pg, pb] = hslToRgb(h, boostS, targetL)

  // Secondary accent: slight hue shift for lush gradient pairing
  const [ar, ag, ab] = hslToRgb((h + 0.07) % 1, boostS, Math.min(0.74, targetL + 0.05))

  const luminance = (0.299 * pr + 0.587 * pg + 0.114 * pb) / 255
  const contrastText = luminance > 0.52 ? '#08080c' : '#ffffff'

  return {
    primary: `rgb(${pr}, ${pg}, ${pb})`,
    accent: `rgb(${ar}, ${ag}, ${ab})`,
    glow: `rgba(${pr}, ${pg}, ${pb}, 0.45)`,
    subtle: `rgba(${pr}, ${pg}, ${pb}, 0.15)`,
    border: `rgba(${pr}, ${pg}, ${pb}, 0.40)`,
    text: '#ffffff',
    contrastText,
    rgb: `${pr}, ${pg}, ${pb}`,
    isDark: luminance <= 0.52
  }
}

// In-memory cache to prevent redundant canvas extractions for the same artwork
const colorCache = new Map()

export function extractAlbumColor(imageUrl, callback) {
  if (!imageUrl) {
    callback(DEFAULT_LAVENDER_THEME)
    return
  }

  if (colorCache.has(imageUrl)) {
    callback(colorCache.get(imageUrl))
    return
  }

  const img = new Image()
  img.crossOrigin = 'anonymous'
  img.referrerPolicy = 'no-referrer'

  let resolved = false
  const finish = (palette) => {
    if (resolved) return
    resolved = true
    colorCache.set(imageUrl, palette)
    callback(palette)
  }

  // Safety fallback after 1.2s if image hangs
  const timer = setTimeout(() => {
    finish(DEFAULT_LAVENDER_THEME)
  }, 1200)

  img.onload = () => {
    clearTimeout(timer)
    try {
      const canvas = document.createElement('canvas')
      canvas.width = 32
      canvas.height = 32
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      if (!ctx) {
        finish(DEFAULT_LAVENDER_THEME)
        return
      }

      ctx.drawImage(img, 0, 0, 32, 32)
      const data = ctx.getImageData(0, 0, 32, 32).data

      const buckets = {}
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i]
        const g = data[i + 1]
        const b = data[i + 2]
        const a = data[i + 3]

        if (a < 128) continue

        const [h, s, l] = rgbToHsl(r, g, b)

        // Filter out extreme near-black, pure white, or completely desaturated grays
        if (l < 0.14 || l > 0.88 || s < 0.16) continue

        // Score: favor high saturation and moderate lightness
        const lightnessScore = 1 - Math.abs(l - 0.55) * 1.6
        const score = s * 1.8 + lightnessScore

        // 36 hue buckets of 10 degrees each
        const hueBucket = Math.round(h * 36) % 36
        if (!buckets[hueBucket]) {
          buckets[hueBucket] = { r: 0, g: 0, b: 0, count: 0, score: 0 }
        }
        buckets[hueBucket].r += r
        buckets[hueBucket].g += g
        buckets[hueBucket].b += b
        buckets[hueBucket].count += 1
        buckets[hueBucket].score += score
      }

      let best = null
      for (const key in buckets) {
        const item = buckets[key]
        if (!best || item.score > best.score) {
          best = item
        }
      }

      if (!best || best.count === 0) {
        finish(DEFAULT_LAVENDER_THEME)
        return
      }

      const r = Math.round(best.r / best.count)
      const g = Math.round(best.g / best.count)
      const b = Math.round(best.b / best.count)

      finish(createPaletteFromRgb(r, g, b))
    } catch {
      finish(DEFAULT_LAVENDER_THEME)
    }
  }

  img.onerror = () => {
    clearTimeout(timer)
    finish(DEFAULT_LAVENDER_THEME)
  }

  img.src = imageUrl
}

export function useAlbumColor(imageUrl) {
  const [palette, setPalette] = useState(() => {
    if (imageUrl && colorCache.has(imageUrl)) {
      return colorCache.get(imageUrl)
    }
    return DEFAULT_LAVENDER_THEME
  })

  useEffect(() => {
    let active = true
    extractAlbumColor(imageUrl, (extracted) => {
      if (active) setPalette(extracted)
    })
    return () => {
      active = false
    }
  }, [imageUrl])

  return palette
}
