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
  client: { clientName: 'WEB_REMIX', clientVersion: '1.20260918.01.00', hl: 'en', gl: 'IN' }
}
const BLOCKED_META = ['Episode', 'Podcast', 'Release - Topic', 'Lights on the Ceiling']
const searchCache = new Map()
const directSearchCache = new Map()
const playlistBrowseCache = new Map()

const PLAYLIST_KEYWORDS = [
  'playlist', 'new ', 'latest', 'top ', 'best ', 'hits', 'hitlist',
  'songs', 'ost', 'soundtrack', '2024', '2025', '2026', 'collection',
  'mix', 'chart', 'trending', 'essentials'
]

function* findNodes(obj, key) {
  if (Array.isArray(obj)) {
    for (const it of obj) yield* findNodes(it, key)
  } else if (obj && typeof obj === 'object') {
    if (key in obj) yield obj[key]
    for (const v of Object.values(obj)) yield* findNodes(v, key)
  }
}

function extractColText(colObj, rendererKey) {
  return (colObj?.[rendererKey]?.text?.runs || []).map((r) => r.text || '').join('').trim()
}

export async function browsePlaylistStandalone(browseId, playlistTitle = '', playlistSubtitle = '', maxTracks = 35) {
  if (!browseId) return []
  const cached = playlistBrowseCache.get(browseId)
  if (cached && Date.now() - cached.ts < 30 * 60 * 1000) return cached.tracks

  try {
    const resp = await fetch('https://music.youtube.com/youtubei/v1/browse?prettyPrint=false', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ context: YTM_CONTEXT, browseId })
    })
    if (!resp.ok) return []
    const data = await resp.json()
    const tracks = []
    const seenVids = new Set()

    for (const item of findNodes(data, 'musicResponsiveListItemRenderer')) {
      const vid = item?.playlistItemData?.videoId
      if (!vid || vid.length !== 11 || seenVids.has(vid)) continue

      const cols = (item.flexColumns || []).map((c) => extractColText(c, 'musicResponsiveListItemFlexColumnRenderer'))
      const fixed = (item.fixedColumns || []).map((c) => extractColText(c, 'musicResponsiveListItemFixedColumnRenderer'))

      const title = cols[0] || ''
      const artist = cols[1] || 'Unknown Artist'
      const extra = cols[2] || ''
      if (!title || BLOCKED_META.some((b) => artist.includes(b))) continue

      let dur = ''
      if (fixed[0] && /^\d{1,2}:\d{2}$/.test(fixed[0])) {
        dur = fixed[0]
      } else {
        const m = [...cols, ...fixed].join(' ').match(/\b(\d{1,2}:\d{2})\b/)
        if (m) dur = m[1]
      }

      seenVids.add(vid)
      const reasonParts = []
      if (extra) reasonParts.push(extra)
      if (playlistTitle) reasonParts.push(`Featured in ${playlistTitle}`)
      const reason = reasonParts.length ? reasonParts.join(' • ') : 'Featured track from official playlist'

      tracks.push({
        title,
        artist,
        video_id: vid,
        fallback_ids: [],
        duration_text: dur,
        thumbnail: `https://i.ytimg.com/vi/${vid}/hqdefault.jpg`,
        url: `https://www.youtube.com/watch?v=${vid}`,
        match_tier: 'Direct Match',
        reason,
        why_it_fits: reason,
        vibe: 'Playlist'
      })
      if (tracks.length >= maxTracks) break
    }

    playlistBrowseCache.set(browseId, { tracks, ts: Date.now() })
    return tracks
  } catch {
    return []
  }
}

