import concurrent.futures
import re
import time
import urllib.parse
from typing import Dict, List, Optional, Any
import requests
from requests.adapters import HTTPAdapter
import yt_dlp

_SEARCH_CACHE: Dict[str, Dict] = {}
_STREAM_CACHE: Dict[str, Dict[str, Any]] = {}


def _make_session() -> requests.Session:
    s = requests.Session()
    adapter = HTTPAdapter(pool_connections=16, pool_maxsize=16, max_retries=2)
    s.mount("https://", adapter)
    s.mount("http://", adapter)
    s.headers.update(
        {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
            "Accept-Language": "en-US,en;q=0.9",
        }
    )
    return s


_SESSION = _make_session()


def _find_nodes(obj: Any, target_key: str):
    if isinstance(obj, dict):
        if target_key in obj:
            yield obj[target_key]
        for v in obj.values():
            yield from _find_nodes(v, target_key)
    elif isinstance(obj, list):
        for item in obj:
            yield from _find_nodes(item, target_key)


import threading

_YDL_LOCAL = threading.local()


def _get_ydl() -> yt_dlp.YoutubeDL:
    ydl = getattr(_YDL_LOCAL, "ydl", None)
    if ydl is None:
        ydl = yt_dlp.YoutubeDL(
            {
                "format": "bestaudio[ext=m4a][format_id!=139][format_id!=599]/bestaudio[ext=m4a]/bestaudio/best",
                "quiet": True,
                "no_warnings": True,
                "noplaylist": True,
                "skip_download": True,
            }
        )
        _YDL_LOCAL.ydl = ydl
    return ydl


def get_audio_stream_url(video_id: str) -> Optional[Dict[str, Any]]:
    """
    Resolves the direct high-quality m4a audio stream URL for any YouTube video_id
    using a persistent thread-local yt-dlp instance (keeps player JS cached in memory).
    Caches stream URLs for 25 minutes.
    """
    if not video_id:
        return None

    now = time.time()
    cached = _STREAM_CACHE.get(video_id)
    if cached and (now - cached.get("ts", 0)) < 1500:
        return cached

    try:
        ydl = _get_ydl()
        info = ydl.extract_info(f"https://www.youtube.com/watch?v={video_id}", download=False)
        stream_url = info.get("url")
        if not stream_url:
            return None
        ext = info.get("ext", "m4a")
        mime = "audio/mp4" if ext == "m4a" else f"audio/{ext}"
        clen = int(info.get("filesize") or info.get("filesize_approx") or 0)
        if not clen:
            qs = urllib.parse.parse_qs(urllib.parse.urlparse(stream_url).query)
            if "clen" in qs:
                clen = int(qs["clen"][0])
        ua = (info.get("http_headers") or {}).get(
            "User-Agent",
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
        )
        entry = {
            "url": stream_url,
            "mime": mime,
            "clen": clen,
            "ua": ua,
            "title": info.get("title", ""),
            "uploader": info.get("uploader", ""),
            "duration": info.get("duration", 0),
            "ts": now,
        }
        _STREAM_CACHE[video_id] = entry
        return entry
    except Exception as e:
        print(f"yt-dlp stream extraction error for {video_id}: {e}")
        return None


def prefetch_streams_async(video_ids: List[str]) -> None:
    """Warm up the stream cache in the background for the top tracks in a playlist."""
    def _warm(vid: str):
        if vid and vid not in _STREAM_CACHE:
            get_audio_stream_url(vid)

    pool = concurrent.futures.ThreadPoolExecutor(max_workers=3)
    for v in video_ids[:3]:
        pool.submit(_warm, v)
    pool.shutdown(wait=False)


