// UpBeat platform layer.
// - Desktop / PWA served by the Mac backend: talk to same-origin `/api`.
// - Android APK (Capacitor): talk to a configured Mac server URL if set; otherwise run the
//   fully standalone engine (Gemini direct + YouTube Music search + direct audio streams).
//   Native HTTP (CapacitorHttp) is enabled in capacitor.config.json, which lets `fetch`
//   reach music.youtube.com / youtube.com without browser CORS restrictions.

const MODEL_ALIASES = {
  'gemini-4-argon': 'gemini-robotics-er-2-preview',
  'gemini-er-2-flash': 'gemini-robotics-er-2-preview'
}
const LOW_THINKING_MODELS = new Set(['gemini-3.8-flash', 'gemini-3.7-flash'])
const ZERO_BUDGET_MODELS = new Set(['gemini-2.5-flash', 'gemini-robotics-er-2-preview'])

// ---------------------------------------------------------------------------
// Platform + settings
// ---------------------------------------------------------------------------

export function isNativeApp() {
  try {
    return Boolean(window.Capacitor?.isNativePlatform?.())
  } catch {
    return false
  }
}

export function getStoredApiKey() {
  return localStorage.getItem('upbeat_gemini_api_key') || ''
}

export function setStoredApiKey(key) {
  localStorage.setItem('upbeat_gemini_api_key', (key || '').trim())
}

export function getStoredServerUrl() {
  return (localStorage.getItem('upbeat_server_url') || '').trim().replace(/\/+$/, '')
}

