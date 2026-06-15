import { useEffect, useRef, useState, useCallback } from 'react'
import { useAppStore } from '../store/appStore'
import { mapKeyEvent, TVKey } from '../platform/keys'
import { Spinner } from '../components/ui/Spinner'
import shaka from 'shaka-player'

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

type FocusTarget = 'back' | 'rewind' | 'playpause' | 'forward' | 'seekbar'

const FOCUS_LEFT: Record<FocusTarget, FocusTarget> = {
  back: 'back',
  rewind: 'back',
  playpause: 'rewind',
  forward: 'playpause',
  seekbar: 'forward',
}
const FOCUS_RIGHT: Record<FocusTarget, FocusTarget> = {
  back: 'rewind',
  rewind: 'playpause',
  playpause: 'forward',
  forward: 'forward',
  seekbar: 'seekbar',
}

function isFocused(active: FocusTarget, target: FocusTarget) {
  return active === target
}

const BackIcon = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
    <polyline points="15,5 8,12 15,19" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const SkipBackIcon = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
    <line x1="5" y1="5" x2="5" y2="19" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    <polygon points="21,5 9,12 21,19" fill="currentColor" />
  </svg>
)

const SkipForwardIcon = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
    <line x1="19" y1="5" x2="19" y2="19" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    <polygon points="3,5 15,12 3,19" fill="currentColor" />
  </svg>
)

const PlayIcon = () => (
  <svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor">
    <polygon points="5,4 21,12 5,20" />
  </svg>
)

const PauseIcon = () => (
  <svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor">
    <rect x="5" y="4" width="4.5" height="16" rx="1.2" />
    <rect x="14.5" y="4" width="4.5" height="16" rx="1.2" />
  </svg>
)

function iconBtnStyle(focused: boolean): React.CSSProperties {
  return {
    width: 44,
    height: 44,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'none',
    border: 'none',
    outline: 'none',
    cursor: 'pointer',
    color: focused ? '#e50914' : 'rgba(255,255,255,0.75)',
    transform: focused ? 'scale(1.3)' : 'scale(1)',
    transition: 'transform 0.12s, color 0.12s',
    flexShrink: 0,
    padding: 0,
  }
}

