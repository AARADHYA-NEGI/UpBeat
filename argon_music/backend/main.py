import os
from typing import Dict, List, Any, Optional
import requests as ext_requests
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from argon_music.backend.safari_bridge import (
    list_safari_tabs,
    open_safari_url,
    extract_all_safari_yt_tracks,
    get_safari_now_playing,
    control_safari,
)
from argon_music.backend.curator import analyze_taste_dna, curate_playlist
from argon_music.backend.youtube_search import (
    resolve_tracks_batch,
    search_youtube_single,
    get_audio_stream_url,
    direct_search_youtube_music,
    browse_youtube_music_playlist,
    format_seconds,
)
from argon_music.backend.favorites_store import get_favorites, toggle_favorite

app = FastAPI(title="UpBeat Music API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class SafariOpenRequest(BaseModel):
    destination: str = Field("yt_liked", description="music, music_liked, yt_liked, yt_history, custom")
    custom_url: Optional[str] = None


class SafariExtractRequest(BaseModel):
    window_idx: Optional[int] = None
    tab_idx: Optional[int] = None


class SafariControlRequest(BaseModel):
    action: str = Field("play_pause", description="play_pause, next, prev")
    window_idx: Optional[int] = None
    tab_idx: Optional[int] = None


class CurateRequest(BaseModel):
    seed_tracks: List[Dict[str, Any]] = Field(default_factory=list)
    mood_prompt: str = Field("Focused late night session")
    energy_level: int = Field(78, ge=0, le=100)
    count: int = Field(8, ge=3, le=25)
    model_name: str = Field("gemini-3.8-flash")


class TasteDnaRequest(BaseModel):
    tracks: List[Dict[str, Any]] = Field(default_factory=list)
    model_name: str = Field("gemini-3.8-flash")


@app.get("/api/status")
def get_status():
    return {
        "status": "online",
        "app": "UpBeat",
        "models": [
            {"id": "gemini-3.8-flash", "name": "Gemini 3.8 Flash (Active)", "recommended": True},
            {"id": "gemini-4-argon", "name": "Gemini 4 Argon / ER-2 (1s Fast)", "recommended": True},
            {"id": "gemini-3.1-flash-lite", "name": "Gemini 3.1 Flash Lite (2s Fast)", "recommended": False},
            {"id": "gemini-3.5-flash-lite", "name": "Gemini 3.5 Flash Lite (Active)", "recommended": False},
            {"id": "gemini-flash-lite-latest", "name": "Gemini Flash Lite Latest", "recommended": False},
            {"id": "gemini-3-flash-preview", "name": "Gemini 3 Flash Preview", "recommended": False},
            {"id": "gemini-2.5-flash", "name": "Gemini 2.5 Flash", "recommended": False},
            {"id": "gemma-4-26b-a4b-it", "name": "Gemma 4 26B MoE", "recommended": False},
        ],
    }


@app.get("/api/safari/tabs")
def get_safari_tabs():
    tabs = list_safari_tabs(use_cache=True)
    yt_tabs = [t for t in tabs if t.get("is_yt")]
    return {
        "tabs": tabs,
        "yt_tabs": yt_tabs,
        "has_yt": len(yt_tabs) > 0,
    }


@app.post("/api/safari/open")
def open_in_safari(req: SafariOpenRequest):
    url_map = {
        "music": "https://music.youtube.com",
        "music_liked": "https://music.youtube.com/playlist?list=LM",
        "yt_liked": "https://www.youtube.com/playlist?list=LL",
        "yt_history": "https://www.youtube.com/feed/history",
    }
    target_url = req.custom_url or url_map.get(req.destination, "https://www.youtube.com/playlist?list=LL")
    return open_safari_url(target_url)


@app.post("/api/safari/extract")
def extract_safari_data(req: SafariExtractRequest):
    result = extract_all_safari_yt_tracks(req.window_idx, req.tab_idx)
    if result.get("error") and not result.get("tracks"):
        raise HTTPException(
            status_code=404,
            detail=result["error"],
        )
    return result


@app.get("/api/safari/now-playing")
def get_now_playing():
    np = get_safari_now_playing()
    return {"now_playing": np}


@app.post("/api/safari/control")
def send_control(req: SafariControlRequest):
    return control_safari(req.action, req.window_idx, req.tab_idx)


@app.post("/api/taste-dna")
def get_taste_profile(req: TasteDnaRequest):
    return analyze_taste_dna(req.tracks, model_name=req.model_name)


@app.post("/api/curate")
def generate_playlist(req: CurateRequest):
    try:
        # Auto-pull from Safari if seed_tracks is empty and Safari has YT open
        seeds = req.seed_tracks
        if not seeds:
            extracted = extract_all_safari_yt_tracks()
            seeds = extracted.get("tracks", [])

        playlist_data = curate_playlist(
            seed_tracks=seeds,
            mood_prompt=req.mood_prompt,
            energy_level=req.energy_level,
            count=req.count,
            model_name=req.model_name,
        )

        tracks = playlist_data.get("tracks", [])
        if tracks:
            playlist_data["tracks"] = resolve_tracks_batch(tracks)

        return playlist_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/search")
def search_track(q: str):
    res = search_youtube_single(q)
    if not res:
        raise HTTPException(status_code=404, detail="Track not found")
    return res


@app.get("/api/direct-search")
def direct_search_endpoint(q: str, mode: str = "auto"):
    """Zero-token direct YouTube Music lookup for both prepared playlists and songs."""
    return direct_search_youtube_music(q, mode=mode)


@app.get("/api/playlist-browse")
def playlist_browse_endpoint(browse_id: str, title: str = "", subtitle: str = ""):
    """Fetches tracks inside a prepared YouTube Music playlist (0 AI tokens)."""
    tracks = browse_youtube_music_playlist(browse_id, playlist_title=title, playlist_subtitle=subtitle)
    return {
        "browse_id": browse_id,
        "title": title,
        "subtitle": subtitle,
        "tracks": tracks,
    }


class ResolveBatchRequest(BaseModel):
    tracks: List[Dict[str, Any]] = Field(default_factory=list)


@app.post("/api/resolve-batch")
def resolve_batch_endpoint(req: ResolveBatchRequest):
    return {"tracks": resolve_tracks_batch(req.tracks)}


class FavoriteTrackRequest(BaseModel):
    track: Dict[str, Any]


@app.get("/api/favorites")
def list_favorites():
    return {"favorites": get_favorites()}


@app.post("/api/favorites/toggle")
def toggle_favorite_endpoint(req: FavoriteTrackRequest):
    return toggle_favorite(req.track)


@app.get("/api/audio-info/{video_id}")
def audio_info_endpoint(video_id: str):
    info = get_audio_stream_url(video_id)
    if not info or not info.get("url"):
        raise HTTPException(status_code=404, detail="Audio stream unavailable")
    dur_sec = int(info.get("duration") or 0)
    return {
        "video_id": video_id,
        "duration": dur_sec,
        "duration_text": format_seconds(dur_sec),
        "url": f"/api/audio/{video_id}",
        "title": info.get("title", ""),
        "artist": info.get("uploader", ""),
    }


_STREAM_HTTP_SESSION = ext_requests.Session()
_STREAM_HTTP_SESSION.mount(
    "https://",
    ext_requests.adapters.HTTPAdapter(pool_connections=16, pool_maxsize=16, max_retries=2),
)
_STREAM_CHUNK_BYTES = 2 * 1024 * 1024  # 2 MB bounded ranges prevent googlevideo.com 128 KB throttling on open-ended ranges


@app.api_route("/api/audio/{video_id}", methods=["GET", "HEAD"])
def stream_audio_endpoint(video_id: str, request: Request):
    """
    Streams the exact official audio track (m4a/mp4) directly from YouTube.
    Fetches upstream in bounded 2 MB Range chunks so googlevideo.com never throttles
    open-ended Range: bytes=0- requests on long mixes or DASH streams.
    """
    info = get_audio_stream_url(video_id)
    if not info or not info.get("url"):
        raise HTTPException(status_code=404, detail="Audio stream unavailable")

    stream_url = info["url"]
    ua = info.get(
        "ua",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
    )
    total_size = int(info.get("clen") or 0)

    # If total_size wasn't in metadata, probe the first 2 bytes to discover Content-Range total
    if total_size <= 0:
        probe = _STREAM_HTTP_SESSION.get(
            stream_url,
            headers={"User-Agent": ua, "Range": "bytes=0-1"},
            stream=True,
            timeout=10,
        )
        cr = probe.headers.get("Content-Range", "")
        probe.close()
        if "/" in cr:
            try:
                total_size = int(cr.split("/")[-1])
                info["clen"] = total_size
            except ValueError:
                total_size = 0

    range_header = request.headers.get("range") or request.headers.get("Range")
    start = 0
    end = (total_size - 1) if total_size > 0 else None
    is_partial = False

    if range_header and range_header.strip().lower().startswith("bytes="):
        is_partial = True
        spec = range_header.strip()[6:].split(",")[0].strip()
        parts = spec.split("-", 1)
        if parts[0]:
            start = int(parts[0])
            if len(parts) > 1 and parts[1]:
                end = int(parts[1])
        elif len(parts) > 1 and parts[1] and total_size > 0:
            suffix = int(parts[1])
            start = max(0, total_size - suffix)
            end = total_size - 1

    if total_size > 0 and (end is None or end >= total_size):
        end = total_size - 1

    resp_headers = {
        "Accept-Ranges": "bytes",
        "Cache-Control": "public, max-age=3600",
    }
    if info.get("duration"):
        resp_headers["X-Track-Duration"] = str(info["duration"])
    status_code = 206 if (is_partial or total_size > 0) else 200
    if total_size > 0 and end is not None:
        content_len = max(0, end - start + 1)
        resp_headers["Content-Length"] = str(content_len)
        if status_code == 206:
            resp_headers["Content-Range"] = f"bytes {start}-{end}/{total_size}"

    if request.method == "HEAD":
        return Response(
            content=b"",
            status_code=status_code,
            media_type=info.get("mime", "audio/mp4"),
            headers=resp_headers,
        )

    def _iter_chunks():
        pos = start
        target_end = end
        while target_end is None or pos <= target_end:
            chunk_end = (
                min(pos + _STREAM_CHUNK_BYTES - 1, target_end)
                if target_end is not None
                else (pos + _STREAM_CHUNK_BYTES - 1)
            )
            r = _STREAM_HTTP_SESSION.get(
                stream_url,
                headers={"User-Agent": ua, "Range": f"bytes={pos}-{chunk_end}"},
                stream=True,
                timeout=15,
            )
            try:
                if r.status_code not in (200, 206):
                    break
                received = 0
                for piece in r.iter_content(chunk_size=65536):
                    if piece:
                        received += len(piece)
                        yield piece
                if received == 0:
                    break
                pos += received
                if target_end is None and received < _STREAM_CHUNK_BYTES:
                    break
            finally:
                r.close()

    return StreamingResponse(
        _iter_chunks(),
        status_code=status_code,
        media_type=info.get("mime", "audio/mp4"),
        headers=resp_headers,
    )


frontend_dist = os.path.join(os.path.dirname(__file__), "../frontend/dist")
if os.path.exists(frontend_dist):
    app.mount("/", StaticFiles(directory=frontend_dist, html=True), name="static")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("argon_music.backend.main:app", host="0.0.0.0", port=8000, reload=True)