export function setStoredServerUrl(url) {
  let u = (url || '').trim().replace(/\/+$/, '')
  if (u && !/^https?:\/\//i.test(u)) u = `http://${u}`
  localStorage.setItem('upbeat_server_url', u)
}

/** True when a Mac backend is reachable in principle (same-origin web, or configured URL in the APK). */
export function hasBackend() {
  if (!isNativeApp()) return true
  return Boolean(getStoredServerUrl())
}

/** Base for backend API calls. */
export function getApiBase() {
  const custom = getStoredServerUrl()
  if (custom) return `${custom}/api`
  return '/api'
}

export function apiUrl(path) {
  return `${getApiBase()}${path.startsWith('/') ? path : `/${path}`}`
}

/** True if the app can curate right now (backend available or Gemini key saved). */
export function isConfigured() {
  return hasBackend() || Boolean(getStoredApiKey())
}

// ---------------------------------------------------------------------------
// Gemini (direct)
// ---------------------------------------------------------------------------

function cleanJsonText(raw) {
  let s = (raw || '').trim()
  if (s.startsWith('```json')) s = s.slice(7)
  else if (s.startsWith('```')) s = s.slice(3)
  if (s.endsWith('```')) s = s.slice(0, -3)
  return JSON.parse(s.trim())
}

function describeError(status, model) {
  if (status === 429) return `Free-tier quota reached (HTTP 429) on ${model}`
  if (status === 503) return `High server demand (HTTP 503) on ${model}`
  if (status === 400 || status === 403) return `API key rejected (HTTP ${status}) on ${model}`
  if (status === 404) return `Model unavailable (HTTP 404): ${model}`
  return `HTTP ${status} on ${model}`
}

async function callGeminiDirect(modelId, prompt, apiKey) {
  const endpoint = MODEL_ALIASES[modelId] || modelId
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${endpoint}:generateContent?key=${encodeURIComponent(apiKey)}`

  const generationConfig = { temperature: 0.55 }
  if (!endpoint.includes('gemma')) generationConfig.responseMimeType = 'application/json'
  if (ZERO_BUDGET_MODELS.has(endpoint) || endpoint.includes('2.5-flash')) {
    generationConfig.thinkingConfig = { thinkingBudget: 0 }
  } else if (LOW_THINKING_MODELS.has(endpoint)) {
    generationConfig.thinkingConfig = { thinkingLevel: 'LOW' }
  } else if (endpoint.includes('gemini-3') || endpoint.includes('flash-lite') || endpoint.includes('gemma-4')) {
    generationConfig.thinkingConfig = { thinkingLevel: 'MINIMAL' }
  }

  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig })
  })
  if (!resp.ok) {
    const err = new Error(describeError(resp.status, modelId))
    err.status = resp.status
    throw err
  }

  const body = await resp.json()
  const parts = body?.candidates?.[0]?.content?.parts || []
  let text = ''
  for (const p of parts) if (p.text && !p.thought) text += p.text
  if (!text && parts.length > 0) text = parts[parts.length - 1].text || ''

  let parsed = cleanJsonText(text)
  if (Array.isArray(parsed)) parsed = { tracks: parsed }
  return parsed
}

export async function generateWithDirectGemini(prompt, preferredModel = 'gemini-3.8-flash') {
  const apiKey = getStoredApiKey()
  if (!apiKey) {
    throw new Error('Add your Gemini API key in Settings (key icon) to curate on this device.')
  }

  const pool = [
    preferredModel,
    'gemini-3.8-flash',
    'gemini-4-argon',
    'gemini-3.1-flash-lite',
    'gemini-3.5-flash-lite',
    'gemini-flash-lite-latest',
    'gemini-3-flash-preview',
    'gemini-2.5-flash',
    'gemma-4-26b-a4b-it'
  ]
  const seen = new Set()
  const candidates = pool.filter((m) => {
    const ep = MODEL_ALIASES[m] || m
    if (seen.has(ep)) return false
    seen.add(ep)
    return true
  })

  const attempts = []
  let primaryReason = ''
  for (let i = 0; i < candidates.length; i++) {
    const m = candidates[i]
    const t0 = performance.now()
    try {
      const res = await callGeminiDirect(m, prompt, apiKey)
      const latency = Math.round(performance.now() - t0)
      attempts.push({ model: m, status: 'ok', latency_ms: latency })
      return {
        ...res,
        requested_model: preferredModel,
        used_model: m,
        is_fallback: i > 0,
        latency_ms: latency,
        model_attempts: attempts,
        fallback_reason: i > 0 ? primaryReason : '',
        fallback_note: i > 0 ? `${primaryReason} -> generated by ${m}` : ''
      }
    } catch (err) {
      const reason = err.message || `Error on ${m}`
      attempts.push({ model: m, status: 'error', reason, latency_ms: Math.round(performance.now() - t0) })
      if (i === 0) primaryReason = reason
      // An invalid key will fail on every model; stop early.
      if (err.status === 400 || err.status === 403) throw new Error(reason)
    }
  }
  throw new Error(`All Gemini models failed (${primaryReason})`)
}

// ---------------------------------------------------------------------------
// YouTube Music search (WEB_REMIX Innertube) — native HTTP in the APK
// ---------------------------------------------------------------------------

const YTM_CONTEXT = {
  client: { clientName: 'WEB_REMIX', clientVersion: '1.20260918.01.00', hl: 'en', gl: 'US' }
}
const BLOCKED_META = ['Episode', 'Podcast', 'Release - Topic', 'Lights on the Ceiling']
const searchCache = new Map()

function* findNodes(obj, key) {
  if (Array.isArray(obj)) {
    for (const it of obj) yield* findNodes(it, key)
  } else if (obj && typeof obj === 'object') {
    if (key in obj) yield obj[key]
    for (const v of Object.values(obj)) yield* findNodes(v, key)
  }
}

async function ytmSearchItems(query) {
  const resp = await fetch('https://music.youtube.com/youtubei/v1/search?prettyPrint=false', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ context: YTM_CONTEXT, query })
  })
  if (!resp.ok) return []
  const data = await resp.json()
  const out = []
  for (const item of findNodes(data, 'musicResponsiveListItemRenderer')) {
    const vid = item?.playlistItemData?.videoId
    if (!vid || vid.length !== 11) continue
    const cols = (item.flexColumns || []).map((c) =>
      (c?.musicResponsiveListItemFlexColumnRenderer?.text?.runs || []).map((r) => r.text || '').join('').trim()
    )
    const meta = cols[1] || ''
    if (BLOCKED_META.some((b) => meta.includes(b))) continue
    const metaParts = meta.split('•').map((s) => s.trim()).filter(Boolean)
    const dur = (cols.join(' ').match(/\b(\d{1,2}:\d{2})\b/) || [])[1] || ''
    if (!out.some((o) => o.video_id === vid)) {
      out.push({ title: cols[0] || '', artist: metaParts[1] || meta, video_id: vid, duration_text: dur })
    }
  }
  return out
}

export async function searchYouTubeStandalone(query) {
  const key = query.trim().toLowerCase()
  if (searchCache.has(key)) return searchCache.get(key)
  try {
    const items = await ytmSearchItems(query)
    if (!items.length) return null
    const vid = items[0].video_id
    const res = {
      video_id: vid,
      fallback_ids: items.slice(1, 4).map((i) => i.video_id),
      duration_text: items[0].duration_text || '',
      thumbnail: `https://i.ytimg.com/vi/${vid}/hqdefault.jpg`,
      url: `https://www.youtube.com/watch?v=${vid}`
    }
    searchCache.set(key, res)
    return res
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Direct audio stream resolution (Innertube player, IOS client)
// ---------------------------------------------------------------------------

const PLAYER_CLIENT = {
  clientName: 'IOS',
  clientVersion: '20.10.4',
  deviceMake: 'Apple',
  deviceModel: 'iPhone16,2',
  osName: 'iPhone',
  osVersion: '18.3.2.22D82',
  hl: 'en',
  gl: 'US'
}
const streamCache = new Map()

/** Returns a playable direct audio URL for a video id (works in the APK without the Mac). */
export async function resolveStandaloneAudio(videoId) {
  if (!videoId) return null
  const cached = streamCache.get(videoId)
  if (cached && Date.now() - cached.ts < 25 * 60 * 1000) return cached.url
  try {
    const resp = await fetch('https://www.youtube.com/youtubei/v1/player?prettyPrint=false', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'com.google.ios.youtube/20.10.4 (iPhone16,2; U; CPU iOS 18_3_2 like Mac OS X;)'
      },
      body: JSON.stringify({ context: { client: PLAYER_CLIENT }, videoId, contentCheckOk: true, racyCheckOk: true })
    })
    if (!resp.ok) return null
    const data = await resp.json()
    if (data?.playabilityStatus?.status !== 'OK') return null
    const formats = (data?.streamingData?.adaptiveFormats || [])
      .filter((f) => f.url && (f.mimeType || '').startsWith('audio/mp4'))
      .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))
    if (!formats.length) return null
    streamCache.set(videoId, { url: formats[0].url, ts: Date.now() })
    return formats[0].url
  } catch {
    return null
  }
}