def search_youtube_music_catalog(query: str, max_items: int = 12) -> List[Dict[str, str]]:
    """
    Queries YouTube Music's live WEB_REMIX API to fetch real, verified songs/videos
    matching the user's query so AI curation is grounded in real tracks.
    """
    q_clean = query.strip()
    if not q_clean:
        return []

    sub_queries = [q_clean, f"{q_clean} songs ost"]
    seen_titles = set()
    catalog: List[Dict[str, str]] = []

    def _fetch_one(q: str) -> List[Dict[str, str]]:
        out: List[Dict[str, str]] = []
        try:
            url = "https://music.youtube.com/youtubei/v1/search?prettyPrint=false"
            payload = {
                "context": {
                    "client": {
                        "clientName": "WEB_REMIX",
                        "clientVersion": "1.20260918.01.00",
                        "hl": "en",
                        "gl": "US",
                    }
                },
                "query": q,
            }
            resp = _SESSION.post(url, json=payload, timeout=4.5)
            if resp.status_code != 200:
                return out
            data = resp.json()
            for item in _find_nodes(data, "musicResponsiveListItemRenderer"):
                vid = item.get("playlistItemData", {}).get("videoId", "")
                if not vid or len(vid) != 11:
                    continue
                cols = []
                for c in item.get("flexColumns", []):
                    runs = (
                        c.get("musicResponsiveListItemFlexColumnRenderer", {})
                        .get("text", {})
                        .get("runs", [])
                    )
                    cols.append("".join(x.get("text", "") for x in runs).strip())
                if len(cols) < 2:
                    continue
                title = cols[0]
                meta = cols[1]
                if "Episode" in meta or "Podcast" in meta:
                    continue
                parts = [p.strip() for p in meta.split("•") if p.strip()]
                artist = parts[1] if len(parts) >= 2 else meta
                dur_match = re.search(r"\b([0-9]{1,2}:[0-9]{2})\b", meta)
                out.append(
                    {
                        "title": title,
                        "artist": artist,
                        "video_id": vid,
                        "duration_text": dur_match.group(1) if dur_match else "",
                    }
                )
        except Exception:
            pass
        return out

    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        for batch in pool.map(_fetch_one, sub_queries):
            for item in batch:
                norm = f"{item['title'].lower()}::{item['artist'].lower()}"
                if norm not in seen_titles:
                    seen_titles.add(norm)
                    catalog.append(item)
                    if len(catalog) >= max_items:
                        return catalog
    return catalog


def search_youtube_single(query: str) -> Optional[Dict]:
    """
    Uses YouTube Music's WEB_REMIX Innertube JSON API to resolve the exact
    structured song/video result, filtering out unrelated bottom-of-page tracks.
    """
    cache_key = query.strip().lower()
    if cache_key in _SEARCH_CACHE:
        return dict(_SEARCH_CACHE[cache_key])

    try:
        url = "https://music.youtube.com/youtubei/v1/search?prettyPrint=false"
        payload = {
            "context": {
                "client": {
                    "clientName": "WEB_REMIX",
                    "clientVersion": "1.20260918.01.00",
                    "hl": "en",
                    "gl": "US",
                }
            },
            "query": query,
        }
        resp = _SESSION.post(url, json=payload, timeout=6.0)
        if resp.status_code != 200:
            return None

        data = resp.json()
        matched_vids: List[str] = []
        matched_durs: List[str] = []

        for item in _find_nodes(data, "musicResponsiveListItemRenderer"):
            vid = item.get("playlistItemData", {}).get("videoId", "")
            if not vid or len(vid) != 11:
                continue
            cols = []
            for c in item.get("flexColumns", []):
                runs = (
                    c.get("musicResponsiveListItemFlexColumnRenderer", {})
                    .get("text", {})
                    .get("runs", [])
                )
                cols.append("".join(x.get("text", "") for x in runs).strip())
            meta = cols[1] if len(cols) >= 2 else ""
            if "Episode" in meta or "Podcast" in meta:
                continue
            # Never allow random nursery rhymes / Release - Topic mismatches
            if "Release - Topic" in meta or "Lights on the Ceiling" in meta:
                continue
            if vid not in matched_vids:
                matched_vids.append(vid)
                dur_match = re.search(r"\b([0-9]{1,2}:[0-9]{2})\b", " ".join(cols))
                if dur_match:
                    matched_durs.append(dur_match.group(1))

        if not matched_vids:
            text = resp.text
            matched_vids = list(dict.fromkeys(re.findall(r'"videoId":"([a-zA-Z0-9_-]{11})"', text)))
            matched_durs = re.findall(r'"text":"([0-9]{1,2}:[0-9]{2})"', text)

        if not matched_vids:
            return None

        video_id = matched_vids[0]
        fallback_ids = matched_vids[1:4]
        duration_text = matched_durs[0] if matched_durs else "3:42"

        result = {
            "video_id": video_id,
            "fallback_ids": fallback_ids,
            "duration_text": duration_text,
            "thumbnail": f"https://i.ytimg.com/vi/{video_id}/hqdefault.jpg",
            "url": f"https://www.youtube.com/watch?v={video_id}",
            "embed_url": f"https://www.youtube.com/embed/{video_id}?autoplay=1&enablejsapi=1",
        }
        _SEARCH_CACHE[cache_key] = result
        return dict(result)
    except Exception as e:
        print(f"Search error for '{query}': {e}")
        return None


