import React, { useState, useEffect, useRef } from 'react'
import {
  Play, Pause, SkipForward, SkipBack, Volume2, VolumeX,
  ExternalLink, Video, Music, Heart, Loader2
} from 'lucide-react'
import { getApiBase, hasBackend, getAudioSource, searchYouTubeStandalone } from '../standaloneApi'

function formatTime(sec) {
  if (!sec || isNaN(sec) || sec < 0) return '0:00'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function parseDurationText(str) {
  if (!str || typeof str !== 'string' || str === '--:--') return 0
  const parts = str.trim().split(':').map(Number)
  if (parts.some((n) => isNaN(n))) return 0
  if (parts.length === 2) return parts[0] * 60 + parts[1]
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
  return 0
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
  const [isScrubbing, setIsScrubbing] = useState(false)
  const [scrubTime, setScrubTime] = useState(0)
  const [resolvedVid, setResolvedVid] = useState('')
  const [isLoadingStream, setIsLoadingStream] = useState(false)
  const [useIframeFallback, setUseIframeFallback] = useState(false)

  const audioRef = useRef(null)
  const playerRef = useRef(null)
  const currentVidRef = useRef('')
  const fallbackQueueRef = useRef([])
  const endedTriggeredRef = useRef(false)
  const isScrubbingRef = useRef(false)

  const onNextRef = useRef(onNext)
  const isPlayingRef = useRef(isPlaying)
  useEffect(() => {
    onNextRef.current = onNext
  }, [onNext])
  useEffect(() => {
    isPlayingRef.current = isPlaying
  }, [isPlaying])
  useEffect(() => {
    isScrubbingRef.current = isScrubbing
  }, [isScrubbing])

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
    setCurrentTime(0)
    setScrubTime(0)
    setIsScrubbing(false)
    setDuration(parseDurationText(track?.duration_text))
    setUseIframeFallback(false)

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

    let cancelled = false
    ;(async () => {
      const q = `${track.title} ${track.artist}`
      let data = null
      if (hasBackend()) {
        try {
          const r = await fetch(`${getApiBase()}/search?q=${encodeURIComponent(q)}`)
          if (r.ok) data = await r.json()
        } catch {}
      }
      if (!data) {
        data = await searchYouTubeStandalone(q)
      }
      if (!cancelled && data?.video_id) {
        setResolvedVid(data.video_id)
        if (data.duration_text) {
          const parsed = parseDurationText(data.duration_text)
          if (parsed > 0) setDuration((prev) => (prev > 0 ? prev : parsed))
        }
        fallbackQueueRef.current = [...(data.fallback_ids || [])]
        if (onTrackResolved) onTrackResolved(track, data)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [track?.title, track?.artist, track?.video_id])

  // Primary Engine: Native HTML5 <audio> using either Mac backend (/api/audio) or direct standalone Innertube stream
  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !resolvedVid || playbackMode !== 'app' || useIframeFallback) return

    let cancelled = false

    if (playerRef.current && typeof playerRef.current.stopVideo === 'function') {
      try { playerRef.current.stopVideo() } catch {}
    }

    ;(async () => {
      if (audio.dataset.vid !== resolvedVid) {
        setIsLoadingStream(true)
        const streamInfo = await getAudioSource(resolvedVid)
        if (cancelled) return
        setIsLoadingStream(false)

        const streamSrc = typeof streamInfo === 'string' ? streamInfo : streamInfo?.url
        const streamDur = typeof streamInfo === 'object' ? Number(streamInfo?.duration || 0) : 0
        if (streamDur > 0) {
          setDuration((prev) => (prev > 0 ? prev : streamDur))
        }

        if (!streamSrc) {
          setUseIframeFallback(true)
          return
        }
        audio.dataset.vid = resolvedVid
        audio.src = streamSrc
        audio.load()
      }
      audio.volume = isMuted ? 0 : volume / 100

      if (isPlayingRef.current) {
        audio.play().catch(() => {})
      }
    })()

    return () => {
      cancelled = true
    }
  }, [resolvedVid, playbackMode, useIframeFallback])

  // Sync play/pause with HTML5 <audio> or YT.Player fallback
  useEffect(() => {
    if (playbackMode !== 'app') {
      if (audioRef.current) audioRef.current.pause()
      if (playerRef.current && typeof playerRef.current.pauseVideo === 'function') {
        try { playerRef.current.pauseVideo() } catch {}
      }
      return
    }

    if (!useIframeFallback && audioRef.current && resolvedVid) {
      if (isPlaying) {
        if (audioRef.current.src) {
          audioRef.current.play().catch(() => {})
        }
      } else {
        audioRef.current.pause()
      }
      return
    }

    const p = playerRef.current
    if (useIframeFallback && p && typeof p.getPlayerState === 'function') {
      try {
        const state = p.getPlayerState()
        if (isPlaying && state !== 1 && state !== 3) {
          p.playVideo()
        } else if (!isPlaying && state === 1) {
          p.pauseVideo()
        }
      } catch {}
    }
  }, [isPlaying, playbackMode, useIframeFallback, resolvedVid])

  // Sync volume
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume / 100
    }
    const p = playerRef.current
    if (p && typeof p.setVolume === 'function') {
      try {
        p.setVolume(isMuted ? 0 : volume)
      } catch {}
    }
  }, [volume, isMuted])

  // Load YouTube IFrame API only if needed for fallback or video preview
  useEffect(() => {
    if (!useIframeFallback && !showVideo) return
    if (window.YT && window.YT.Player) return
    const existing = document.getElementById('yt-iframe-api-script')
    if (!existing) {
      const tag = document.createElement('script')
      tag.id = 'yt-iframe-api-script'
      tag.src = 'https://www.youtube.com/iframe_api'
      document.body.appendChild(tag)
    }
  }, [useIframeFallback, showVideo])

  // Secondary YT.Player fallback
  useEffect(() => {
    if (!resolvedVid || playbackMode !== 'app' || !useIframeFallback) return

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
            onError: () => {
              onNextRef.current()
            }
          }
        })
      } else if (typeof playerRef.current.loadVideoById === 'function') {
        if (currentVidRef.current !== resolvedVid) {
          currentVidRef.current = resolvedVid
          endedTriggeredRef.current = false
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
  }, [resolvedVid, playbackMode, useIframeFallback])

  // Continuous 250ms playback progress ticker for both <audio> and YT.Player fallback
  useEffect(() => {
    if (!isPlaying || playbackMode !== 'app') return

    const interval = setInterval(() => {
      if (isScrubbingRef.current) return

      if (!useIframeFallback && audioRef.current) {
        const cur = audioRef.current.currentTime
        const dur = audioRef.current.duration
        if (typeof cur === 'number' && !isNaN(cur) && cur >= 0) {
          setCurrentTime(cur)
        }
        if (typeof dur === 'number' && isFinite(dur) && dur > 0) {
          setDuration(dur)
          if ((audioRef.current.ended || cur >= dur - 0.25) && dur > 5 && !endedTriggeredRef.current) {
            endedTriggeredRef.current = true
            onNextRef.current()
          }
        }
        return
      }

      const p = playerRef.current
      if (useIframeFallback && p && typeof p.getCurrentTime === 'function') {
        try {
          const cur = p.getCurrentTime()
          if (typeof cur === 'number' && !isNaN(cur) && cur >= 0) {
            setCurrentTime(cur)
          }
          if (typeof p.getDuration === 'function') {
            const dur = p.getDuration()
            if (typeof dur === 'number' && isFinite(dur) && dur > 0) {
              setDuration(dur)
              if (cur >= dur - 0.3 && dur > 5 && !endedTriggeredRef.current) {
                endedTriggeredRef.current = true
                onNextRef.current()
              }
            }
          }
        } catch {}
      }
    }, 250)

    return () => clearInterval(interval)
  }, [isPlaying, playbackMode, useIframeFallback])

  // Sync Android Foreground Media Service + Lock Screen MediaSession
  useEffect(() => {
    try {
      if (window.UpBeatNative && typeof window.UpBeatNative.updatePlayback === 'function') {
        window.UpBeatNative.updatePlayback(
          Boolean(isPlaying && track),
          track?.title || 'UpBeat',
          track?.artist || ''
        )
      }
    } catch {}

    if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
      try {
        if (track && typeof window.MediaMetadata !== 'undefined') {
          const artUrl = track.thumbnail || (resolvedVid ? `https://i.ytimg.com/vi/${resolvedVid}/hqdefault.jpg` : '')
          navigator.mediaSession.metadata = new window.MediaMetadata({
            title: track.title || 'UpBeat',
            artist: track.artist || 'UpBeat Curator',
            album: 'UpBeat',
            artwork: artUrl ? [{ src: artUrl, sizes: '480x360', type: 'image/jpeg' }] : []
          })
        }
        navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused'
        navigator.mediaSession.setActionHandler('play', () => setIsPlaying(true))
        navigator.mediaSession.setActionHandler('pause', () => setIsPlaying(false))
        navigator.mediaSession.setActionHandler('previoustrack', () => onPrev())
        navigator.mediaSession.setActionHandler('nexttrack', () => onNextRef.current())
        navigator.mediaSession.setActionHandler('seekto', (details) => {
          if (details && typeof details.seekTime === 'number') {
            commitSeek(details.seekTime)
          }
        })
      } catch {}
    }
  }, [isPlaying, track?.title, track?.artist, resolvedVid])

  const commitSeek = (targetSec) => {
    const sec = Math.max(0, Number(targetSec) || 0)
    setCurrentTime(sec)
    if (!useIframeFallback && audioRef.current) {
      try {
        audioRef.current.currentTime = sec
      } catch {}
      return
    }
    const p = playerRef.current
    if (p && typeof p.seekTo === 'function') {
      try {
        p.seekTo(sec, true)
      } catch {}
    }
  }

  const handleScrubStart = () => {
    setIsScrubbing(true)
    setScrubTime(currentTime)
  }

  const handleScrubChange = (e) => {
    const val = Number(e.target.value)
    if (isScrubbingRef.current) {
      setScrubTime(val)
    } else {
      commitSeek(val)
    }
  }

  const handleScrubEnd = (e) => {
    if (!isScrubbingRef.current) return
    const val = Number(e?.target?.value ?? scrubTime)
    setIsScrubbing(false)
    commitSeek(val)
  }

  const isSafariMode = playbackMode === 'safari'
  const effectiveDuration = duration > 0 ? duration : parseDurationText(track?.duration_text)
  const displayTime = isScrubbing ? scrubTime : currentTime
  const progressPct = effectiveDuration > 0 ? Math.min(100, (displayTime / effectiveDuration) * 100) : 0
  const thumbUrl = track?.thumbnail || (resolvedVid ? `https://i.ytimg.com/vi/${resolvedVid}/hqdefault.jpg` : '')
  const volumeVal = isMuted ? 0 : volume
  const isFav = track && isTrackFavorite ? isTrackFavorite(track) : false

  return (
    <>
      <audio
        ref={audioRef}
        preload="auto"
        onTimeUpdate={(e) => {
          if (!useIframeFallback && !isScrubbingRef.current) {
            setCurrentTime(e.currentTarget.currentTime || 0)
          }
        }}
        onLoadedMetadata={(e) => {
          setIsLoadingStream(false)
          if (!useIframeFallback && e.currentTarget.duration && isFinite(e.currentTarget.duration)) {
            setDuration(e.currentTarget.duration)
          }
        }}
        onDurationChange={(e) => {
          if (!useIframeFallback && e.currentTarget.duration && isFinite(e.currentTarget.duration) && e.currentTarget.duration > 0) {
            setDuration(e.currentTarget.duration)
          }
        }}
        onPlay={() => {
          setIsLoadingStream(false)
          endedTriggeredRef.current = false
          setIsPlaying(true)
        }}
        onPause={() => {
          if (audioRef.current && !audioRef.current.ended) {
            setIsPlaying(false)
          }
        }}
        onEnded={() => {
          if (!endedTriggeredRef.current) {
            endedTriggeredRef.current = true
            onNextRef.current()
          }
        }}
        onError={() => {
          setIsLoadingStream(false)
          if (resolvedVid && !useIframeFallback) {
            // Try next fallback_id with direct stream first before iframe
            if (fallbackQueueRef.current.length > 0) {
              const nextAlt = fallbackQueueRef.current.shift()
              setResolvedVid(nextAlt)
            } else {
              setUseIframeFallback(true)
            }
          }
        }}
      />

      {/* Optional Video Container */}
      <div
        className={
          showVideo && track && playbackMode === 'app'
            ? 'fixed bottom-28 sm:bottom-20 right-3 sm:right-6 z-40 w-72 sm:w-80 aspect-video rounded-lg overflow-hidden border border-indigo-500/40 bg-black shadow-2xl'
            : 'fixed bottom-0 right-0 w-[1px] h-[1px] opacity-0 pointer-events-none overflow-hidden'
        }
      >
        <div id="argon-yt-player-mount" className="w-full h-full" />
      </div>

      <footer className="bg-[#0d0d10] border-t border-[#222228] px-3 sm:px-5 py-2 sm:py-0 sm:h-[68px] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 sm:gap-4 select-none flex-shrink-0 z-30 relative">
        {/* Top progress bar */}
        {track && effectiveDuration > 0 && (
          <div
            className="absolute top-0 left-0 h-[2px] bg-indigo-500 transition-all duration-150 pointer-events-none"
            style={{ width: `${progressPct}%` }}
          />
        )}

        {/* Mobile Row 1 / Desktop Left+Center+Right */}
        <div className="flex items-center justify-between gap-2.5 w-full sm:w-auto sm:flex-1">
          {/* Track Artwork + Title + Artist */}
          <div className="flex items-center gap-2.5 min-w-0 flex-1 sm:w-1/4 sm:min-w-[200px] sm:flex-initial">
            {track ? (
              <>
                <div className={`w-10 h-10 sm:w-11 sm:h-11 rounded-md bg-[#18181e] border overflow-hidden flex-shrink-0 relative ${
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
                  <div className="flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                      isPlaying ? 'bg-indigo-400 animate-pulse' : 'bg-[#666]'
                    }`} />
                    <div className="text-xs sm:text-[13px] font-semibold text-[#f5f5f5] truncate">
                      {track.title}
                    </div>
                  </div>
                  <div className="text-[11px] sm:text-xs text-[#a1a1aa] truncate mt-0.5 pl-3">
                    {track.artist}
                  </div>
                </div>
                {onToggleFavorite && (
                  <button
                    onClick={() => onToggleFavorite(track)}
                    title={isFav ? 'Remove from Favorites' : 'Save to Favorites'}
                    aria-label="Toggle Favorite"
                    className={`p-1.5 rounded hover:bg-[#1e1e26] transition-colors cursor-pointer flex-shrink-0 ${
                      isFav ? 'text-rose-400' : 'text-[#8e8e93] hover:text-rose-300'
                    }`}
                  >
                    <Heart className={`w-4 h-4 ${isFav ? 'fill-rose-500 text-rose-500' : ''}`} />
                  </button>
                )}
              </>
            ) : (
              <div className="text-xs text-[#8e8e93] font-mono py-2">
                Tap any track to play
              </div>
            )}
          </div>

          {/* Mobile Compact Transport Controls (shown inline on mobile, centered on desktop) */}
          <div className="flex sm:hidden items-center gap-1.5 flex-shrink-0">
            <button
              onClick={isSafariMode ? () => onSafariControl('prev') : onPrev}
              disabled={!track}
              className="p-2 text-[#a1a1aa] active:text-white disabled:opacity-30"
              aria-label="Previous"
            >
              <SkipBack className="w-4 h-4" />
            </button>
            <button
              onClick={isSafariMode ? () => onSafariControl('play_pause') : onTogglePlay}
              disabled={!track}
              className="w-9 h-9 rounded-full bg-indigo-500 active:bg-indigo-400 text-white flex items-center justify-center disabled:opacity-30 shadow-sm shadow-indigo-500/30"
              aria-label={isPlaying ? 'Pause' : 'Play'}
            >
              {isLoadingStream ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : isPlaying ? (
                <Pause className="w-4 h-4 fill-current" />
              ) : (
                <Play className="w-4 h-4 fill-current ml-0.5" />
              )}
            </button>
            <button
              onClick={isSafariMode ? () => onSafariControl('next') : onNext}
              disabled={!track}
              className="p-2 text-[#a1a1aa] active:text-white disabled:opacity-30"
              aria-label="Next"
            >
              <SkipForward className="w-4 h-4" />
            </button>
          </div>

          {/* Desktop Center Transport & Scrubber */}
          <div className="hidden sm:flex flex-col items-center gap-1.5 flex-1 max-w-xl px-4">
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
                {isLoadingStream ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : isPlaying ? (
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
                {formatTime(displayTime)}
              </span>
              <input
                type="range"
                min="0"
                max={effectiveDuration > 0 ? effectiveDuration : 100}
                step="0.25"
                value={Math.min(displayTime, effectiveDuration > 0 ? effectiveDuration : 100)}
                onPointerDown={handleScrubStart}
                onTouchStart={handleScrubStart}
                onChange={handleScrubChange}
                onPointerUp={handleScrubEnd}
                onTouchEnd={handleScrubEnd}
                onMouseUp={handleScrubEnd}
                disabled={!track || isSafariMode}
                style={{
                  background: `linear-gradient(to right, #6366f1 0%, #6366f1 ${progressPct}%, #26262e ${progressPct}%, #26262e 100%)`
                }}
                className="flex-1 argon-slider cursor-pointer disabled:opacity-40"
              />
              <span className="text-[11px] font-mono text-[#a1a1aa] w-9">
                {effectiveDuration > 0 ? formatTime(effectiveDuration) : (track?.duration_text && track.duration_text !== '--:--' ? track.duration_text : '0:00')}
              </span>
            </div>
          </div>

          {/* Desktop Right Controls */}
          <div className="hidden sm:flex items-center justify-end gap-3 w-1/4 min-w-[180px]">
            {hasBackend() && (
              <div className="hidden md:flex items-center bg-[#141418] border border-[#282830] rounded-md p-0.5 text-[11px] font-mono">
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
            )}

            <button
              onClick={() => {
                const nextShow = !showVideo
                setShowVideo(nextShow)
                if (nextShow) setUseIframeFallback(true)
              }}
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
                title="Open on YouTube"
                className="p-1.5 rounded text-[#a1a1aa] hover:text-white transition-colors cursor-pointer"
              >
                <ExternalLink className="w-4 h-4" />
              </button>
            )}

            <div className="hidden lg:flex items-center gap-2">
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
        </div>

        {/* Mobile Scrubber Row */}
        {track && (
          <div className="flex sm:hidden items-center gap-2 w-full px-0.5">
            <span className="text-[10px] font-mono text-[#8e8e93] w-7">
              {formatTime(displayTime)}
            </span>
            <input
              type="range"
              min="0"
              max={effectiveDuration > 0 ? effectiveDuration : 100}
              step="0.25"
              value={Math.min(displayTime, effectiveDuration > 0 ? effectiveDuration : 100)}
              onPointerDown={handleScrubStart}
              onTouchStart={handleScrubStart}
              onChange={handleScrubChange}
              onPointerUp={handleScrubEnd}
              onTouchEnd={handleScrubEnd}
              onMouseUp={handleScrubEnd}
              disabled={!track || isSafariMode}
              style={{
                background: `linear-gradient(to right, #6366f1 0%, #6366f1 ${progressPct}%, #26262e ${progressPct}%, #26262e 100%)`
              }}
              className="flex-1 argon-slider"
            />
            <span className="text-[10px] font-mono text-[#8e8e93] w-7 text-right">
              {effectiveDuration > 0 ? formatTime(effectiveDuration) : (track?.duration_text && track.duration_text !== '--:--' ? track.duration_text : '0:00')}
            </span>
          </div>
        )}
      </footer>
    </>
  )
}
