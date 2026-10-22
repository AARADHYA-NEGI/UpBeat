import React, { useState, useEffect, useRef } from 'react'
import {
  Play, Pause, SkipForward, SkipBack, Volume2, VolumeX,
  ExternalLink, Video, Music, Heart, Loader2
} from 'lucide-react'
import { getApiBase, hasBackend, getAudioSource, searchYouTubeStandalone } from '../standaloneApi'

function formatTime(sec) {
  if (!sec || isNaN(sec) || sec < 0) return '0:00'
  const s = Math.round(sec)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const remSec = s % 60
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${remSec.toString().padStart(2, '0')}`
  }
  return `${m}:${remSec.toString().padStart(2, '0')}`
}

function parseDurationText(str) {
  if (!str) return 0
  if (typeof str === 'number' && isFinite(str) && str > 0) return Math.round(str)
  if (typeof str !== 'string' || str === '--:--') return 0
  const clean = str.trim()
  if (/^\d+$/.test(clean)) return parseInt(clean, 10)
  const parts = clean.split(':').map(Number)
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

  const audioRefA = useRef(null)
  const audioRefB = useRef(null)
  const activeDeckRef = useRef('A')
  const fadeIntervalRef = useRef(null)

  const getActiveAudio = () => (activeDeckRef.current === 'A' ? audioRefA.current : audioRefB.current)
  const getInactiveAudio = () => (activeDeckRef.current === 'A' ? audioRefB.current : audioRefA.current)

  const playerRef = useRef(null)
  const currentVidRef = useRef('')
  const fallbackQueueRef = useRef([])
  const endedTriggeredRef = useRef(false)
  const isScrubbingRef = useRef(false)
  const lastNativeReportSecRef = useRef(0)

  // Global fix for HE-AAC / SBR 2x duration desync and player freeze bug
  const authoritativeDurationRef = useRef(0)
  const lastCurPosRef = useRef(0)
  const lastCurChangeTimeRef = useRef(Date.now())

  // Defends against the WebKit / Chromium HE-AAC SBR bug (2x duration) and
  // 32kbps partial VBR bitrate estimation bug (which falsely inflates 4:00 -> 15:32).
  const sanitizeDuration = (rawDur) => {
    if (useIframeFallback) return
    if (typeof rawDur !== 'number' || !isFinite(rawDur) || rawDur <= 0) return

    const authDur = authoritativeDurationRef.current

    if (authDur > 0) {
      // The authoritative duration is established from official YouTube track metadata
      // and /api/audio-info. WebKit/Chromium audio.duration is notoriously prone to
      // 32kbps bitrate inflation (e.g. 4:00 -> 15:32) and HE-AAC SBR 2x bug (4:00 -> 8:00).
      // Always clamp duration to the authoritative duration!
      setDuration(authDur)
    } else {
      authoritativeDurationRef.current = Math.round(rawDur)
      setDuration(Math.round(rawDur))
    }
  }

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

  const isSafariMode = playbackMode === 'safari'
  const effectiveDuration =
    duration > 0
      ? duration
      : (authoritativeDurationRef.current > 0
          ? authoritativeDurationRef.current
          : parseDurationText(track?.duration_text))
  const thumbUrl = track?.thumbnail || (resolvedVid ? `https://i.ytimg.com/vi/${resolvedVid}/hqdefault.jpg` : '')
  const displayTime = Math.min(
    isScrubbing ? scrubTime : currentTime,
    effectiveDuration > 0 ? effectiveDuration : Infinity
  )
  const progressPct = effectiveDuration > 0 ? Math.min(100, (displayTime / effectiveDuration) * 100) : 0
  const volumeVal = isMuted ? 0 : volume
  const isFav = track && isTrackFavorite ? isTrackFavorite(track) : false

  const commitSeek = (targetSec) => {
    const sec = Math.max(0, Number(targetSec) || 0)
    setCurrentTime(sec)
    lastCurPosRef.current = sec
    lastCurChangeTimeRef.current = Date.now()
    endedTriggeredRef.current = false
    lastNativeReportSecRef.current = sec
    if (window.UpBeatNative?.updatePlayback && track) {
      window.UpBeatNative.updatePlayback(
        Boolean(isPlayingRef.current),
        track.title || 'UpBeat',
        track.artist || '',
        thumbUrl || '',
        Math.round(effectiveDuration || 0),
        Math.round(sec)
      )
    }
    const activeAudio = getActiveAudio()
    if (!useIframeFallback && activeAudio) {
      try {
        if (activeAudio.readyState >= 1) {
          activeAudio.currentTime = sec
        }
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

  // Resolve video_id if track lacks one
  useEffect(() => {
    endedTriggeredRef.current = false
    setCurrentTime(0)
    setScrubTime(0)
    setIsScrubbing(false)
    lastCurPosRef.current = 0
    lastCurChangeTimeRef.current = Date.now()
    lastNativeReportSecRef.current = 0
    setUseIframeFallback(false)

    const initialDur =
      parseDurationText(track?.duration_text) ||
      Number(track?.duration_sec || 0) ||
      Number(track?.duration || 0)
    authoritativeDurationRef.current = initialDur
    setDuration(initialDur)

    if (!track) {
      setResolvedVid('')
      fallbackQueueRef.current = []
      if (window.UpBeatNative?.updatePlayback) {
        window.UpBeatNative.updatePlayback(false, 'UpBeat', '', '', 0, 0)
      }
      return
    }

    // Instantly isolate videoId so previous song's thumbnail NEVER leaks into track B
    if (track.video_id) {
      setResolvedVid(track.video_id)
      fallbackQueueRef.current = [...(track.fallback_ids || [])]
    } else {
      setResolvedVid('')
      fallbackQueueRef.current = []
    }

    const immediateThumb =
      track.thumbnail ||
      (track.video_id ? `https://i.ytimg.com/vi/${track.video_id}/hqdefault.jpg` : '')

    // ZERO-LATENCY INSTANT SYNC: Send the new song to Android top bar & lock screen immediately!
    if (window.UpBeatNative?.updatePlayback) {
      window.UpBeatNative.updatePlayback(
        Boolean(isPlayingRef.current),
        track.title || 'UpBeat',
        track.artist || '',
        immediateThumb,
        Math.round(initialDur || 0),
        0
      )
    }

    let cancelled = false
    ;(async () => {
      const isHourTitle = /1\s*h(?:ou)?r|2\s*h(?:ou)?r/i.test(track?.title || '')
      const isMismatchedShortDur = isHourTitle && initialDur > 0 && initialDur < 1200

      // If track already has a valid video_id and is not a 1-hour/short duration mismatch, NEVER re-search!
      if (track.video_id && !isMismatchedShortDur) {
        if (initialDur <= 0 && hasBackend()) {
          try {
            const r = await fetch(`${getApiBase()}/audio-info/${track.video_id}`)
            if (r.ok) {
              const info = await r.json()
              const durSec = Number(info?.duration || 0)
              if (!cancelled && durSec > 0) {
                authoritativeDurationRef.current = durSec
                setDuration(durSec)
                if (window.UpBeatNative?.updatePlayback) {
                  window.UpBeatNative.updatePlayback(
                    Boolean(isPlayingRef.current),
                    track.title || 'UpBeat',
                    track.artist || '',
                    immediateThumb,
                    durSec,
                    0
                  )
                }
                if (onTrackResolved) {
                  onTrackResolved(track, {
                    video_id: track.video_id,
                    duration: durSec,
                    duration_text: formatTime(durSec)
                  })
                }
              }
            }
          } catch {}
        }
        return
      }

      // Track lacks video_id OR has a mismatched short duration (e.g. 3:50 on a 1-hour mix):
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
        let resolvedDur = initialDur
        if (data.duration_text && data.duration_text !== '3:42' && data.duration_text !== '--:--') {
          const parsed = parseDurationText(data.duration_text)
          if (parsed > 0) {
            resolvedDur = parsed
            authoritativeDurationRef.current = parsed
            setDuration(parsed)
          }
        }
        fallbackQueueRef.current = [...(data.fallback_ids || [])]
        const resolvedThumb = data.thumbnail || `https://i.ytimg.com/vi/${data.video_id}/hqdefault.jpg`
        if (window.UpBeatNative?.updatePlayback) {
          window.UpBeatNative.updatePlayback(
            Boolean(isPlayingRef.current),
            track.title || 'UpBeat',
            track.artist || '',
            resolvedThumb,
            Math.round(resolvedDur || 0),
            0
          )
        }
        if (onTrackResolved) onTrackResolved(track, data)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [track?.title, track?.artist, track?.video_id])

  // Primary Engine: Native Dual-Deck HTML5 <audio> with smooth ~1s seamless crossfade
  useEffect(() => {
    if (!resolvedVid || playbackMode !== 'app' || useIframeFallback) return

    let cancelled = false
    const currentActive = getActiveAudio()
    const targetDeck = activeDeckRef.current === 'A' ? 'B' : 'A'
    const targetAudio = targetDeck === 'A' ? audioRefA.current : audioRefB.current

    if (!targetAudio) return

    if (playerRef.current && typeof playerRef.current.stopVideo === 'function') {
      try { playerRef.current.stopVideo() } catch {}
    }

    ;(async () => {
      // If the active audio is already playing this video, nothing to load
      if (currentActive?.dataset?.vid === resolvedVid && !currentActive.paused) {
        setIsLoadingStream(false)
        return
      }

      const isMacBackend = hasBackend()
      let streamSrc = isMacBackend ? `${getApiBase()}/audio/${resolvedVid}` : null

      // In standalone mode (or if backend is missing), resolve audio asynchronously
      if (!streamSrc) {
        setIsLoadingStream(true)
        try {
          const streamInfo = await getAudioSource(resolvedVid)
          if (cancelled) return
          streamSrc = typeof streamInfo === 'string' ? streamInfo : streamInfo?.url
        } catch {} finally {
          setIsLoadingStream(false)
        }
      }

      if (!streamSrc) {
        if (fallbackQueueRef.current.length > 0) {
          const nextVid = fallbackQueueRef.current.shift()
          setResolvedVid(nextVid)
          return
        }
        setUseIframeFallback(true)
        return
      }

      targetAudio.dataset.vid = resolvedVid
      targetAudio.src = streamSrc
      targetAudio.load()

      const targetVol = isMuted ? 0 : volume / 100
      const isPrevPlaying =
        currentActive &&
        !currentActive.paused &&
        currentActive.currentTime > 0.5 &&
        !currentActive.ended &&
        currentActive.dataset.vid &&
        currentActive.dataset.vid !== resolvedVid

      if (isPrevPlaying && isPlayingRef.current) {
        // Smooth ~1 sec seamless transition: target audio starts at 0 volume and fades in,
        // while the previous song keeps playing and smoothly fades out!
        targetAudio.volume = 0
        try {
          await targetAudio.play()
        } catch {
          if (fallbackQueueRef.current.length > 0) {
            const nextVid = fallbackQueueRef.current.shift()
            setResolvedVid(nextVid)
            return
          }
        }

        if (cancelled) {
          targetAudio.pause()
          return
        }

        activeDeckRef.current = targetDeck

        if (fadeIntervalRef.current) clearInterval(fadeIntervalRef.current)
        const oldAudio = currentActive
        const oldStartVol = oldAudio.volume
        const fadeStart = Date.now()
        const fadeDuration = 800 // ~1 sec crossfade

        fadeIntervalRef.current = setInterval(() => {
          const elapsed = Date.now() - fadeStart
          const progress = Math.min(1, elapsed / fadeDuration)

          if (targetAudio) targetAudio.volume = targetVol * progress
          if (oldAudio) oldAudio.volume = Math.max(0, oldStartVol * (1 - progress))

          if (progress >= 1) {
            clearInterval(fadeIntervalRef.current)
            fadeIntervalRef.current = null
            if (targetAudio) targetAudio.volume = targetVol
            if (oldAudio) {
              oldAudio.pause()
              oldAudio.src = ''
              oldAudio.dataset.vid = ''
            }
          }
        }, 40)
      } else {
        // Initial play or paused state: switch immediately
        if (fadeIntervalRef.current) {
          clearInterval(fadeIntervalRef.current)
          fadeIntervalRef.current = null
        }
        if (currentActive && currentActive !== targetAudio) {
          currentActive.pause()
          currentActive.src = ''
          currentActive.dataset.vid = ''
        }
        activeDeckRef.current = targetDeck
        targetAudio.volume = targetVol
        if (isPlayingRef.current) {
          targetAudio.play().catch(() => {
            if (fallbackQueueRef.current.length > 0) {
              const nextVid = fallbackQueueRef.current.shift()
              setResolvedVid(nextVid)
            }
          })
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [resolvedVid, playbackMode, useIframeFallback])

  // Sync play/pause with HTML5 <audio> or YT.Player fallback
  useEffect(() => {
    if (playbackMode !== 'app') {
      if (audioRefA.current) audioRefA.current.pause()
      if (audioRefB.current) audioRefB.current.pause()
      if (playerRef.current && typeof playerRef.current.pauseVideo === 'function') {
        try { playerRef.current.pauseVideo() } catch {}
      }
      return
    }

    const activeAudio = getActiveAudio()
    if (!useIframeFallback && activeAudio && resolvedVid) {
      if (isPlaying) {
        if (activeAudio.src) {
          activeAudio.play().catch(() => {})
        }
      } else {
        if (fadeIntervalRef.current) {
          clearInterval(fadeIntervalRef.current)
          fadeIntervalRef.current = null
        }
        if (audioRefA.current) audioRefA.current.pause()
        if (audioRefB.current) audioRefB.current.pause()
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
    const activeAudio = getActiveAudio()
    if (activeAudio && !fadeIntervalRef.current) {
      activeAudio.volume = isMuted ? 0 : volume / 100
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
                if (useIframeFallback && currentVidRef.current === resolvedVid && !endedTriggeredRef.current) {
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
              if (useIframeFallback && currentVidRef.current === resolvedVid) {
                onNextRef.current()
              }
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

      if (!useIframeFallback) {
        const audio = getActiveAudio()
        if (!audio || !resolvedVid || audio.dataset.vid !== resolvedVid) return
        const cur = audio.currentTime
        const rawDur = audio.duration
        const targetDur =
          duration > 0
            ? duration
            : (authoritativeDurationRef.current > 0
                ? authoritativeDurationRef.current
                : parseDurationText(track?.duration_text))

        if (typeof cur === 'number' && !isNaN(cur) && cur >= 0) {
          setCurrentTime(cur)

          // Track progress advancement for stall / frozen detection
          if (Math.abs(cur - lastCurPosRef.current) > 0.05) {
            lastCurPosRef.current = cur
            lastCurChangeTimeRef.current = Date.now()
          }

          if (Math.abs(cur - lastNativeReportSecRef.current) >= 3) {
            lastNativeReportSecRef.current = cur
            if (window.UpBeatNative?.updatePlayback && track) {
              window.UpBeatNative.updatePlayback(
                true,
                track.title || 'UpBeat',
                track.artist || '',
                thumbUrl || '',
                Math.round(targetDur || 0),
                Math.round(cur)
              )
            }
          }
        }

        // Sanitize audio duration to prevent 2x SBR bug from inflating UI
        if (typeof rawDur === 'number' && isFinite(rawDur) && rawDur > 0) {
          sanitizeDuration(rawDur)
        }

        // Multi-tier End-of-Track and Freeze Protection:
        // Must be currently playing the resolvedVid, cur must have progressed (> 0.5s),
        // and targetDur must be established (> 5s).
        const timeSinceAdvance = Date.now() - (lastCurChangeTimeRef.current || Date.now())
        const isEnded = Boolean(audio.ended)
        const reachedTargetEnd = targetDur > 5 && cur >= targetDur - 0.4
        const stalledNearEnd = targetDur > 5 && cur >= targetDur - 2.0 && cur > 5 && timeSinceAdvance >= 1500
        const isSbr2xFreeze =
          typeof rawDur === 'number' &&
          rawDur > 20 &&
          cur > 5 &&
          Math.abs(cur - rawDur / 2) <= 3.0 &&
          timeSinceAdvance >= 1800

        if ((isEnded || reachedTargetEnd || stalledNearEnd || isSbr2xFreeze) && !endedTriggeredRef.current && cur > 0.5) {
          endedTriggeredRef.current = true
          onNextRef.current()
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
              sanitizeDuration(dur)
              const effectiveDur = duration > 0 ? duration : (authoritativeDurationRef.current || parseDurationText(track?.duration_text))
              if (cur >= effectiveDur - 0.3 && effectiveDur > 5 && !endedTriggeredRef.current) {
                endedTriggeredRef.current = true
                onNextRef.current()
              }
            }
          }
        } catch {}
      }
    }, 250)

    return () => clearInterval(interval)
  }, [isPlaying, playbackMode, useIframeFallback, duration, track])

  // Sync Android Foreground Media Service + Android Auto + Lock Screen MediaSession
  useEffect(() => {
    try {
      if (window.UpBeatNative && typeof window.UpBeatNative.updatePlayback === 'function' && track) {
        window.UpBeatNative.updatePlayback(
          Boolean(isPlaying),
          track.title || 'UpBeat',
          track.artist || '',
          thumbUrl || '',
          Math.round(effectiveDuration || 0),
          Math.round(currentTime || 0)
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
  }, [isPlaying, track?.title, track?.artist, track?.thumbnail, resolvedVid, thumbUrl, effectiveDuration])

  // Listen for in-car seek commands from Android Auto
  useEffect(() => {
    const onCarSeek = (e) => {
      if (typeof e?.detail === 'number') {
        commitSeek(e.detail)
      }
    }
    window.addEventListener('upbeat-car-seek', onCarSeek)
    return () => window.removeEventListener('upbeat-car-seek', onCarSeek)
  }, [duration, useIframeFallback])

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

  return (
    <>
      {['A', 'B'].map((deck) => (
        <audio
          key={deck}
          ref={deck === 'A' ? audioRefA : audioRefB}
          preload="auto"
          onTimeUpdate={(e) => {
            if (activeDeckRef.current === deck && !useIframeFallback && !isScrubbingRef.current) {
              setCurrentTime(e.currentTarget.currentTime || 0)
            }
          }}
          onLoadedMetadata={(e) => {
            setIsLoadingStream(false)
            if (activeDeckRef.current === deck) {
              sanitizeDuration(e.currentTarget.duration)
            }
            if (isPlayingRef.current && e.currentTarget.paused && !fadeIntervalRef.current) {
              e.currentTarget.play().catch(() => {})
            }
          }}
          onCanPlay={() => {
            setIsLoadingStream(false)
          }}
          onDurationChange={(e) => {
            if (activeDeckRef.current === deck) {
              sanitizeDuration(e.currentTarget.duration)
            }
          }}
          onPlay={(e) => {
            setIsLoadingStream(false)
            if (activeDeckRef.current === deck || e.currentTarget.dataset.vid === resolvedVid) {
              endedTriggeredRef.current = false
              setIsPlaying(true)
              lastCurChangeTimeRef.current = Date.now()
              if (window.UpBeatNative?.updatePlayback && track) {
                window.UpBeatNative.updatePlayback(
                  true,
                  track.title || 'UpBeat',
                  track.artist || '',
                  thumbUrl || '',
                  Math.round(effectiveDuration || 0),
                  Math.round(e.currentTarget.currentTime || 0)
                )
              }
            }
          }}
          onPause={(e) => {
            if (activeDeckRef.current === deck && !fadeIntervalRef.current && e.currentTarget.dataset.vid === resolvedVid) {
              const audio = e.currentTarget
              if (audio && !audio.ended) {
                setIsPlaying(false)
                if (window.UpBeatNative?.updatePlayback && track) {
                  window.UpBeatNative.updatePlayback(
                    false,
                    track.title || 'UpBeat',
                    track.artist || '',
                    thumbUrl || '',
                    Math.round(effectiveDuration || 0),
                    Math.round(audio.currentTime || 0)
                  )
                }
              }
            }
          }}
          onWaiting={(e) => {
            if (activeDeckRef.current === deck && e.currentTarget.dataset.vid === resolvedVid) {
              const cur = e.currentTarget.currentTime || 0
              const targetDur = duration > 0 ? duration : (authoritativeDurationRef.current || parseDurationText(track?.duration_text))
              if (targetDur > 5 && cur > 5 && cur >= targetDur - 2.0 && !endedTriggeredRef.current) {
                endedTriggeredRef.current = true
                onNextRef.current()
              }
            }
          }}
          onStalled={(e) => {
            if (activeDeckRef.current === deck && e.currentTarget.dataset.vid === resolvedVid) {
              const cur = e.currentTarget.currentTime || 0
              const targetDur = duration > 0 ? duration : (authoritativeDurationRef.current || parseDurationText(track?.duration_text))
              if (targetDur > 5 && cur > 5 && cur >= targetDur - 2.0 && !endedTriggeredRef.current) {
                endedTriggeredRef.current = true
                onNextRef.current()
              }
            }
          }}
          onEnded={(e) => {
            if (activeDeckRef.current === deck && e.currentTarget.dataset.vid === resolvedVid && !endedTriggeredRef.current) {
              endedTriggeredRef.current = true
              onNextRef.current()
            }
          }}
          onError={(e) => {
            if (e.currentTarget.dataset.vid !== resolvedVid) return
            setIsLoadingStream(false)
            if (fallbackQueueRef.current.length > 0) {
              const nextAlt = fallbackQueueRef.current.shift()
              setResolvedVid(nextAlt)
            } else if (!useIframeFallback) {
              setUseIframeFallback(true)
            }
          }}
        />
      ))}

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

      <footer className="bg-[#0d0d10] border-t border-[#202026] px-3 sm:px-5 py-2 sm:py-0 sm:h-[68px] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 sm:gap-4 select-none flex-shrink-0 z-30 relative">
        {/* Top progress bar */}
        {track && effectiveDuration > 0 && (
          <div
            className="absolute top-0 left-0 h-[2px] bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-150 pointer-events-none"
            style={{ width: `${progressPct}%` }}
          />
        )}

        {/* Mobile Row 1 / Desktop Left+Center+Right */}
        <div className="flex items-center justify-between gap-2.5 w-full sm:w-auto sm:flex-1">
          {/* Track Artwork + Title + Artist */}
          <div className="flex items-center gap-2.5 min-w-0 flex-1 sm:w-1/4 sm:min-w-[200px] sm:flex-initial">
            {track ? (
              <>
                <div className={`w-10 h-10 sm:w-11 sm:h-11 rounded-md bg-[#14141a] border overflow-hidden flex-shrink-0 relative ${
                  isPlaying ? 'border-emerald-500/60 shadow-xs shadow-emerald-500/20' : 'border-[#22222a]'
                }`}>
                  {thumbUrl ? (
                    <img src={thumbUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[#71717a]">
                      <Music className="w-4 h-4" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                      isPlaying ? 'bg-emerald-400 animate-pulse' : 'bg-[#52525b]'
                    }`} />
                    <div className="text-xs sm:text-[13px] font-semibold text-[#f4f4f5] truncate">
                      {track.title}
                    </div>
                  </div>
                  <div className="text-[11px] sm:text-xs text-[#8e8e96] truncate mt-0.5 pl-3">
                    {track.artist}
                  </div>
                </div>
                {onToggleFavorite && (
                  <button
                    onClick={() => onToggleFavorite(track)}
                    title={isFav ? 'Remove from Favorites' : 'Save to Favorites'}
                    aria-label="Toggle Favorite"
                    className={`p-1.5 rounded-md hover:bg-[#1a1a22] transition-colors cursor-pointer flex-shrink-0 ${
                      isFav ? 'text-rose-400' : 'text-[#71717a] hover:text-rose-300'
                    }`}
                  >
                    <Heart className={`w-4 h-4 ${isFav ? 'fill-rose-500 text-rose-500' : ''}`} />
                  </button>
                )}
              </>
            ) : (
              <div className="text-xs text-[#71717a] font-mono py-2">
                Tap any track to play
              </div>
            )}
          </div>

          {/* Mobile Compact Transport Controls */}
          <div className="flex sm:hidden items-center gap-1.5 flex-shrink-0">
            <button
              onClick={isSafariMode ? () => onSafariControl('prev') : onPrev}
              disabled={!track}
              className="p-2 text-[#8e8e96] active:text-white disabled:opacity-30"
              aria-label="Previous"
            >
              <SkipBack className="w-4 h-4" />
            </button>
            <button
              onClick={isSafariMode ? () => onSafariControl('play_pause') : onTogglePlay}
              disabled={!track}
              className="w-9 h-9 rounded-full bg-emerald-500 active:bg-emerald-400 text-white flex items-center justify-center disabled:opacity-30 shadow-md shadow-emerald-500/25"
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
              className="p-2 text-[#8e8e96] active:text-white disabled:opacity-30"
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
                className="text-[#8e8e96] hover:text-white disabled:opacity-30 transition-colors cursor-pointer"
                title="Previous Track"
              >
                <SkipBack className="w-4 h-4" />
              </button>

              <button
                onClick={isSafariMode ? () => onSafariControl('play_pause') : onTogglePlay}
                disabled={!track}
                className="w-8 h-8 rounded-full bg-emerald-500 hover:bg-emerald-400 text-white flex items-center justify-center disabled:opacity-30 transition-all shadow-md shadow-emerald-500/25 active:scale-95 cursor-pointer"
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
                className="text-[#8e8e96] hover:text-white disabled:opacity-30 transition-colors cursor-pointer"
                title="Next Track"
              >
                <SkipForward className="w-4 h-4" />
              </button>
            </div>

            <div className="w-full flex items-center gap-3">
              <span className="text-[11px] font-mono text-[#8e8e96] w-9 text-right">
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
                  background: `linear-gradient(to right, #10b981 0%, #34d399 ${progressPct}%, #202028 ${progressPct}%, #202028 100%)`
                }}
                className="flex-1 argon-slider cursor-pointer disabled:opacity-40"
              />
              <span className="text-[11px] font-mono text-[#8e8e96] w-9">
                {effectiveDuration > 0 ? formatTime(effectiveDuration) : (track?.duration_text && track.duration_text !== '--:--' ? track.duration_text : '0:00')}
              </span>
            </div>
          </div>

          {/* Desktop Right Controls */}
          <div className="hidden sm:flex items-center justify-end gap-3 w-1/4 min-w-[180px]">
            {hasBackend() && (
              <div className="hidden md:flex items-center bg-[#121217] border border-[#22222a] rounded-lg p-0.5 text-[11px] font-mono">
                <button
                  onClick={() => setPlaybackMode('app')}
                  className={`px-2 py-0.5 rounded-md transition-colors cursor-pointer ${
                    playbackMode === 'app'
                      ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-500/40 font-medium'
                      : 'text-[#8e8e96] hover:text-[#e4e4e7]'
                  }`}
                >
                  App
                </button>
                <button
                  onClick={() => setPlaybackMode('safari')}
                  className={`px-2 py-0.5 rounded-md transition-colors cursor-pointer ${
                    playbackMode === 'safari'
                      ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-500/40 font-medium'
                      : 'text-[#8e8e96] hover:text-[#e4e4e7]'
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
              className={`p-1.5 rounded-md border text-xs transition-colors cursor-pointer disabled:opacity-30 ${
                showVideo
                  ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                  : 'bg-transparent border-transparent text-[#8e8e96] hover:text-white'
              }`}
            >
              <Video className="w-4 h-4" />
            </button>

            {track && (
              <button
                onClick={() => onPushToSafari(track)}
                title="Open on YouTube"
                className="p-1.5 rounded-md text-[#8e8e96] hover:text-white hover:bg-[#1a1a22] transition-colors cursor-pointer"
              >
                <ExternalLink className="w-4 h-4" />
              </button>
            )}

            <div className="hidden lg:flex items-center gap-2">
              <button
                onClick={() => setIsMuted(!isMuted)}
                className="text-[#8e8e96] hover:text-white transition-colors cursor-pointer"
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="w-4 h-4 text-[#52525b]" />
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
                  background: `linear-gradient(to right, #10b981 0%, #34d399 ${volumeVal}%, #202028 ${volumeVal}%, #202028 100%)`
                }}
                className="w-16 argon-slider cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Mobile Scrubber Row */}
        {track && (
          <div className="flex sm:hidden items-center gap-2 w-full px-0.5">
            <span className="text-[10px] font-mono text-[#71717a] w-7">
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
                background: `linear-gradient(to right, #10b981 0%, #34d399 ${progressPct}%, #202028 ${progressPct}%, #202028 100%)`
              }}
              className="flex-1 argon-slider"
            />
            <span className="text-[10px] font-mono text-[#71717a] w-7 text-right">
              {effectiveDuration > 0 ? formatTime(effectiveDuration) : (track?.duration_text && track.duration_text !== '--:--' ? track.duration_text : '0:00')}
            </span>
          </div>
        )}
      </footer>
    </>
  )
}