def resolve_tracks_batch(tracks: List[Dict]) -> List[Dict]:
    """Resolves video IDs, fallback IDs, real durations, and thumbnails in parallel."""

    def _resolve_one(track: Dict) -> Dict:
        vid = track.get("video_id", "")
        has_valid_dur = bool(track.get("duration_text")) and track.get("duration_text") not in ("--:--", "3:30")
        if vid and len(vid) == 11 and has_valid_dur and track.get("thumbnail") and track.get("fallback_ids"):
            track["url"] = f"https://www.youtube.com/watch?v={vid}"
            track["embed_url"] = f"https://www.youtube.com/embed/{vid}?autoplay=1&enablejsapi=1"
            return track

        search_q = track.get("search_query") or f"{track.get('title', '')} {track.get('artist', '')}"
        matched = search_youtube_single(search_q)
        if matched:
            track["video_id"] = matched["video_id"]
            track["fallback_ids"] = list(matched.get("fallback_ids", []))
            track["thumbnail"] = matched["thumbnail"]
            track["duration_text"] = matched.get("duration_text", "")
            track["url"] = matched["url"]
            track["embed_url"] = matched["embed_url"]
        else:
            q_enc = urllib.parse.quote(f"{track.get('title', '')} {track.get('artist', '')}")
            track["video_id"] = vid or ""
            track["fallback_ids"] = []
            track["thumbnail"] = f"https://i.ytimg.com/vi/{vid}/hqdefault.jpg" if vid else ""
            track["duration_text"] = ""
            track["url"] = f"https://www.youtube.com/results?search_query={q_enc}"
            track["embed_url"] = ""
        return track

    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
        resolved = list(executor.map(_resolve_one, tracks))

    used_vids = set()
    for tr in resolved:
        vid = tr.get("video_id", "")
        if vid and vid in used_vids:
            for alt_id in tr.get("fallback_ids", []):
                if alt_id and alt_id not in used_vids:
                    tr["video_id"] = alt_id
                    tr["thumbnail"] = f"https://i.ytimg.com/vi/{alt_id}/hqdefault.jpg"
                    tr["url"] = f"https://www.youtube.com/watch?v={alt_id}"
                    tr["embed_url"] = f"https://www.youtube.com/embed/{alt_id}?autoplay=1&enablejsapi=1"
                    vid = alt_id
                    break
        if vid:
            used_vids.add(vid)

    # Pre-warm audio stream URLs for the first 3 tracks so playback starts immediately
    top_vids = [tr.get("video_id", "") for tr in resolved if tr.get("video_id")]
    if top_vids:
        prefetch_streams_async(top_vids)

    return resolved


_DIRECT_SEARCH_CACHE: Dict[str, Dict[str, Any]] = {}
_PLAYLIST_BROWSE_CACHE: Dict[str, Dict[str, Any]] = {}

_PLAYLIST_KEYWORDS = (
    "playlist",
    "new ",
    "latest",
    "top ",
    "best ",
    "hits",
    "hitlist",
    "songs",
    "ost",
    "soundtrack",
    "2024",
    "2025",
    "2026",
    "collection",
    "mix",
    "chart",
    "trending",
    "essentials",
)


def _extract_runs_text(col_obj: Dict[str, Any], renderer_key: str) -> str:
    runs = col_obj.get(renderer_key, {}).get("text", {}).get("runs", [])
    return "".join(r.get("text", "") for r in runs).strip()


