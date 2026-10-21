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

const YT_WEB_CONTEXT = {
  client: { clientName: 'WEB', clientVersion: '2.20260918.01.00', hl: 'en', gl: 'IN' }
}
const YTM_SONGS_PARAM = 'EgWKAQIIAWoKEAkQBRAKEAMQBA=='
const STOPWORDS = new Set(['songs', 'song', 'music', 'the', 'a', 'an', 'of', 'and', 'best', 'top', 'new', 'latest', 'playlist', 'mix', 'for', 'to', 'in'])

function runsText(obj) {
  if (!obj || typeof obj !== 'object') return ''
  if (obj.simpleText) return obj.simpleText
  return (obj.runs || []).map((r) => r.text || '').join('')
}

function queryTokens(q) {
  const toks = q.toLowerCase().match(/[a-z0-9]+/g) || []
  const core = toks.filter((t) => !STOPWORDS.has(t))
  return core.length ? core : toks
}

function relevance(text, tokens) {
  if (!tokens.length) return 0
  const t = text.toLowerCase()
  return tokens.filter((tok) => t.includes(tok)).length / tokens.length
}

/** Same results, same order as typing the query on youtube.com. */
async function ytWebSearch(query, pages = 2) {
  const url = 'https://www.youtube.com/youtubei/v1/search?prettyPrint=false'
  const videos = []
  const playlists = []
  const seenV = new Set()
  const seenP = new Set()
  let body = { context: YT_WEB_CONTEXT, query }

  for (let page = 0; page < pages; page++) {
    let data
    try {
      const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (!r.ok) break
      data = await r.json()
    } catch {
      break
    }

    for (const v of findNodes(data, 'videoRenderer')) {
      const vid = v.videoId
      const dur = runsText(v.lengthText)
      if (!vid || vid.length !== 11 || seenV.has(vid) || !dur) continue // skip live streams
      seenV.add(vid)
      const views = runsText(v.shortViewCountText) || runsText(v.viewCountText)
      const published = runsText(v.publishedTimeText)
      const meta = [views, published].filter(Boolean).join(' • ') || 'YouTube search result'
      videos.push({
        title: runsText(v.title),
        artist: runsText(v.ownerText) || runsText(v.longBylineText) || 'YouTube',
        video_id: vid,
        fallback_ids: [],
        duration_text: dur,
        thumbnail: `https://i.ytimg.com/vi/${vid}/hqdefault.jpg`,
        url: `https://www.youtube.com/watch?v=${vid}`,
        match_tier: 'Direct Match',
        reason: meta,
        why_it_fits: meta,
        vibe: 'YouTube'
      })
    }

    for (const lk of findNodes(data, 'lockupViewModel')) {
      if (lk.contentType !== 'LOCKUP_CONTENT_TYPE_PLAYLIST') continue
      const pid = lk.contentId || ''
      if (!pid || pid.startsWith('RD') || seenP.has(pid)) continue
      seenP.add(pid)
      const md = lk?.metadata?.lockupMetadataViewModel || {}
      const title = md?.title?.content || ''
      let owner = ''
      for (const row of md?.metadata?.contentMetadataViewModel?.metadataRows || []) {
        for (const part of row.metadataParts || []) {
          const txt = part?.text?.content || ''
          if (txt && txt !== 'Playlist' && !owner) owner = txt
        }
      }
      if (title) {
        playlists.push({
          browse_id: `VL${pid}`,
          title,
          subtitle: owner ? `YouTube Playlist • ${owner}` : 'YouTube Playlist',
          thumbnail: '',
          is_editorial: false,
          source: 'youtube'
        })
      }
    }

    const tokens = [...findNodes(data, 'continuationCommand')].map((c) => c?.token).filter(Boolean)
    if (!tokens.length) break
    body = { context: YT_WEB_CONTEXT, continuation: tokens[0] }
  }
  return { videos, playlists }
}