export function PlayerScreen() {
  const { selectedContent, goBack } = useAppStore()
  const videoRef = useRef<HTMLVideoElement>(null)
  const shakaRef = useRef<shaka.Player | null>(null)
  const controlsTimerRef = useRef<number | null>(null)

  const [isBuffering, setIsBuffering] = useState(true)
  const [isPlaying, setIsPlaying] = useState(false)
  const [showControls, setShowControls] = useState(true)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [activeFocus, setActiveFocus] = useState<FocusTarget>('playpause')

  const hideControlsTimer = useCallback(() => {
    if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current)
    controlsTimerRef.current = window.setTimeout(() => setShowControls(false), 5000)
  }, [])

  const revealControls = useCallback((target: FocusTarget = 'playpause') => {
    setShowControls(true)
    setActiveFocus(target)
    hideControlsTimer()
  }, [hideControlsTimer])

  const seekVideo = useCallback((delta: number) => {
    const v = videoRef.current
    if (!v) return
    v.currentTime = Math.max(0, Math.min(v.duration || 0, v.currentTime + delta))
  }, [])

  useEffect(() => {
    const video = videoRef.current
    if (!video || !selectedContent) return
    setIsBuffering(true)
    setIsPlaying(false)
    setError(null)
    let cancelled = false
    const url = selectedContent.streamUrl

    const startPlay = () => {
      if (cancelled) return
      video.play()
        .then(() => {
          if (!cancelled) { setIsBuffering(false); setIsPlaying(true); hideControlsTimer() }
        })
        .catch((e: unknown) => {
          if (!cancelled) {
            setError(`Playback blocked: ${e instanceof Error ? e.message : String(e)}`)
            setIsBuffering(false)
          }
        })
    }

    const tryNative = (src: string) => {
      const onCanPlay = () => { if (!cancelled) startPlay() }
      const onErr = () => {
        if (cancelled) return
        video.removeEventListener('canplay', onCanPlay)
        const code = video.error?.code
        if (code === 4 && src !== 'https://www.w3schools.com/html/mov_bbb.mp4') {
          tryNative('https://www.w3schools.com/html/mov_bbb.mp4')
        } else {
          setError(`Video error: code ${code ?? 'unknown'}`)
          setIsBuffering(false)
        }
      }
      video.addEventListener('canplay', onCanPlay, { once: true })
      video.addEventListener('error', onErr, { once: true })
      video.src = src
    }

    tryNative(url)
    return () => {
      cancelled = true
      video.pause()
      video.src = ''
      if (shakaRef.current) { shakaRef.current.destroy().catch(() => {}); shakaRef.current = null }
      if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current)
    }
  }, [selectedContent, hideControlsTimer])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    const onTimeUpdate = () => setCurrentTime(video.currentTime)
    const onDurationChange = () => setDuration(video.duration)
    const onWaiting = () => setIsBuffering(true)
    const onPlaying = () => { setIsBuffering(false); setIsPlaying(true) }
    const onPause = () => setIsPlaying(false)
    video.addEventListener('timeupdate', onTimeUpdate)
    video.addEventListener('durationchange', onDurationChange)
    video.addEventListener('waiting', onWaiting)
    video.addEventListener('playing', onPlaying)
    video.addEventListener('pause', onPause)
    return () => {
      video.removeEventListener('timeupdate', onTimeUpdate)
      video.removeEventListener('durationchange', onDurationChange)
      video.removeEventListener('waiting', onWaiting)
      video.removeEventListener('playing', onPlaying)
      video.removeEventListener('pause', onPause)
    }
  }, [])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const key = mapKeyEvent(event)
      const video = videoRef.current
      if (!video) return

      if (key === TVKey.BACK) { event.preventDefault(); goBack(); return }
      event.preventDefault()

      if (!showControls) { revealControls('playpause'); return }
      hideControlsTimer()

      switch (key) {
        case TVKey.UP:
          if (activeFocus !== 'seekbar') setActiveFocus('seekbar')
          else setShowControls(false)
          break
        case TVKey.DOWN:
          if (activeFocus === 'seekbar') setActiveFocus('playpause')
          else revealControls(activeFocus)
          break
        case TVKey.LEFT:
          if (activeFocus === 'seekbar') seekVideo(-10)
          else setActiveFocus((f) => FOCUS_LEFT[f])
          break
        case TVKey.RIGHT:
          if (activeFocus === 'seekbar') seekVideo(+10)
          else setActiveFocus((f) => FOCUS_RIGHT[f])
          break
        case TVKey.OK:
          if (activeFocus === 'back') goBack()
          else if (activeFocus === 'rewind') seekVideo(-10)
          else if (activeFocus === 'forward') seekVideo(+10)
          else if (activeFocus === 'playpause' || activeFocus === 'seekbar') {
            if (video.paused) video.play().catch(() => {})
            else video.pause()
          }
          break
        case TVKey.PLAY_PAUSE:
          if (video.paused) video.play().catch(() => {}); else video.pause()
          break
        case TVKey.PLAY:
          video.play().catch(() => {})
          break
        case TVKey.PAUSE:
          video.pause()
          break
        case TVKey.REWIND:
          seekVideo(-10)
          break
        case TVKey.FAST_FORWARD:
          seekVideo(+10)
          break
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [goBack, revealControls, hideControlsTimer, showControls, seekVideo, activeFocus])

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0

  if (!selectedContent) { goBack(); return null }

  return (
    <div
      style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, background: '#000', overflow: 'hidden' }}
      onClick={() => revealControls()}
    >
      <video
        ref={videoRef}
        preload="auto"
        style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block', position: 'relative', zIndex: 1 }}
      />

      {isBuffering && (
        <div style={{
          position: 'absolute', top: 0, right: 0, bottom: 0, left: 0,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          zIndex: 2,
        }}>
          <Spinner size="lg" />
          <p style={{ color: 'rgba(255,255,255,0.65)', marginTop: 18, fontSize: '1rem', letterSpacing: 1 }}>Buffering…</p>
        </div>
      )}

      {error && (
        <div style={{
          position: 'absolute', top: 0, right: 0, bottom: 0, left: 0,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.8)', zIndex: 3,
        }}>
          <p style={{ color: '#fff', fontSize: '1.1rem', textAlign: 'center', padding: '0 32px', marginBottom: 28 }}>{error}</p>
          <button onClick={goBack} style={{ background: '#e50914', color: '#fff', padding: '12px 36px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: '0.95rem', fontWeight: 600 }}>
            Go Back
          </button>
        </div>
      )}

      {/* Controls overlay */}
      <div style={{
        position: 'absolute', top: 0, right: 0, bottom: 0, left: 0,
        zIndex: 4,
        opacity: showControls ? 1 : 0,
        pointerEvents: showControls ? 'auto' : 'none',
        transition: 'opacity 0.3s ease',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
      }}>
        <div style={{
          background: 'rgba(10,10,10,0.78)',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          padding: '12px 48px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}>

          {/* Seekbar row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Current time */}
            <span style={{
              color: '#fff',
              fontSize: '0.92rem',
              fontWeight: 500,
              minWidth: 48,
              textAlign: 'right',
              fontVariantNumeric: 'tabular-nums',
              flexShrink: 0,
              letterSpacing: 0.4,
            }}>
              {formatTime(currentTime)}
            </span>

            {/* Seekbar */}
            <div
              style={{ flex: 1, position: 'relative', padding: '10px 0', cursor: 'pointer' }}
              onClick={() => setActiveFocus('seekbar')}
            >
              <div style={{
                height: 18,
                background: 'rgba(255,255,255,0.22)',
                borderRadius: 9,
                overflow: 'hidden',
                position: 'relative',
              }}>
                <div style={{
                  position: 'absolute', top: 0, bottom: 0, left: 0,
                  width: `${progress}%`,
                  background: '#e50914',
                  borderRadius: 9,
                }} />
              </div>
              <div style={{
                position: 'absolute',
                top: '50%',
                left: `${progress}%`,
                transform: 'translate(-50%, -50%)',
                width: isFocused(activeFocus, 'seekbar') ? 28 : 24,
                height: isFocused(activeFocus, 'seekbar') ? 28 : 24,
                background: isFocused(activeFocus, 'seekbar') ? '#e50914' : '#ffffff',
                borderRadius: '50%',
                boxShadow: isFocused(activeFocus, 'seekbar')
                  ? '0 0 0 4px rgba(229,9,20,0.25), 0 4px 16px rgba(229,9,20,0.6), 0 2px 8px rgba(0,0,0,0.8)'
                  : '0 0 0 3px rgba(255,255,255,0.2), 0 4px 12px rgba(0,0,0,0.7)',
                transition: 'width 0.12s, height 0.12s, background 0.12s, box-shadow 0.12s',
              }} />
            </div>

            {/* Total duration */}
            <span style={{
              color: 'rgba(255,255,255,0.55)',
              fontSize: '0.92rem',
              fontWeight: 400,
              minWidth: 48,
              fontVariantNumeric: 'tabular-nums',
              flexShrink: 0,
              letterSpacing: 0.4,
            }}>
              {formatTime(duration)}
            </span>
          </div>

          {/* Buttons row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* Back */}
            <button style={iconBtnStyle(isFocused(activeFocus, 'back'))} onClick={goBack}>
              <BackIcon />
            </button>

            {/* Divider */}
            <div style={{ width: 1, height: 28, background: 'rgba(255,255,255,0.15)', flexShrink: 0 }} />

            {/* Rewind */}
            <button style={iconBtnStyle(isFocused(activeFocus, 'rewind'))} onClick={() => seekVideo(-10)}>
              <SkipBackIcon />
            </button>

            {/* Play / Pause */}
            <button
              style={iconBtnStyle(isFocused(activeFocus, 'playpause'))}
              onClick={() => {
                const v = videoRef.current
                if (!v) return
                if (v.paused) v.play().catch(() => {}); else v.pause()
              }}
            >
              {isPlaying ? <PauseIcon /> : <PlayIcon />}
            </button>

            {/* Forward */}
            <button style={iconBtnStyle(isFocused(activeFocus, 'forward'))} onClick={() => seekVideo(+10)}>
              <SkipForwardIcon />
            </button>
          </div>

        </div>
      </div>
    </div>
  )
}