def browse_youtube_music_playlist(
    browse_id: str, playlist_title: str = "", playlist_subtitle: str = "", max_tracks: int = 35
) -> List[Dict[str, Any]]:
    """
    Fetches tracks inside a prepared YouTube Music playlist (browseId starting with 'VL')
    with zero LLM token usage.
    """
    if not browse_id:
        return []
    now = time.time()
    cached = _PLAYLIST_BROWSE_CACHE.get(browse_id)
    if cached and (now - cached.get("ts", 0)) < 1800:
        return list(cached["tracks"])

    try:
        url = "https://music.youtube.com/youtubei/v1/browse?prettyPrint=false"
        payload = {
            "context": {
                "client": {
                    "clientName": "WEB_REMIX",
                    "clientVersion": "1.20260918.01.00",
                    "hl": "en",
                    "gl": "IN",
                }
            },
            "browseId": browse_id,
        }
        resp = _SESSION.post(url, json=payload, timeout=5.5)
        if resp.status_code != 200:
            return []
        data = resp.json()
        tracks: List[Dict[str, Any]] = []
        seen_vids = set()

        for item in _find_nodes(data, "musicResponsiveListItemRenderer"):
            vid = item.get("playlistItemData", {}).get("videoId", "")
            if not vid or len(vid) != 11 or vid in seen_vids:
                continue

            cols = [_extract_runs_text(c, "musicResponsiveListItemFlexColumnRenderer") for c in item.get("flexColumns", [])]
            fixed = [_extract_runs_text(c, "musicResponsiveListItemFixedColumnRenderer") for c in item.get("fixedColumns", [])]

            title = cols[0] if cols else ""
            artist = cols[1] if len(cols) > 1 else "Unknown Artist"
            extra = cols[2] if len(cols) > 2 else ""
            if not title:
                continue
            if "Episode" in artist or "Podcast" in artist or "Release - Topic" in artist:
                continue

            dur = ""
            if fixed and re.match(r"^\d{1,2}:\d{2}$", fixed[0]):
                dur = fixed[0]
            else:
                dur_m = re.search(r"\b(\d{1,2}:\d{2})\b", " ".join(cols + fixed))
                if dur_m:
                    dur = dur_m.group(1)

            seen_vids.add(vid)
            reason_parts = []
            if extra:
                reason_parts.append(extra)
            if playlist_title:
                reason_parts.append(f"Featured in {playlist_title}")
            reason_str = " • ".join(reason_parts) if reason_parts else "Featured track from official playlist"

            tracks.append(
                {
                    "title": title,
                    "artist": artist,
                    "video_id": vid,
                    "fallback_ids": [],
                    "duration_text": dur,
                    "thumbnail": f"https://i.ytimg.com/vi/{vid}/hqdefault.jpg",
                    "url": f"https://www.youtube.com/watch?v={vid}",
                    "embed_url": f"https://www.youtube.com/embed/{vid}?autoplay=1&enablejsapi=1",
                    "match_tier": "Direct Match",
                    "reason": reason_str,
                    "why_it_fits": reason_str,
                    "vibe": "Playlist",
                }
            )
            if len(tracks) >= max_tracks:
                break

        _PLAYLIST_BROWSE_CACHE[browse_id] = {"tracks": tracks, "ts": now}
        return tracks
    except Exception as e:
        print(f"Playlist browse error for '{browse_id}': {e}")
        return []


_YT_WEB_CONTEXT = {
    "client": {
        "clientName": "WEB",
        "clientVersion": "2.20260918.01.00",
        "hl": "en",
        "gl": "IN",
    }
}
_YTM_SEARCH_CONTEXT = {
    "client": {
        "clientName": "WEB_REMIX",
        "clientVersion": "1.20260918.01.00",
        "hl": "en",
        "gl": "IN",
    }
}
_YTM_SONGS_PARAM = "EgWKAQIIAWoKEAkQBRAKEAMQBA=="
_STOPWORDS = {"songs", "song", "music", "the", "a", "an", "of", "and", "best", "top", "new", "latest", "playlist", "mix", "for", "to", "in"}