/** Audio source for the player: Mac backend proxy when available, otherwise direct stream. */
export async function getAudioSource(videoId) {
  if (hasBackend()) return apiUrl(`/audio/${videoId}`)
  return resolveStandaloneAudio(videoId)
}

// ---------------------------------------------------------------------------
// Standalone curation
// ---------------------------------------------------------------------------

export async function curateStandalone({ mood_prompt, energy_level = 78, count = 8, model_name = 'gemini-3.8-flash', favorites = [] }) {
  // Ground the model in real catalog results for the query
  let catalogBlock = ''
  try {
    const catalog = (await ytmSearchItems(mood_prompt)).slice(0, 12)
    if (catalog.length) {
      catalogBlock =
        'Verified YouTube Music tracks matching the query (use as ground truth where relevant):\n' +
        catalog.map((c) => `- "${c.title}" by ${c.artist}`).join('\n') +
        '\n\n'
    }
  } catch {}

  const favBlock = favorites.length
    ? 'Listener favorites (use only for general mood prompts, never to dilute a specific franchise/artist request):\n' +
      favorites.slice(0, 8).map((f) => `- ${f.title} by ${f.artist}`).join('\n') +
      '\n\n'
    : ''

  const prompt = `You are an expert musicologist and playlist curator for UpBeat.

${catalogBlock}${favBlock}User Request:
- Prompt: "${mood_prompt}"
- Target Intensity: ${energy_level}/100
- Track Count: ${count}

STRICT RULES:
1. If the prompt names a specific anime, movie, game, franchise, or artist (e.g. "monogatari bests", "ramayan movie song"), 100% of tracks MUST belong to that exact franchise/artist. Never mix unrelated shows. Use real, canonical song titles only.
2. Otherwise, curate tracks that genuinely match the mood and intensity.
3. "reason": 8-13 words describing the music itself (instrumentation, vocals, rhythm, atmosphere). Never write meta-talk like "appeals to the user".
4. "search_query": exact title + artist + series/album so YouTube Music finds the official audio.

Return ONLY a valid JSON object:
{
  "playlist_title": "string",
  "subtitle": "string",
  "vibe_description": "string",
  "tracks": [
    {
      "title": "string",
      "artist": "string",
      "search_query": "string",
      "match_tier": "Direct Match | Close Fit | Exploratory",
      "reason": "string",
      "detail": "string (1 sentence)",
      "vibe": "string (1-2 words)",
      "energy": 78
    }
  ]
}`

  const res = await generateWithDirectGemini(prompt, model_name)
  const tracks = Array.isArray(res.tracks) ? res.tracks : []
  const tierOrder = { 'Direct Match': 0, 'Close Fit': 1, Exploratory: 2 }

  const resolved = await Promise.all(
    tracks.map(async (t) => {
      const q = t.search_query || `${t.title} ${t.artist}`
      const found = await searchYouTubeStandalone(q)
      const tier = tierOrder[t.match_tier] !== undefined ? t.match_tier : 'Direct Match'
      if (found) return { ...t, match_tier: tier, ...found, duration_text: found.duration_text || '' }
      return { ...t, match_tier: tier, video_id: '', fallback_ids: [], duration_text: '', url: `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}` }
    })
  )

  // Never play the same video twice in one playlist
  const used = new Set()
  for (const tr of resolved) {
    if (tr.video_id && used.has(tr.video_id)) {
      const alt = (tr.fallback_ids || []).find((id) => !used.has(id))
      if (alt) {
        tr.video_id = alt
        tr.thumbnail = `https://i.ytimg.com/vi/${alt}/hqdefault.jpg`
        tr.url = `https://www.youtube.com/watch?v=${alt}`
      }
    }
    if (tr.video_id) used.add(tr.video_id)
  }

  resolved.sort((a, b) => (tierOrder[a.match_tier] ?? 0) - (tierOrder[b.match_tier] ?? 0))
  return { ...res, tracks: resolved }
}