async function ytmSearchRaw(query, songsOnly) {
  const body = { context: YTM_CONTEXT, query }
  if (songsOnly) body.params = YTM_SONGS_PARAM
  try {
    const r = await fetch('https://music.youtube.com/youtubei/v1/search?prettyPrint=false', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
    return r.ok ? await r.json() : {}
  } catch {
    return {}
  }
}

function parseYtmSongs(data) {
  const out = []
  const seen = new Set()
  for (const item of findNodes(data, 'musicResponsiveListItemRenderer')) {
    const vid = item?.playlistItemData?.videoId
    if (!vid || vid.length !== 11 || seen.has(vid)) continue
    const cols = (item.flexColumns || []).map((c) => extractColText(c, 'musicResponsiveListItemFlexColumnRenderer'))
    if (!cols[0]) continue
    const meta = cols[1] || ''
    const plays = cols[2] || ''
    if (BLOCKED_META.some((b) => meta.includes(b))) continue
    const parts = meta.split('•').map((s) => s.trim()).filter(Boolean)
    if (parts[0] === 'Song' || parts[0] === 'Video') parts.shift()
    let dur = ''
    if (parts.length && /^\d{1,2}:\d{2}(:\d{2})?$/.test(parts[parts.length - 1])) dur = parts.pop()
    const album = parts[1] || ''
    const bits = []
    if (album && album.toLowerCase() !== cols[0].toLowerCase()) bits.push(`Album: ${album}`)
    if (plays) bits.push(plays)
    const reason = bits.length ? bits.join(' • ') : 'YouTube Music song'
    seen.add(vid)
    out.push({
      title: cols[0],
      artist: parts[0] || 'Unknown Artist',
      video_id: vid,
      fallback_ids: [],
      duration_text: dur,
      thumbnail: `https://i.ytimg.com/vi/${vid}/hqdefault.jpg`,
      url: `https://www.youtube.com/watch?v=${vid}`,
      match_tier: 'Direct Match',
      reason,
      why_it_fits: reason,
      vibe: 'YT Music'
    })
    if (out.length >= 25) break
  }
  return out
}

function parseYtmPlaylists(data) {
  const out = []
  const seen = new Set()
  for (const item of findNodes(data, 'musicResponsiveListItemRenderer')) {
    const bid = item?.navigationEndpoint?.browseEndpoint?.browseId || ''
    if (!bid.startsWith('VL') || seen.has(bid)) continue
    const cols = (item.flexColumns || []).map((c) => extractColText(c, 'musicResponsiveListItemFlexColumnRenderer'))
    if (!cols[0]) continue
    const meta = cols[1] || 'Playlist'
    seen.add(bid)
    out.push({
      browse_id: bid,
      title: cols[0],
      subtitle: meta,
      thumbnail: '',
      is_editorial: meta.includes('YouTube Music') || bid.startsWith('VLRDCLAK'),
      source: 'ytmusic'
    })
  }
  return out
}

/**
 * Zero-token direct search that mirrors youtube.com:
 * - Primary list = YouTube search results in YouTube's exact order.
 * - YT Music songs + only *relevant* playlists available as 1-tap alternatives.
 * - Playlists are auto-loaded only when the query explicitly says "playlist".
 */
export async function directSearchStandalone(query, mode = 'auto') {
  const qClean = (query || '').trim()
  if (!qClean) {
    return { playlist_title: 'Direct Search', tracks: [], matched_playlists: [], song_results: [], youtube_results: [] }
  }

  const cacheKey = `${qClean.toLowerCase()}::${mode}`
  const cached = directSearchCache.get(cacheKey)
  if (cached && Date.now() - cached.ts < 20 * 60 * 1000) return cached.data

  const [yt, ytmSongsRaw, ytmAllRaw] = await Promise.all([
    ytWebSearch(qClean, 2),
    ytmSearchRaw(qClean, true),
    ytmSearchRaw(qClean, false)
  ])
  const youtubeResults = yt.videos.slice(0, 40)
  const ytmSongs = parseYtmSongs(ytmSongsRaw)
  const ytmPlaylists = parseYtmPlaylists(ytmAllRaw)

  const tokens = queryTokens(qClean)
  const seenTitles = new Set()
  const matchedPlaylists = []
  for (const pl of [...yt.playlists, ...ytmPlaylists]) {
    const key = pl.title.trim().toLowerCase()
    if (seenTitles.has(key)) continue
    const score = relevance(pl.title, tokens)
    if (score < 0.5) continue // drop unrelated "suggested" playlists
    seenTitles.add(key)
    matchedPlaylists.push({ ...pl, relevance: Math.round(score * 100) / 100 })
  }
  matchedPlaylists.sort((a, b) => b.relevance - a.relevance) // stable: keeps YouTube order on ties
  matchedPlaylists.splice(6)

  const wantsPlaylist = mode === 'playlists' || (mode === 'auto' && qClean.toLowerCase().includes('playlist'))

  let activeSource = 'youtube'
  let activeBrowseId = ''
  let tracks = youtubeResults
  let playlistTitle = `"${qClean}"`
  let vibe = `YouTube results • ${youtubeResults.length} videos • same order as youtube.com (0 AI tokens)`

  if (mode === 'songs' && ytmSongs.length) {
    activeSource = 'songs'
    tracks = ytmSongs
    vibe = `YouTube Music songs • ${ytmSongs.length} results (0 AI tokens)`
  } else if (wantsPlaylist && matchedPlaylists.length) {
    const top = matchedPlaylists[0]
    const plTracks = await browsePlaylistStandalone(top.browse_id, top.title, top.subtitle)
    if (plTracks.length) {
      tracks = plTracks
      activeSource = 'playlist'
      activeBrowseId = top.browse_id
      playlistTitle = top.title
      vibe = `${top.subtitle} • playlist for "${qClean}" (0 AI tokens)`
    }
  }

  if (!tracks.length) {
    tracks = ytmSongs
    activeSource = 'songs'
  }

  const payload = {
    playlist_title: playlistTitle,
    subtitle: vibe,
    vibe_description: vibe,
    curator_note: vibe,
    used_model: 'direct-search (0 tokens)',
    requested_model: 'direct-search',
    is_fallback: false,
    is_direct_search: true,
    search_query: qClean,
    active_source: activeSource,
    active_browse_id: activeBrowseId,
    matched_playlists: matchedPlaylists,
    youtube_results: youtubeResults,
    song_results: ytmSongs,
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