def _runs_text(obj: Any) -> str:
    if not isinstance(obj, dict):
        return ""
    if "simpleText" in obj:
        return obj.get("simpleText", "")
    return "".join(r.get("text", "") for r in obj.get("runs", []))


def _query_tokens(q: str) -> List[str]:
    toks = re.findall(r"[a-z0-9]+", q.lower())
    core = [t for t in toks if t not in _STOPWORDS]
    return core or toks


def _relevance(text: str, tokens: List[str]) -> float:
    if not tokens:
        return 0.0
    t = text.lower()
    return sum(1 for tok in tokens if tok in t) / len(tokens)


def _duration_to_seconds(d: str) -> int:
    try:
        parts = [int(p) for p in d.split(":")]
    except ValueError:
        return 0
    secs = 0
    for p in parts:
        secs = secs * 60 + p
    return secs


def _yt_web_search(query: str, pages: int = 2) -> Dict[str, Any]:
    """Exact same results (and order) as typing the query on youtube.com."""
    url = "https://www.youtube.com/youtubei/v1/search?prettyPrint=false"
    videos: List[Dict[str, Any]] = []
    playlists: List[Dict[str, Any]] = []
    seen_v, seen_p = set(), set()
    payload: Dict[str, Any] = {"context": _YT_WEB_CONTEXT, "query": query}

    for _ in range(max(1, pages)):
        try:
            r = _SESSION.post(url, json=payload, timeout=5.0)
            if r.status_code != 200:
                break
            data = r.json()
        except Exception:
            break

        for v in _find_nodes(data, "videoRenderer"):
            vid = v.get("videoId", "")
            dur = _runs_text(v.get("lengthText", {}))
            # Skip live streams / premieres (no fixed duration, not streamable as a track)
            if not vid or len(vid) != 11 or vid in seen_v or not dur:
                continue
            seen_v.add(vid)
            title = _runs_text(v.get("title", {}))
            channel = _runs_text(v.get("ownerText", {})) or _runs_text(v.get("longBylineText", {}))
            views = _runs_text(v.get("shortViewCountText", {})) or _runs_text(v.get("viewCountText", {}))
            published = _runs_text(v.get("publishedTimeText", {}))
            meta = " • ".join(x for x in (views, published) if x)
            videos.append(
                {
                    "title": title,
                    "artist": channel or "YouTube",
                    "video_id": vid,
                    "fallback_ids": [],
                    "duration_text": dur,
                    "thumbnail": f"https://i.ytimg.com/vi/{vid}/hqdefault.jpg",
                    "url": f"https://www.youtube.com/watch?v={vid}",
                    "embed_url": f"https://www.youtube.com/embed/{vid}?autoplay=1&enablejsapi=1",
                    "match_tier": "Direct Match",
                    "reason": meta or "YouTube search result",
                    "why_it_fits": meta or "YouTube search result",
                    "vibe": "YouTube",
                    "duration_sec": _duration_to_seconds(dur),
                }
            )

        for lk in _find_nodes(data, "lockupViewModel"):
            if lk.get("contentType") != "LOCKUP_CONTENT_TYPE_PLAYLIST":
                continue
            pid = lk.get("contentId", "")
            # Radio mixes (RD...) are generated per-user and can't be browsed
            if not pid or pid.startswith("RD") or pid in seen_p:
                continue
            seen_p.add(pid)
            md = lk.get("metadata", {}).get("lockupMetadataViewModel", {})
            title = md.get("title", {}).get("content", "")
            owner = ""
            for row in md.get("metadata", {}).get("contentMetadataViewModel", {}).get("metadataRows", []):
                for part in row.get("metadataParts", []):
                    txt = part.get("text", {}).get("content", "")
                    if txt and txt != "Playlist" and not owner:
                        owner = txt
            if title:
                playlists.append(
                    {
                        "browse_id": f"VL{pid}",
                        "title": title,
                        "subtitle": f"YouTube Playlist • {owner}" if owner else "YouTube Playlist",
                        "thumbnail": "",
                        "is_editorial": False,
                        "source": "youtube",
                    }
                )

        tokens = [c.get("token") for c in _find_nodes(data, "continuationCommand") if c.get("token")]
        if not tokens:
            break
        payload = {"context": _YT_WEB_CONTEXT, "continuation": tokens[0]}

    return {"videos": videos, "playlists": playlists}