export async function directSearchStandalone(query, mode = 'auto') {
  const qClean = (query || '').trim()
  if (!qClean) {
    return { playlist_title: 'Direct Search', tracks: [], matched_playlists: [], song_results: [] }
  }

  const cacheKey = `${qClean.toLowerCase()}::${mode}`
  const cached = directSearchCache.get(cacheKey)
  if (cached && Date.now() - cached.ts < 20 * 60 * 1000) return cached.data

  const searchUrl = 'https://music.youtube.com/youtubei/v1/search?prettyPrint=false'
  const [dataUnfiltered, dataSongs] = await Promise.all([
    fetch(searchUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ context: YTM_CONTEXT, query: qClean })
    }).then((r) => (r.ok ? r.json() : {})).catch(() => ({})),
    fetch(searchUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ context: YTM_CONTEXT, query: qClean, params: 'EgWKAQIIAWoKEAkQBRAKEAMQBA==' })
    }).then((r) => (r.ok ? r.json() : {})).catch(() => ({}))
  ])

  const matchedPlaylists = []
  const seenBrowseIds = new Set()

  for (const item of findNodes(dataUnfiltered, 'musicResponsiveListItemRenderer')) {
    const browseId = item?.navigationEndpoint?.browseEndpoint?.browseId || ''
    if (!browseId.startsWith('VL') || seenBrowseIds.has(browseId)) continue
    const cols = (item.flexColumns || []).map((c) => extractColText(c, 'musicResponsiveListItemFlexColumnRenderer'))
    const plTitle = cols[0] || ''
    const plMeta = cols[1] || 'Playlist'
    if (!plTitle) continue
    const thumbs = item?.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails || []
    const thumb = thumbs.length ? thumbs[thumbs.length - 1].url || '' : ''
    seenBrowseIds.add(browseId)
    matchedPlaylists.push({
      browse_id: browseId,
      title: plTitle,
      subtitle: plMeta,
      thumbnail: thumb,
      is_editorial: plMeta.includes('YouTube Music') || browseId.startsWith('VLRDCLAK')
    })
    if (matchedPlaylists.length >= 6) break
  }

  matchedPlaylists.sort((a, b) => (a.is_editorial ? 0 : 1) - (b.is_editorial ? 0 : 1))

  const songResults = []
  const seenSongVids = new Set()

  for (const srcData of [dataSongs, dataUnfiltered]) {
    for (const item of findNodes(srcData, 'musicResponsiveListItemRenderer')) {
      const vid = item?.playlistItemData?.videoId
      if (!vid || vid.length !== 11 || seenSongVids.has(vid)) continue
      const cols = (item.flexColumns || []).map((c) => extractColText(c, 'musicResponsiveListItemFlexColumnRenderer'))
      if (!cols[0]) continue
      const title = cols[0]
      const meta = cols[1] || ''
      const plays = cols[2] || ''
      if (BLOCKED_META.some((b) => meta.includes(b))) continue

      const parts = meta.split('•').map((s) => s.trim()).filter(Boolean)
      if (parts[0] === 'Song' || parts[0] === 'Video') parts.shift()

      let dur = ''
      if (parts.length && /^\d{1,2}:\d{2}$/.test(parts[parts.length - 1])) {
        dur = parts.pop()
      } else {
        const m = meta.match(/\b(\d{1,2}:\d{2})\b/)
        if (m) dur = m[1]
      }

      const artist = parts[0] || 'Unknown Artist'
      const album = parts[1] || ''
      const reasonBits = []
      if (album && album.toLowerCase() !== title.toLowerCase()) reasonBits.push(`Album: ${album}`)
      if (plays) reasonBits.push(plays)
      const reason = reasonBits.length ? reasonBits.join(' • ') : 'Direct YouTube Music track'

      seenSongVids.add(vid)
      songResults.push({
        title,
        artist,
        video_id: vid,
        fallback_ids: [],
        duration_text: dur,
        thumbnail: `https://i.ytimg.com/vi/${vid}/hqdefault.jpg`,
        url: `https://www.youtube.com/watch?v=${vid}`,
        match_tier: 'Direct Match',
        reason,
        why_it_fits: reason,
        vibe: plays || 'Direct'
      })
      if (songResults.length >= 25) break
    }
  }

  const qLower = qClean.toLowerCase()
  const wantsPlaylist =
    mode === 'playlists' ||
    (mode === 'auto' &&
      matchedPlaylists.length > 0 &&
      (PLAYLIST_KEYWORDS.some((kw) => qLower.includes(kw)) || matchedPlaylists[0].is_editorial))

  let activeSource = 'songs'
  let activeBrowseId = ''
  let tracks = songResults
  let playlistTitle = `Search: "${qClean}"`
  let vibeDescription = `Direct YouTube Music results • ${songResults.length} songs found (0 AI tokens used)`

  if (wantsPlaylist && matchedPlaylists.length > 0) {
    const topPl = matchedPlaylists[0]
    const plTracks = await browsePlaylistStandalone(topPl.browse_id, topPl.title, topPl.subtitle)
    if (plTracks.length > 0) {
      tracks = plTracks
      activeSource = 'playlist'
      activeBrowseId = topPl.browse_id
      playlistTitle = topPl.title
      vibeDescription = `${topPl.subtitle} • Prepared playlist for "${qClean}" (0 AI tokens)`
    }
  }

  const payload = {
    playlist_title: playlistTitle,
    subtitle: `Direct Search • "${qClean}"`,
    vibe_description: vibeDescription,
    curator_note: vibeDescription,
    used_model: 'direct-search (0 tokens)',
    requested_model: 'direct-search',
    is_fallback: false,
    is_direct_search: true,
    search_query: qClean,
    active_source: activeSource,
    active_browse_id: activeBrowseId,
    matched_playlists: matchedPlaylists,
    song_results: songResults,
    tracks
  }

  directSearchCache.set(cacheKey, { data: payload, ts: Date.now() })
  return payload
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
// Direct audio stream resolution (Innertube player, ANDROID + IOS clients)
// ---------------------------------------------------------------------------

