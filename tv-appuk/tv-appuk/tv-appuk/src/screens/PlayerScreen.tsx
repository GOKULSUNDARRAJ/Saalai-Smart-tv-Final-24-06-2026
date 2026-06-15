import { useState, useEffect, useCallback, useRef } from 'react'
import { useAppStore } from '../store/appStore'
import { mapKeyEvent, TVKey } from '../platform/keys'
import { CircularProgress } from '../components/ui/Spinner'
import shaka from 'shaka-player'
import { updateStreamTime, fetchMovieDetails } from '../api/moviesApi'
import type { MovieItem } from '../api/moviesApi'
import { tvStorage } from '../platform/storage'
import type { ContentItem } from '../types/content'

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
    <path d="M15 5L8 12L15 19" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
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
  const { selectedContent, goBack, navigateToMovieDetailFromPlayer } = useAppStore()
  const videoRef = useRef<HTMLVideoElement>(null)
  const shakaRef = useRef<shaka.Player | null>(null)
  const controlsTimerRef = useRef<number | null>(null)

  const [localContent, setLocalContent] = useState<ContentItem | null>(selectedContent)
  const localContentRef = useRef<ContentItem | null>(localContent)
  useEffect(() => { localContentRef.current = localContent }, [localContent])

  const [relatedMovies, setRelatedMovies] = useState<MovieItem[]>([])
  const [showMoreLikeThis, setShowMoreLikeThis] = useState(false)
  const [mltFocusIdx, setMltFocusIdx] = useState(0)

  useEffect(() => {
    const movieId = localContent?.movieId
    if (!movieId || movieId <= 0) return
    setRelatedMovies([])
    fetchMovieDetails(movieId).then(d => {
      if (d && d.related.length > 0) setRelatedMovies(d.related)
    })
  }, [localContent?.movieId])

  useEffect(() => {
    if (showMoreLikeThis && controlsTimerRef.current) {
      clearTimeout(controlsTimerRef.current)
    }
  }, [showMoreLikeThis])

  const [showNextUp, setShowNextUp] = useState(false)
  const [nextUpCountdown, setNextUpCountdown] = useState(10)
  const showNextUpRef = useRef(false)
  const nextUpTimerRef = useRef<number | null>(null)

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

  const clearNextUpTimer = useCallback(() => {
    if (nextUpTimerRef.current) { clearInterval(nextUpTimerRef.current); nextUpTimerRef.current = null }
  }, [])

  const playNext = useCallback(() => {
    clearNextUpTimer()
    setShowNextUp(false)
    showNextUpRef.current = false
    const cur = localContentRef.current
    if (!cur?.playlist || cur.playlistIndex === undefined) return
    const nextIndex = cur.playlistIndex + 1
    const nextItem = cur.playlist[nextIndex]
    if (!nextItem) return
    const next: ContentItem = {
      ...cur,
      streamUrl: nextItem.url,
      title: nextItem.title,
      movieId: nextItem.movieId ?? 0,
      thumbnailUrl: nextItem.thumbnailUrl ?? cur.thumbnailUrl,
      startPositionMs: 0,
      playlistIndex: nextIndex,
    }
    setLocalContent(next)
    setCurrentTime(0)
    setDuration(0)
    setError(null)
    setIsBuffering(true)
    setIsPlaying(false)
    setShowControls(true)
    setActiveFocus('playpause')
  }, [clearNextUpTimer])

  const cancelNextUp = useCallback(() => {
    clearNextUpTimer()
    setShowNextUp(false)
    showNextUpRef.current = false
    goBack()
  }, [clearNextUpTimer, goBack])

  const playNextRef = useRef(playNext)
  const cancelNextRef = useRef(cancelNextUp)
  useEffect(() => { playNextRef.current = playNext }, [playNext])
  useEffect(() => { cancelNextRef.current = cancelNextUp }, [cancelNextUp])

  useEffect(() => {
    const video = videoRef.current
    if (!video || !localContent) return
    setIsBuffering(true)
    setIsPlaying(false)
    setError(null)
    let cancelled = false
    const url = localContent.streamUrl

    const startPositionMs = localContent.startPositionMs ?? 0

    const startPlay = () => {
      if (cancelled) return
      if (startPositionMs > 0) {
        video.currentTime = startPositionMs / 1000
      }
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
  }, [localContent, hideControlsTimer])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    const onTimeUpdate = () => setCurrentTime(video.currentTime)
    const onDurationChange = () => setDuration(video.duration)
    const onProgress = () => {}
    const onWaiting = () => setIsBuffering(true)
    const onPlaying = () => { setIsBuffering(false); setIsPlaying(true) }
    const onPause = () => setIsPlaying(false)
    const onEnded = () => {
      const cur = localContentRef.current
      if (cur?.playlist && cur.playlistIndex !== undefined && cur.playlistIndex < cur.playlist.length - 1) {
        playNextRef.current()
      } else {
        goBack()
      }
    }
    video.addEventListener('timeupdate', onTimeUpdate)
    video.addEventListener('durationchange', onDurationChange)
    video.addEventListener('progress', onProgress)
    video.addEventListener('waiting', onWaiting)
    video.addEventListener('playing', onPlaying)
    video.addEventListener('pause', onPause)
    video.addEventListener('ended', onEnded)
    return () => {
      video.removeEventListener('timeupdate', onTimeUpdate)
      video.removeEventListener('durationchange', onDurationChange)
      video.removeEventListener('progress', onProgress)
      video.removeEventListener('waiting', onWaiting)
      video.removeEventListener('playing', onPlaying)
      video.removeEventListener('pause', onPause)
      video.removeEventListener('ended', onEnded)
    }
  }, [goBack])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const key = mapKeyEvent(event)
      const video = videoRef.current
      if (!video) return

      if (showMoreLikeThis) {
        event.preventDefault()
        const mltCount = relatedMovies.length
        const closeMlt = () => { setShowMoreLikeThis(false); setActiveFocus('seekbar'); hideControlsTimer() }
        if (key === TVKey.BACK) { closeMlt(); return }
        if (key === TVKey.LEFT) {
          if (mltFocusIdx % 2 === 0) closeMlt()
          else setMltFocusIdx(i => i - 1)
          return
        }
        if (key === TVKey.RIGHT) {
          if (mltFocusIdx % 2 === 1) return
          if (mltFocusIdx + 1 < mltCount) setMltFocusIdx(i => i + 1)
          return
        }
        if (key === TVKey.UP) {
          if (mltFocusIdx >= 2) setMltFocusIdx(i => i - 2)
          return
        }
        if (key === TVKey.DOWN) {
          if (mltFocusIdx + 2 < mltCount) setMltFocusIdx(i => i + 2)
          return
        }
        if (key === TVKey.OK) {
          const movie = relatedMovies[mltFocusIdx]
          if (movie) {
            const v = videoRef.current
            let posMs = 0
            if (v && localContentRef.current?.movieId && v.currentTime > 0) {
              posMs = Math.floor(v.currentTime * 1000)
              tvStorage.setItem(`resume_pos_${localContentRef.current.movieId}`, String(posMs))
              updateStreamTime(localContentRef.current.movieId, 1, posMs).catch(() => {})
            }
            navigateToMovieDetailFromPlayer(movie.id, posMs)
          }
          return
        }
        return
      }

      if (showNextUpRef.current) {
        event.preventDefault()
        if (key === TVKey.OK || key === TVKey.PLAY || key === TVKey.PLAY_PAUSE) {
          playNextRef.current()
        } else if (key === TVKey.BACK) {
          cancelNextRef.current()
        }
        return
      }

      if (key === TVKey.BACK) {
        event.preventDefault()
        const v = videoRef.current
        if (v && localContentRef.current?.movieId && v.currentTime > 0) {
          const posMs = Math.floor(v.currentTime * 1000)
          tvStorage.setItem(`resume_pos_${localContentRef.current.movieId}`, String(posMs))
          updateStreamTime(localContentRef.current.movieId, 1, posMs).catch(() => {})
        }
        goBack()
        return
      }
      event.preventDefault()

      if (!showControls) { revealControls('playpause'); return }
      hideControlsTimer()

      switch (key) {
        case TVKey.UP:
          if (activeFocus !== 'seekbar') setActiveFocus('seekbar')
          else if (relatedMovies.length > 0) {
            setShowMoreLikeThis(true)
            setMltFocusIdx(0)
            if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current)
          } else {
            setShowControls(false)
          }
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
  }, [goBack, revealControls, hideControlsTimer, showControls, seekVideo, activeFocus, showMoreLikeThis, mltFocusIdx, relatedMovies, navigateToMovieDetailFromPlayer])

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0

  if (!localContent) { goBack(); return null }

  const nextItem = localContent.playlist && localContent.playlistIndex !== undefined
    ? localContent.playlist[localContent.playlistIndex + 1]
    : undefined

  return (
    <div
      style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, background: '#000', overflow: 'hidden', display: 'flex' }}
      onClick={() => revealControls()}
    >
      <div style={{ position: 'relative', width: showMoreLikeThis ? '70%' : '100%', height: '100%', transition: 'width 0.35s ease', flexShrink: 0, overflow: 'hidden' }}>
      <video
        ref={videoRef}
        preload="auto"
        style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block', position: 'relative', zIndex: 1 }}
      />

      {isBuffering && (
        <div style={{
          position: 'absolute', top: 0, right: 0, bottom: 0, left: 0,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.55)',
          zIndex: 2,
        }}>
          <CircularProgress />
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

      {/* Next Up overlay */}
      {showNextUp && nextItem && (
        <div style={{
          position: 'absolute', bottom: 100, right: 48,
          background: 'rgba(20,20,20,0.92)',
          borderRadius: 12,
          padding: '18px 22px',
          zIndex: 10,
          minWidth: 240,
          maxWidth: 300,
          boxShadow: '0 8px 32px rgba(0,0,0,0.7)',
        }}>
          <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 6 }}>
            Up Next
          </div>
          <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, marginBottom: 6 }}>
            Playing in {nextUpCountdown}s
          </div>
          <div style={{ color: '#fff', fontSize: 14, fontWeight: 600, marginBottom: 14, lineHeight: 1.3 }}>
            {nextItem.title}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={() => playNextRef.current()}
              style={{ flex: 1, background: '#e50914', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 0', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
            >
              Play Now
            </button>
            <button
              onClick={() => cancelNextRef.current()}
              style={{ flex: 1, background: 'rgba(255,255,255,0.12)', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 0', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
            >
              Cancel
            </button>
          </div>
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
            <button style={iconBtnStyle(isFocused(activeFocus, 'back'))} onClick={() => {
              const v = videoRef.current
              if (v && localContent?.movieId && v.currentTime > 0) {
                const posMs = Math.floor(v.currentTime * 1000)
                tvStorage.setItem(`resume_pos_${localContent.movieId}`, String(posMs))
                updateStreamTime(localContent.movieId, 1, posMs).catch(() => {})
              }
              goBack()
            }}>
              <BackIcon />
            </button>

            <div style={{ width: 1, height: 28, background: 'rgba(255,255,255,0.15)', flexShrink: 0 }} />

            <button style={iconBtnStyle(isFocused(activeFocus, 'rewind'))} onClick={() => seekVideo(-10)}>
              <SkipBackIcon />
            </button>

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

            <button style={iconBtnStyle(isFocused(activeFocus, 'forward'))} onClick={() => seekVideo(+10)}>
              <SkipForwardIcon />
            </button>
          </div>

        </div>
      </div>
      </div>

      <div style={{
        width: showMoreLikeThis && relatedMovies.length > 0 ? '30%' : '0',
        height: '100%',
        transition: 'width 0.35s ease',
        flexShrink: 0,
        overflow: 'hidden',
        background: 'rgba(10,10,10,0.97)',
        borderLeft: '1px solid rgba(255,255,255,0.08)',
      }}>
        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', padding: '28px 16px 20px', boxSizing: 'border-box', overflow: 'hidden' }}>
          <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10, fontWeight: 700, letterSpacing: 2.5, textTransform: 'uppercase', marginBottom: 18, paddingLeft: 2 }}>
            More Like This
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, overflowY: 'auto', flex: 1 }} className="scrollbar-hide">
            {relatedMovies.map((movie, idx) => (
              <div
                key={movie.id}
                onClick={() => {
                  const v = videoRef.current
                  let posMs = 0
                  if (v && localContent?.movieId && v.currentTime > 0) {
                    posMs = Math.floor(v.currentTime * 1000)
                    tvStorage.setItem(`resume_pos_${localContent.movieId}`, String(posMs))
                    updateStreamTime(localContent.movieId, 1, posMs).catch(() => {})
                  }
                  navigateToMovieDetailFromPlayer(movie.id, posMs)
                }}
                style={{
                  aspectRatio: '2/3',
                  borderRadius: 8,
                  overflow: 'hidden',
                  position: 'relative',
                  outline: mltFocusIdx === idx ? '3px solid #e50914' : '3px solid transparent',
                  outlineOffset: 2,
                  transform: mltFocusIdx === idx ? 'scale(1.05)' : 'scale(1)',
                  transition: 'transform 0.15s, outline-color 0.12s',
                  background: '#1a1a1a',
                  cursor: 'pointer',
                  zIndex: mltFocusIdx === idx ? 2 : 1,
                }}
              >
                <img src={movie.logo} alt={movie.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                <div style={{
                  position: 'absolute', bottom: 0, left: 0, right: 0,
                  background: 'linear-gradient(to top, rgba(0,0,0,0.88) 0%, transparent 100%)',
                  padding: '20px 4px 5px',
                }}>
                  <p style={{ color: '#fff', fontSize: 9, fontWeight: 600, textAlign: 'center', margin: 0, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                    {movie.name}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