def _ytm_search(query: str, songs_only: bool) -> Dict[str, Any]:
    url = "https://music.youtube.com/youtubei/v1/search?prettyPrint=false"
    body: Dict[str, Any] = {"context": _YTM_SEARCH_CONTEXT, "query": query}
    if songs_only:
        body["params"] = _YTM_SONGS_PARAM
    try:
        r = _SESSION.post(url, json=body, timeout=5.0)
        return r.json() if r.status_code == 200 else {}
    except Exception:
        return {}


def _parse_ytm_songs(data: Dict[str, Any]) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    seen = set()
    for item in _find_nodes(data, "musicResponsiveListItemRenderer"):
        vid = item.get("playlistItemData", {}).get("videoId", "")
        if not vid or len(vid) != 11 or vid in seen:
            continue
        cols = [_extract_runs_text(c, "musicResponsiveListItemFlexColumnRenderer") for c in item.get("flexColumns", [])]
        fixed = [_extract_runs_text(c, "musicResponsiveListItemFixedColumnRenderer") for c in item.get("fixedColumns", [])]
        if not cols or not cols[0]:
            continue
        meta = cols[1] if len(cols) > 1 else ""
        plays = cols[2] if len(cols) > 2 else ""
        if any(b in meta for b in ("Episode", "Podcast", "Release - Topic")):
            continue
        parts = [p.strip() for p in meta.split("•") if p.strip()]
        if parts and parts[0] in ("Song", "Video"):
            parts = parts[1:]
        dur = ""
        if fixed and re.match(r"^\d{1,2}:\d{2}(:\d{2})?$", fixed[0]):
            dur = fixed[0]
        elif parts and re.match(r"^\d{1,2}:\d{2}(:\d{2})?$", parts[-1]):
            dur = parts.pop()
        else:
            m = re.search(r"\b(\d{1,2}:\d{2}(?::\d{2})?)\b", " ".join(cols + fixed))
            if m:
                dur = m.group(1)
        artist = parts[0] if parts else "Unknown Artist"
        album = parts[1] if len(parts) > 1 else ""
        bits = []
        if album and album.lower() != cols[0].lower():
            bits.append(f"Album: {album}")
        if plays:
            bits.append(plays)
        reason = " • ".join(bits) if bits else "YouTube Music song"
        seen.add(vid)
        out.append(
            {
                "title": cols[0],
                "artist": artist,
                "video_id": vid,
                "fallback_ids": [],
                "duration_text": dur,
                "thumbnail": f"https://i.ytimg.com/vi/{vid}/hqdefault.jpg",
                "url": f"https://www.youtube.com/watch?v={vid}",
                "embed_url": f"https://www.youtube.com/embed/{vid}?autoplay=1&enablejsapi=1",
                "match_tier": "Direct Match",
                "reason": reason,
                "why_it_fits": reason,
                "vibe": "YT Music",
            }
        )
        if len(out) >= 25:
            break
    return out


def _parse_ytm_playlists(data: Dict[str, Any]) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    seen = set()
    for item in _find_nodes(data, "musicResponsiveListItemRenderer"):
        bid = item.get("navigationEndpoint", {}).get("browseEndpoint", {}).get("browseId", "")
        if not bid.startswith("VL") or bid in seen:
            continue
        cols = [_extract_runs_text(c, "musicResponsiveListItemFlexColumnRenderer") for c in item.get("flexColumns", [])]
        if not cols or not cols[0]:
            continue
        meta = cols[1] if len(cols) > 1 else "Playlist"
        seen.add(bid)
        out.append(
            {
                "browse_id": bid,
                "title": cols[0],
                "subtitle": meta,
                "thumbnail": "",
                "is_editorial": "YouTube Music" in meta or bid.startswith("VLRDCLAK"),
                "source": "ytmusic",
            }
        )
    return out