const ANDROID_PLAYER_CLIENT = {
  clientName: 'ANDROID',
  clientVersion: '20.10.38',
  osName: 'Android',
  osVersion: '14',
  androidSdkVersion: 34,
  hl: 'en',
  gl: 'US'
}

const IOS_PLAYER_CLIENT = {
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

/** Returns { url, duration } for a video id (works in the APK without the Mac). */
export async function resolveStandaloneAudio(videoId) {
  if (!videoId) return null
  const cached = streamCache.get(videoId)
  if (cached && Date.now() - cached.ts < 25 * 60 * 1000) return cached

  for (const client of [ANDROID_PLAYER_CLIENT, IOS_PLAYER_CLIENT]) {
    try {
      const resp = await fetch('https://www.youtube.com/youtubei/v1/player?prettyPrint=false', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          context: { client },
          videoId,
          contentCheckOk: true,
          racyCheckOk: true
        })
      })
      if (!resp.ok) continue
      const data = await resp.json()
      if (data?.playabilityStatus?.status !== 'OK') continue

      // Prefer progressive formats (itag 18) first because Android WebView <audio>
      // probes without a Range header, which returns 200 OK on progressive formats
      // (whereas adaptiveFormats returns 403 without a Range header).
      const progressive = (data?.streamingData?.formats || []).filter((f) => f.url)
      const adaptive = (data?.streamingData?.adaptiveFormats || [])
        .filter((f) => f.url && (f.mimeType || '').startsWith('audio/mp4'))
        .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))

      const chosen = progressive[0] || adaptive[0]
      if (!chosen?.url) continue

      const duration =
        Number(data?.videoDetails?.lengthSeconds || 0) ||
        Math.round(Number(chosen.approxDurationMs || 0) / 1000) ||
        0

      const entry = { url: chosen.url, duration, ts: Date.now() }
      streamCache.set(videoId, entry)
      return entry
    } catch {}
  }
  return null
}

/** Audio source for the player: Mac backend proxy when available, otherwise direct stream. */
export async function getAudioSource(videoId) {
  if (hasBackend()) return { url: apiUrl(`/audio/${videoId}`), duration: 0 }
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
