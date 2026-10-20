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


def get_audio_stream_url(video_id: str) -> Optional[Dict[str, Any]]:
    """
    Uses yt-dlp to resolve the direct high-quality m4a/webm audio stream URL
    for any YouTube video_id (including official Sony Music / Aniplex Topic tracks
    that block iframe embedding). Caches URLs for 25 minutes.
    """
    if not video_id:
        return None

    now = time.time()
    cached = _STREAM_CACHE.get(video_id)
    if cached and (now - cached.get("ts", 0)) < 1500:
        return cached

    ydl_opts = {
        "format": "bestaudio[ext=m4a]/bestaudio/best",
        "quiet": True,
        "no_warnings": True,
        "noplaylist": True,
        "skip_download": True,
    }
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(f"https://www.youtube.com/watch?v={video_id}", download=False)
            stream_url = info.get("url")
            if not stream_url:
                return None
            ext = info.get("ext", "m4a")
            mime = "audio/mp4" if ext == "m4a" else f"audio/{ext}"
            entry = {
                "url": stream_url,
                "mime": mime,
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