def direct_search_youtube_music(query: str, mode: str = "auto") -> Dict[str, Any]:
    """
    Zero-token direct search that mirrors youtube.com.
    - Primary results = YouTube search results in YouTube's exact relevance order.
    - Secondary: YouTube Music "Songs" results + matching playlists (only those actually
      relevant to the query), selectable with one tap.
    - A playlist is auto-loaded ONLY when the user explicitly asks for one
      (query contains "playlist") or mode == "playlists".
    """
    q_clean = query.strip()
    if not q_clean:
        return {"playlist_title": "Direct Search", "tracks": [], "matched_playlists": [], "song_results": []}

    cache_key = f"{q_clean.lower()}::{mode}"
    now = time.time()
    cached = _DIRECT_SEARCH_CACHE.get(cache_key)
    if cached and (now - cached.get("ts", 0)) < 1200:
        return dict(cached["data"])

    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        f_yt = pool.submit(_yt_web_search, q_clean, 2)
        f_ytm_songs = pool.submit(_ytm_search, q_clean, True)
        f_ytm_all = pool.submit(_ytm_search, q_clean, False)
        yt = f_yt.result()
        ytm_songs = _parse_ytm_songs(f_ytm_songs.result())
        ytm_playlists = _parse_ytm_playlists(f_ytm_all.result())

    youtube_results = yt["videos"][:40]
    tokens = _query_tokens(q_clean)

    # Playlists: keep YouTube's order, then YT Music ones, but only if their title actually
    # matches the query (no more "Jazzhop Studies" for "lofi rap songs").
    candidate_pls = yt["playlists"] + ytm_playlists
    matched_playlists: List[Dict[str, Any]] = []
    seen_titles = set()
    for pl in candidate_pls:
        key = pl["title"].strip().lower()
        if key in seen_titles:
            continue
        score = _relevance(pl["title"], tokens)
        if score < 0.5:
            continue
        seen_titles.add(key)
        pl["relevance"] = round(score, 2)
        matched_playlists.append(pl)
    # Stable sort: higher relevance first, original (YouTube) order preserved within ties
    matched_playlists.sort(key=lambda p: -p["relevance"])
    matched_playlists = matched_playlists[:6]

    q_lower = q_clean.lower()
    wants_playlist = mode == "playlists" or (mode == "auto" and "playlist" in q_lower)
    wants_ytm = mode == "songs"

    active_source = "youtube"
    active_browse_id = ""
    tracks = youtube_results
    playlist_title = f'"{q_clean}"'
    vibe = f"YouTube results • {len(youtube_results)} videos • same order as youtube.com (0 AI tokens)"

    if wants_ytm and ytm_songs:
        active_source = "songs"
        tracks = ytm_songs
        vibe = f"YouTube Music songs • {len(ytm_songs)} results (0 AI tokens)"
    elif wants_playlist and matched_playlists:
        top = matched_playlists[0]
        pl_tracks = browse_youtube_music_playlist(top["browse_id"], top["title"], top["subtitle"])
        if pl_tracks:
            tracks = pl_tracks
            active_source = "playlist"
            active_browse_id = top["browse_id"]
            playlist_title = top["title"]
            vibe = f"{top['subtitle']} • playlist for \"{q_clean}\" (0 AI tokens)"

    if not tracks:
        # Fall back gracefully if YouTube web search was blocked
        tracks = ytm_songs
        active_source = "songs"

    if tracks:
        prefetch_streams_async([t["video_id"] for t in tracks[:3] if t.get("video_id")])

    result_payload = {
        "playlist_title": playlist_title,
        "subtitle": vibe,
        "vibe_description": vibe,
        "curator_note": vibe,
        "used_model": "direct-search (0 tokens)",
        "requested_model": "direct-search",
        "is_fallback": False,
        "is_direct_search": True,
        "search_query": q_clean,
        "active_source": active_source,
        "active_browse_id": active_browse_id,
        "matched_playlists": matched_playlists,
        "youtube_results": youtube_results,
        "song_results": ytm_songs,
        "tracks": tracks,
    }
    _DIRECT_SEARCH_CACHE[cache_key] = {"data": result_payload, "ts": now}
    return dict(result_payload)
