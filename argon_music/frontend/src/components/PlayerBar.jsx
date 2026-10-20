import React, { useState, useEffect, useRef } from 'react'
import {
  Play, Pause, SkipForward, SkipBack, Volume2, VolumeX,
  ExternalLink, Video, Music, Heart
} from 'lucide-react'

function formatTime(sec) {
  if (!sec || isNaN(sec) || sec < 0) return '0:00'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export default function PlayerBar({
  currentTrack,
  isPlaying,
  setIsPlaying,
  onTogglePlay,
  onNext,
  onPrev,
  playbackMode,
  setPlaybackMode,
  onPushToSafari,
  safariNowPlaying,
  onSafariControl,
  onTrackResolved,
  isTrackFavorite,
  onToggleFavorite
}) {
  const [showVideo, setShowVideo] = useState(false)
  const [volume, setVolume] = useState(80)
  const [isMuted, setIsMuted] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [resolvedVid, setResolvedVid] = useState('')

  const playerRef = useRef(null)
  const currentVidRef = useRef('')
  const fallbackQueueRef = useRef([])
  const endedTriggeredRef = useRef(false)

  // Always keep latest callbacks in refs so YT.Player event listeners never use stale closures
  const onNextRef = useRef(onNext)
  const isPlayingRef = useRef(isPlaying)
  useEffect(() => {
    onNextRef.current = onNext
  }, [onNext])
  useEffect(() => {
    isPlayingRef.current = isPlaying
  }, [isPlaying])

  const track = currentTrack || (safariNowPlaying ? {
    title: safariNowPlaying.title || 'Safari Audio',
    artist: safariNowPlaying.artist || 'Safari',
    thumbnail: safariNowPlaying.thumbnail || '',
    video_id: safariNowPlaying.video_id || '',
    fallback_ids: [],
    url: safariNowPlaying.url || ''
  } : null)

  // Resolve video_id if track lacks one
  useEffect(() => {
    endedTriggeredRef.current = false
    if (!track) {
      setResolvedVid('')
      fallbackQueueRef.current = []
      return
    }
    if (track.video_id) {
      setResolvedVid(track.video_id)
      fallbackQueueRef.current = [...(track.fallback_ids || [])]
      return
    }
    const q = encodeURIComponent(`${track.title} ${track.artist} audio`)
    fetch(`/api/search?q=${q}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.video_id) {
          setResolvedVid(data.video_id)
          fallbackQueueRef.current = [...(data.fallback_ids || [])]
          if (onTrackResolved) {
            onTrackResolved(track, data)
          }
        }
      })
      .catch(() => {})
  }, [track?.title, track?.artist, track?.video_id])

  // Load YouTube IFrame API once
  useEffect(() => {
    if (window.YT && window.YT.Player) return
    const existing = document.getElementById('yt-iframe-api-script')
    if (!existing) {
      const tag = document.createElement('script')
      tag.id = 'yt-iframe-api-script'
      tag.src = 'https://www.youtube.com/iframe_api'
      document.body.appendChild(tag)
    }
  }, [])

  // Initialize or load new video in YT.Player
  useEffect(() => {
    if (!resolvedVid || playbackMode !== 'app') return

    let cancelled = false

    const initOrLoad = () => {
      if (cancelled) return
      if (!window.YT || !window.YT.Player) {
        setTimeout(initOrLoad, 200)
        return
      }

      if (!playerRef.current) {
        playerRef.current = new window.YT.Player('argon-yt-player-mount', {
          height: '100%',
          width: '100%',
          videoId: resolvedVid,
          playerVars: {
            autoplay: isPlayingRef.current ? 1 : 0,
            controls: 1,
            rel: 0,
            modestbranding: 1,
            playsinline: 1
          },
          events: {
            onReady: (e) => {
              currentVidRef.current = resolvedVid
              e.target.setVolume(isMuted ? 0 : volume)
              if (isPlayingRef.current) {
                e.target.playVideo()
              }
            },
            onStateChange: (e) => {
              // YT.PlayerState.ENDED === 0, PLAYING === 1, PAUSED === 2
              if (e.data === 0) {
                if (!endedTriggeredRef.current) {
                  endedTriggeredRef.current = true
                  onNextRef.current()
                }
              } else if (e.data === 1) {
                endedTriggeredRef.current = false
                setIsPlaying(true)
                const dur = e.target.getDuration()
                if (dur) setDuration(dur)
              } else if (e.data === 2) {
                setIsPlaying(false)
              }
            },
            onError: (e) => {
              // Error 101 / 150 = owner blocked embed; try next fallback video ID
              if (fallbackQueueRef.current.length > 0) {
                const nextAlt = fallbackQueueRef.current.shift()
                currentVidRef.current = nextAlt
                setResolvedVid(nextAlt)
                e.target.loadVideoById(nextAlt)
              } else {
                onNextRef.current()
              }
            }
          }
        })
      } else if (typeof playerRef.current.loadVideoById === 'function') {
        if (currentVidRef.current !== resolvedVid) {
          currentVidRef.current = resolvedVid
          endedTriggeredRef.current = false
          setCurrentTime(0)
          setDuration(0)
          if (isPlayingRef.current) {
            playerRef.current.loadVideoById(resolvedVid)
          } else {
            playerRef.current.cueVideoById(resolvedVid)
          }
        }
      }
    }

    initOrLoad()
    return () => {
      cancelled = true
    }
  }, [resolvedVid, playbackMode])

  // Sync play/pause state with YT.Player
  useEffect(() => {
    const p = playerRef.current
    if (!p || typeof p.getPlayerState !== 'function' || playbackMode !== 'app') return
    try {
      const state = p.getPlayerState()
      if (isPlaying && state !== 1 && state !== 3) {
        p.playVideo()
      } else if (!isPlaying && state === 1) {
        p.pauseVideo()
      }
    } catch {}
  }, [isPlaying, playbackMode])

  // Sync volume with YT.Player
  useEffect(() => {
    const p = playerRef.current
    if (!p || typeof p.setVolume !== 'function') return
    try {
      p.setVolume(isMuted ? 0 : volume)
    } catch {}
  }, [volume, isMuted])

  // Poll playback progress every 400ms + watchdog for end of track
  useEffect(() => {
    const interval = setInterval(() => {
      const p = playerRef.current
      if (p && typeof p.getCurrentTime === 'function' && playbackMode === 'app') {
        try {
          const cur = p.getCurrentTime()
          const dur = p.getDuration()
          const state = p.getPlayerState()
          if (cur !== undefined) setCurrentTime(cur)
          if (dur && dur > 0) {
            setDuration(dur)
            // Backup end-of-track watchdog if browser tab was backgrounded when ENDED fired
            if (state === 0 && !endedTriggeredRef.current) {
              endedTriggeredRef.current = true
              onNextRef.current()
            }
          }
        } catch {}
      }
    }, 400)
    return () => clearInterval(interval)
  }, [playbackMode])

  const handleSeek = (e) => {
    const targetSec = Number(e.target.value)
    setCurrentTime(targetSec)
    const p = playerRef.current
    if (p && typeof p.seekTo === 'function') {
      p.seekTo(targetSec, true)
    }
  }

  const isSafariMode = playbackMode === 'safari'
  const progressPct = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0
  const thumbUrl = track?.thumbnail || (resolvedVid ? `https://i.ytimg.com/vi/${resolvedVid}/hqdefault.jpg` : '')
  const volumeVal = isMuted ? 0 : volume

  return (
    <>
      {/* Persistent YT Player Container */}
      <div
        className={
          showVideo && track && playbackMode === 'app'
            ? 'fixed bottom-20 right-6 z-40 w-80 aspect-video rounded-lg overflow-hidden border border-indigo-500/40 bg-black shadow-2xl'
            : 'fixed bottom-0 right-0 w-[1px] h-[1px] opacity-0 pointer-events-none overflow-hidden'
        }
      >
        <div id="argon-yt-player-mount" className="w-full h-full" />
      </div>

      <footer className="h-[68px] bg-[#0d0d10] border-t border-[#222228] px-5 flex items-center justify-between gap-4 select-none flex-shrink-0 z-30 relative">
        {/* Subtle top accent progress line */}
        {track && duration > 0 && (
          <div
            className="absolute top-0 left-0 h-[1.5px] bg-indigo-500 transition-all duration-300 pointer-events-none"
            style={{ width: `${progressPct}%` }}
          />
        )}

        {/* Left: Prominent Now Playing Track Info + Heart Button */}
        <div className="flex items-center gap-3 w-1/4 min-w-[210px]">
          {track ? (
            <>
              <div className={`w-11 h-11 rounded-md bg-[#18181e] border overflow-hidden flex-shrink-0 relative ${
                isPlaying ? 'border-indigo-500/60 shadow-sm shadow-indigo-500/20' : 'border-[#2a2a32]'
              }`}>
                {thumbUrl ? (
                  <img src={thumbUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[#73737a]">
                    <Music className="w-4 h-4" />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                    isPlaying ? 'bg-indigo-400 animate-pulse' : 'bg-[#666]'
                  }`} />
                  <div className="text-[13px] font-semibold text-[#f5f5f5] truncate">
                    {track.title}
                  </div>
                </div>
                <div className="text-xs text-[#a1a1aa] truncate mt-0.5 pl-3.5">
                  {track.artist}
                </div>
              </div>
              {onToggleFavorite && (
                <button
                  onClick={() => onToggleFavorite(track)}
                  title={isTrackFavorite && isTrackFavorite(track) ? 'Saved in Favorites memory (Click to remove)' : 'Like track & save to Favorites memory'}
                  aria-label="Toggle Favorite"
                  className={`p-1.5 rounded hover:bg-[#1e1e26] transition-colors cursor-pointer flex-shrink-0 ${
                    isTrackFavorite && isTrackFavorite(track) ? 'text-rose-400' : 'text-[#8e8e93] hover:text-rose-300'
                  }`}
                >
                  <Heart className={`w-4 h-4 ${isTrackFavorite && isTrackFavorite(track) ? 'fill-rose-500 text-rose-500' : ''}`} />
                </button>
              )}
            </>
          ) : (
            <div className="text-xs text-[#8e8e93] font-mono">
              No track selected
            </div>
          )}
        </div>

        {/* Center: Transport & High-Visibility Electric Indigo Scrubber */}
        <div className="flex flex-col items-center gap-1.5 flex-1 max-w-xl">
          <div className="flex items-center gap-5">
            <button
              onClick={isSafariMode ? () => onSafariControl('prev') : onPrev}
              disabled={!track}
              className="text-[#a1a1aa] hover:text-white disabled:opacity-30 transition-colors cursor-pointer"
              title="Previous Track"
            >
              <SkipBack className="w-4 h-4" />
            </button>

            <button
              onClick={isSafariMode ? () => onSafariControl('play_pause') : onTogglePlay}
              disabled={!track}
              className="w-8 h-8 rounded-full bg-indigo-500 hover:bg-indigo-400 text-white flex items-center justify-center disabled:opacity-30 transition-all shadow-sm shadow-indigo-500/30 active:scale-95 cursor-pointer"
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? (
                <Pause className="w-4 h-4 fill-current" />
              ) : (
                <Play className="w-4 h-4 fill-current ml-0.5" />
              )}
            </button>

            <button
              onClick={isSafariMode ? () => onSafariControl('next') : onNext}
              disabled={!track}
              className="text-[#a1a1aa] hover:text-white disabled:opacity-30 transition-colors cursor-pointer"
              title="Next Track"
            >
              <SkipForward className="w-4 h-4" />
            </button>
          </div>

          <div className="w-full flex items-center gap-3">
            <span className="text-[11px] font-mono text-[#a1a1aa] w-9 text-right">
              {formatTime(currentTime)}
            </span>
            <input
              type="range"
              min="0"
              max={duration > 0 ? duration : 100}
              value={currentTime}
              onChange={handleSeek}
              disabled={!track || isSafariMode}
              style={{
                background: `linear-gradient(to right, #6366f1 0%, #6366f1 ${progressPct}%, #26262e ${progressPct}%, #26262e 100%)`
              }}
              className="flex-1 argon-slider cursor-pointer disabled:opacity-40"
            />
            <span className="text-[11px] font-mono text-[#a1a1aa] w-9">
              {duration > 0 ? formatTime(duration) : (track?.duration_text && track.duration_text !== '--:--' ? track.duration_text : '0:00')}
            </span>
          </div>
        </div>

        {/* Right: Mode, Video, Volume */}
        <div className="flex items-center justify-end gap-3 w-1/4 min-w-[200px]">
          <div className="flex items-center bg-[#141418] border border-[#282830] rounded-md p-0.5 text-[11px] font-mono">
            <button
              onClick={() => setPlaybackMode('app')}
              className={`px-2 py-0.5 rounded transition-colors cursor-pointer ${
                playbackMode === 'app'
                  ? 'bg-indigo-500/20 text-indigo-200 border border-indigo-500/40 font-medium'
                  : 'text-[#9ca3af] hover:text-[#e4e4e7]'
              }`}
            >
              App
            </button>
            <button
              onClick={() => setPlaybackMode('safari')}
              className={`px-2 py-0.5 rounded transition-colors cursor-pointer ${
                playbackMode === 'safari'
                  ? 'bg-indigo-500/20 text-indigo-200 border border-indigo-500/40 font-medium'
                  : 'text-[#9ca3af] hover:text-[#e4e4e7]'
              }`}
            >
              Safari
            </button>
          </div>

          <button
            onClick={() => setShowVideo(!showVideo)}
            disabled={!track || playbackMode !== 'app'}
            title="Toggle Video Preview"
            className={`p-1.5 rounded border text-xs transition-colors cursor-pointer disabled:opacity-30 ${
              showVideo
                ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300'
                : 'bg-transparent border-transparent text-[#a1a1aa] hover:text-white'
            }`}
          >
            <Video className="w-4 h-4" />
          </button>

          {track && (
            <button
              onClick={() => onPushToSafari(track)}
              title="Open in Safari"
              className="p-1.5 rounded text-[#a1a1aa] hover:text-white transition-colors cursor-pointer"
            >
              <ExternalLink className="w-4 h-4" />
            </button>
          )}

          <div className="hidden sm:flex items-center gap-2">
            <button
              onClick={() => setIsMuted(!isMuted)}
              className="text-[#a1a1aa] hover:text-white transition-colors cursor-pointer"
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="w-4 h-4 text-[#73737a]" />
              ) : (
                <Volume2 className="w-4 h-4" />
              )}
            </button>
            <input
              type="range"
              min="0"
              max="100"
              value={volumeVal}
              onChange={(e) => {
                setVolume(Number(e.target.value))
                setIsMuted(false)
              }}
              style={{
                background: `linear-gradient(to right, #6366f1 0%, #6366f1 ${volumeVal}%, #26262e ${volumeVal}%, #26262e 100%)`
              }}
              className="w-16 argon-slider cursor-pointer"
            />
          </div>
        </div>
      </footer>
    </>
  )
}
