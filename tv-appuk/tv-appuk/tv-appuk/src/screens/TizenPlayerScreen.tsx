import { useState, useEffect, useRef, useCallback } from 'react'
import { useAppStore } from '../store/appStore'
import type { TizenPlayerOptions } from '../store/appStore'
import { mapKeyEvent, TVKey } from '../platform/keys'
import { tvStorage } from '../platform/storage'
import { updateStreamTime, fetchMovieDetails } from '../api/moviesApi'
import type { MovieItem } from '../api/moviesApi'
import { CircularProgress } from '../components/ui/Spinner'

interface AVPlayListener {
  onbufferingstart?: () => void
  onbufferingcomplete?: () => void
  oncurrentplaytime?: (ms: number) => void
  onevent?: (type: string, data: string) => void
  onerror?: (errCode: string) => void
  onstreamcompleted?: () => void
  ondrmevent?: (drmEvent: string, drmData: string) => void
}

interface AVPlay {
  open: (url: string) => void
  close: () => void
  setDisplayRect: (x: number, y: number, w: number, h: number) => void
  setDisplayMethod: (method: string) => void
  setListener: (listener: AVPlayListener) => void
  prepareAsync: (successCb: () => void, errorCb: (err: string) => void) => void
  play: () => void
  pause: () => void
  stop: () => void
  seekTo: (ms: number, successCb?: () => void, errorCb?: (err: string) => void) => void
  getCurrentTime: () => number
  getDuration: () => number
  getState: () => 'NONE' | 'IDLE' | 'READY' | 'PLAYING' | 'PAUSED'
}

function getAVPlay(): AVPlay | null {
  return (window as unknown as { webapis?: { avplay?: AVPlay } }).webapis?.avplay ?? null
}

function formatTime(ms: number): string {
  const totalSec = Math.floor(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

function getSeekStep(pressCount: number): number {
  if (pressCount <= 3) return 10000
  if (pressCount <= 8) return 30000
  return 60000
}

function formatSeekDelta(ms: number): string {
  const sign = ms >= 0 ? '+' : '-'
  const totalSec = Math.round(Math.abs(ms) / 1000)
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  if (m > 0) return `${sign}${m}:${String(s).padStart(2, '0')}`
  return `${sign}${s}s`
}

type FocusTarget = 'back' | 'rewind' | 'playpause' | 'forward' | 'more' | 'seekbar'

const FOCUS_LEFT: Record<FocusTarget, FocusTarget> = {
  back: 'back', rewind: 'back', playpause: 'rewind', forward: 'playpause', more: 'forward', seekbar: 'seekbar',
}
const FOCUS_RIGHT: Record<FocusTarget, FocusTarget> = {
  back: 'rewind', rewind: 'playpause', playpause: 'forward', forward: 'more', more: 'more', seekbar: 'seekbar',
}

const BackIcon = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
    <path d="M15 5L8 12L15 19" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)
const RewindIcon = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
    <path d="M12 5L5 12L12 19" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M19 5L12 12L19 19" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)
const ForwardIcon = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
    <path d="M5 5L12 12L5 19" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M12 5L19 12L12 19" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
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
const MoreIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
    <rect x="3" y="3" width="7" height="7" rx="1.2" />
    <rect x="14" y="3" width="7" height="7" rx="1.2" />
    <rect x="3" y="14" width="7" height="7" rx="1.2" />
    <rect x="14" y="14" width="7" height="7" rx="1.2" />
  </svg>
)

function btnStyle(focused: boolean): React.CSSProperties {
  return {
    width: 44, height: 44,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'none', border: 'none', outline: 'none', cursor: 'pointer',
    color: focused ? '#e50914' : 'rgba(255,255,255,0.75)',
    transform: focused ? 'scale(1.3)' : 'scale(1)',
    transition: 'transform 0.12s, color 0.12s',
    flexShrink: 0, padding: 0,
  }
}

const SEEK_STEP_MS = 10000

export function TizenPlayerScreen() {
  const { tizenPlayerOptions, goBack, navigateToMovieDetailFromTizenPlayer } = useAppStore()
  const opts = tizenPlayerOptions!

  const [localOpts, setLocalOpts] = useState<TizenPlayerOptions>(() => opts)
  const localOptsRef = useRef<TizenPlayerOptions>(localOpts)

  const [showNextUp, setShowNextUp] = useState(false)
  const [nextUpCountdown, setNextUpCountdown] = useState(10)
  const nextUpTimerRef = useRef<number | null>(null)
  const showNextUpRef = useRef(false)

  const [isBuffering, setIsBuffering] = useState(true)
  const [isPlaying, setIsPlaying] = useState(false)
  const [showControls, setShowControls] = useState(true)
  const [currentTimeMs, setCurrentTimeMs] = useState(0)
  const [durationMs, setDurationMs] = useState(0)
  const [activeFocus, setActiveFocus] = useState<FocusTarget>('playpause')
  const [error, setError] = useState<string | null>(null)

  const controlsTimerRef = useRef<number | null>(null)
  const positionTimerRef = useRef<number | null>(null)
  const streamTimeTimerRef = useRef<number | null>(null)
  const seekDebounceRef = useRef<number | null>(null)
  const seekTargetRef = useRef<number | null>(null)
  const finishedRef = useRef(false)
  const resolvedStartMs = useRef(0)

  const seekPressCountRef = useRef(0)
  const seekDirectionRef = useRef(0)
  const seekAccumRef = useRef(0)
  const seekDisplayTimerRef = useRef<number | null>(null)
  const [seekDisplay, setSeekDisplay] = useState<{ dir: number; totalMs: number } | null>(null)

  const [relatedMovies, setRelatedMovies] = useState<MovieItem[]>([])
  const [showMoreLikeThis, setShowMoreLikeThis] = useState(false)
  const [mltFocusIdx, setMltFocusIdx] = useState(0)
  const mltCardRefs = useRef<(HTMLDivElement | null)[]>([])
  const mltRowRefs = useRef<(HTMLDivElement | null)[]>([])
  const mltScrollRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const rowIdx = Math.floor(mltFocusIdx / 2)
    const rowEl = mltRowRefs.current[rowIdx]
    const scrollEl = mltScrollRef.current
    if (!rowEl || !scrollEl) return
    const rowRect = rowEl.getBoundingClientRect()
    const scrollRect = scrollEl.getBoundingClientRect()
    const relTop = rowRect.top - scrollRect.top
    const relBottom = rowRect.bottom - scrollRect.top
    if (relTop < 0) {
      scrollEl.scrollTop += relTop - 4
    } else if (relBottom > scrollEl.clientHeight) {
      scrollEl.scrollTop += relBottom - scrollEl.clientHeight + 4
    }
  }, [mltFocusIdx])

  useEffect(() => { localOptsRef.current = localOpts }, [localOpts])

  useEffect(() => {
    if (opts.movieId <= 0) return
    fetchMovieDetails(opts.movieId).then(d => {
      if (d && d.related.length > 0) setRelatedMovies(d.related)
    })
  }, [opts.movieId])

  useEffect(() => {
    if (showMoreLikeThis && controlsTimerRef.current) {
      clearTimeout(controlsTimerRef.current)
    }
  }, [showMoreLikeThis])

  useEffect(() => {
    const av = getAVPlay()
    if (!av) return
    try {
      const state = av.getState()
      if (state === 'NONE' || state === 'IDLE') return
      const w = showMoreLikeThis ? Math.round(1920 * 0.7) : 1920
      av.setDisplayRect(0, 0, w, 1080)
    } catch {}
  }, [showMoreLikeThis])

  const savePosition = useCallback(() => {
    if (finishedRef.current) return
    finishedRef.current = true
    const cur = localOptsRef.current
    if (!cur) return
    if (cur.disableResumeSave) return
    try {
      const av = getAVPlay()
      if (!av) return
      const state = av.getState()
      if (state === 'NONE' || state === 'IDLE') return
      const posMs = av.getCurrentTime()
      const durMs = av.getDuration()
      if (posMs > 0) {
        if (cur.movieId > 0) {
          tvStorage.setItem(`tizen_pos_${cur.movieId}`, String(posMs))
          tvStorage.setItem(`resume_pos_${cur.movieId}`, String(posMs))
          if (durMs > 0) tvStorage.setItem(`episode_dur_${cur.movieId}`, String(durMs))
          updateStreamTime(cur.movieId, 1, posMs).catch(() => {})

          const selectedTvShowId = useAppStore.getState().selectedTvShowId
          if (selectedTvShowId) {
            tvStorage.setJSON(`tvshow_resume_${selectedTvShowId}`, { episodeId: cur.movieId, episodeName: cur.title })
          }
        } else if (cur.url) {
          tvStorage.setItem(`resume_pos_${cur.url}`, String(posMs))
          if (durMs > 0) tvStorage.setItem(`resume_dur_${cur.url}`, String(durMs))
        }
        if (cur.title) tvStorage.setItem(`tizen_pos_title_${cur.title}`, String(posMs))
      }
    } catch { }
  }, [])

  const clearPosition = useCallback(() => {
    if (finishedRef.current) return
    finishedRef.current = true
    const cur = localOptsRef.current
    if (!cur) return
    try {
      if (cur.movieId > 0) {
        tvStorage.removeItem(`tizen_pos_${cur.movieId}`)
        tvStorage.removeItem(`resume_pos_${cur.movieId}`)
      } else if (cur.url) {
        tvStorage.removeItem(`resume_pos_${cur.url}`)
      }
      if (cur.title) tvStorage.removeItem(`tizen_pos_title_${cur.title}`)
    } catch { }
  }, [])

  const scheduleHideControls = useCallback(() => {
    if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current)
    controlsTimerRef.current = window.setTimeout(() => setShowControls(false), 5000)
  }, [])

  const revealControls = useCallback((target: FocusTarget = 'playpause') => {
    setShowControls(true)
    setActiveFocus(target)
    scheduleHideControls()
  }, [scheduleHideControls])

  const seek = useCallback((deltaMs: number) => {
    const av = getAVPlay()
    if (!av) return
    try {
      const state = av.getState()
      if (state !== 'PLAYING' && state !== 'PAUSED' && state !== 'READY') return
      const dur = av.getDuration()
      const base = seekTargetRef.current !== null ? seekTargetRef.current : av.getCurrentTime()
      const target = Math.max(0, Math.min(dur > 0 ? dur - 500 : base + deltaMs, base + deltaMs))
      seekTargetRef.current = target
      setCurrentTimeMs(target)
      if (seekDebounceRef.current) clearTimeout(seekDebounceRef.current)
      seekDebounceRef.current = window.setTimeout(() => {
        const finalTarget = seekTargetRef.current
        if (finalTarget === null) return
        try { av.seekTo(finalTarget) } catch { }
      }, 50)
    } catch { }
  }, [])

  const doSeek = useCallback((direction: 1 | -1) => {
    if (seekDirectionRef.current !== direction) {
      seekPressCountRef.current = 0
      seekAccumRef.current = 0
      seekDirectionRef.current = direction
    }
    seekPressCountRef.current++
    const step = getSeekStep(seekPressCountRef.current)
    const delta = direction * step
    seekAccumRef.current += delta
    seek(delta)
    setSeekDisplay({ dir: direction, totalMs: seekAccumRef.current })
    if (seekDisplayTimerRef.current) clearTimeout(seekDisplayTimerRef.current)
    seekDisplayTimerRef.current = window.setTimeout(() => {
      setSeekDisplay(null)
      seekPressCountRef.current = 0
      seekAccumRef.current = 0
      seekDirectionRef.current = 0
    }, 1500)
  }, [seek])

  const togglePlayPause = useCallback(() => {
    const av = getAVPlay()
    if (!av) return
    try {
      const state = av.getState()
      if (state === 'PLAYING') {
        av.pause()
        setIsPlaying(false)
        if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current)
      } else if (state === 'PAUSED' || state === 'READY') {
        av.play()
        setIsPlaying(true)
        scheduleHideControls()
      }
    } catch { }
  }, [scheduleHideControls])

  const handleBack = useCallback(() => {
    savePosition()
    goBack()
  }, [savePosition, goBack])

  const playNext = useCallback(() => {
    if (nextUpTimerRef.current) { clearInterval(nextUpTimerRef.current); nextUpTimerRef.current = null }
    setShowNextUp(false)
    showNextUpRef.current = false
    const cur = localOptsRef.current
    if (!cur.playlist || cur.playlistIndex === undefined) return
    const nextIndex = cur.playlistIndex + 1
    const nextItem = cur.playlist[nextIndex]
    if (!nextItem) return

    savePosition()
    
    // Save the next episode immediately as the last watched/resume episode
    const selectedTvShowId = useAppStore.getState().selectedTvShowId
    if (selectedTvShowId && nextItem.movieId) {
      tvStorage.setJSON(`tvshow_resume_${selectedTvShowId}`, { episodeId: nextItem.movieId, episodeName: nextItem.title })
    }

    finishedRef.current = false
    setIsBuffering(true)
    setIsPlaying(false)
    setCurrentTimeMs(0)
    setDurationMs(0)
    setError(null)
    setShowControls(true)
    setActiveFocus('playpause')
    setLocalOpts({
      url: nextItem.url,
      title: nextItem.title,
      movieId: nextItem.movieId,
      startPositionMs: 0,
      forceFromBeginning: false,
      isLive: cur.isLive,
      disableResumeSave: cur.disableResumeSave,
      playlist: cur.playlist,
      playlistIndex: nextIndex,
    })
  }, [])

  const cancelNextUp = useCallback(() => {
    if (nextUpTimerRef.current) { clearInterval(nextUpTimerRef.current); nextUpTimerRef.current = null }
    setShowNextUp(false)
    showNextUpRef.current = false
    goBack()
  }, [goBack])

  useEffect(() => {
    finishedRef.current = false
    seekTargetRef.current = null

    const cur = localOptsRef.current
    if (!cur) return

    let startMs = cur.startPositionMs
    if (!cur.forceFromBeginning && !cur.disableResumeSave && startMs === 0) {
      if (cur.movieId > 0) {
        const saved = Number(tvStorage.getItem(`tizen_pos_${cur.movieId}`) ?? '0')
        const savedResume = Number(tvStorage.getItem(`resume_pos_${cur.movieId}`) ?? '0')
        startMs = Math.max(saved, savedResume)
      }
      if (startMs === 0 && cur.title) {
        const saved = Number(tvStorage.getItem(`tizen_pos_title_${cur.title}`) ?? '0')
        if (saved > 0) startMs = saved
      }
    }
    resolvedStartMs.current = startMs

    const rootEl = document.getElementById('root')
    document.body.style.background = 'transparent'
    document.body.style.backgroundColor = 'transparent'
    document.documentElement.style.background = 'transparent'
    document.documentElement.style.backgroundColor = 'transparent'
    if (rootEl) { rootEl.style.background = 'transparent'; rootEl.style.backgroundColor = 'transparent' }

    const av = getAVPlay()
    if (!av) { setError('AVPlay not available'); setIsBuffering(false); return }

    try {
      av.open(cur.url)
      av.setListener({
        onbufferingstart: () => setIsBuffering(true),
        onbufferingcomplete: () => setIsBuffering(false),
        oncurrentplaytime: (ms) => { if (seekTargetRef.current === null) setCurrentTimeMs(ms) },
        onstreamcompleted: () => {
          const c = localOptsRef.current
          const hasNext = c.playlist && c.playlistIndex !== undefined && c.playlistIndex < c.playlist.length - 1
          if (hasNext) {
            finishedRef.current = false
            clearPosition()
            playNext()
          } else {
            clearPosition()
            goBack()
          }
        },
        onerror: (err) => { setError(`Playback error: ${err}`); setIsBuffering(false) },
        onevent: () => { },
        ondrmevent: () => { },
      })

      av.prepareAsync(
        () => {
          av.setDisplayRect(0, 0, 1920, 1080)
          try { av.setDisplayMethod('PLAYER_DISPLAY_MODE_FULL_SCREEN') } catch { }
          const dur = av.getDuration()
          setDurationMs(dur)
          const seekMs = resolvedStartMs.current
          if (seekMs > 0) {
            av.seekTo(seekMs,
              () => { av.play(); setIsPlaying(true); scheduleHideControls() },
              () => { av.play(); setIsPlaying(true); scheduleHideControls() }
            )
          } else {
            av.play()
            setIsPlaying(true)
            scheduleHideControls()
          }
        },
        (err) => { setError(`Prepare failed: ${err}`); setIsBuffering(false) }
      )
    } catch (e) {
      setError(`Init error: ${e}`)
      setIsBuffering(false)
    }

    positionTimerRef.current = window.setInterval(() => {
      try {
        const av2 = getAVPlay()
        if (!av2) return
        const state = av2.getState()
        if (state === 'PLAYING' || state === 'PAUSED') {
          const pos = av2.getCurrentTime()
          setIsPlaying(state === 'PLAYING')
          const dur = av2.getDuration()
          if (dur > 0) setDurationMs(dur)
          if (seekTargetRef.current !== null) {
            if (Math.abs(pos - seekTargetRef.current) < 5000) {
              seekTargetRef.current = null
              setCurrentTimeMs(pos)
            }
          } else {
            setCurrentTimeMs(pos)
          }
        }
      } catch { }
    }, 500)

    if (cur.movieId > 0 && !cur.disableResumeSave) {
      streamTimeTimerRef.current = window.setInterval(() => {
        try {
          const av2 = getAVPlay()
          if (!av2) return
          const state = av2.getState()
          if (state === 'PLAYING' || state === 'PAUSED') {
            const posMs = av2.getCurrentTime()
            const c2 = localOptsRef.current
            if (posMs > 0 && c2.movieId > 0 && !c2.disableResumeSave) {
              tvStorage.setItem(`tizen_pos_${c2.movieId}`, String(posMs))
              tvStorage.setItem(`resume_pos_${c2.movieId}`, String(posMs))
              try { const d2 = av2.getDuration(); if (d2 > 0) tvStorage.setItem(`episode_dur_${c2.movieId}`, String(d2)) } catch { }
              updateStreamTime(c2.movieId, 1, posMs).catch(() => {})
            }
          }
        } catch { }
      }, 60000)
    }

    return () => {
      if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current)
      if (positionTimerRef.current) clearInterval(positionTimerRef.current)
      if (streamTimeTimerRef.current) clearInterval(streamTimeTimerRef.current)
      if (seekDebounceRef.current) clearTimeout(seekDebounceRef.current)
      document.body.style.background = ''
      document.body.style.backgroundColor = ''
      document.documentElement.style.background = ''
      document.documentElement.style.backgroundColor = ''
      if (rootEl) { rootEl.style.background = ''; rootEl.style.backgroundColor = '' }
      savePosition()
      try {
        const av3 = getAVPlay()
        if (av3) {
          const s = av3.getState()
          if (s === 'PLAYING' || s === 'PAUSED' || s === 'READY') { av3.stop(); av3.close() }
        }
      } catch { }
    }
  }, [localOpts, goBack, savePosition, clearPosition, scheduleHideControls, playNext])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const key = mapKeyEvent(event)
      event.preventDefault()

      if (showMoreLikeThis) {
        const mltCount = relatedMovies.length
        const closeMlt = () => { setShowMoreLikeThis(false); setActiveFocus('more'); scheduleHideControls() }
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
            const av = getAVPlay()
            let posMs = 0
            try {
              if (av) posMs = av.getCurrentTime()
            } catch { }
            savePosition()
            navigateToMovieDetailFromTizenPlayer(movie.id, posMs)
          }
          return
        }
        return
      }

      if (showNextUpRef.current) {
        if (key === TVKey.OK || key === TVKey.PLAY || key === TVKey.PLAY_PAUSE) {
          if (nextUpTimerRef.current) { clearInterval(nextUpTimerRef.current); nextUpTimerRef.current = null }
          playNext()
        } else if (key === TVKey.BACK) {
          cancelNextUp()
        }
        return
      }

      if (key === TVKey.BACK) { handleBack(); return }

      const isMediaSeekKey = key === TVKey.REWIND || key === TVKey.FAST_FORWARD
      const isMediaPlayKey = key === TVKey.PLAY_PAUSE || key === TVKey.PLAY || key === TVKey.PAUSE

      if (!showControls) {
        revealControls(isMediaSeekKey ? (key === TVKey.REWIND ? 'rewind' : 'forward') : 'playpause')
        if (!isMediaSeekKey && !isMediaPlayKey) return
      }
      scheduleHideControls()

      if (localOpts.isLive) {
        switch (key) {
          case TVKey.OK:
          case TVKey.PLAY_PAUSE:
          case TVKey.PLAY:
          case TVKey.PAUSE:
            togglePlayPause()
            break
        }
        return
      }

      switch (key) {
        case TVKey.UP:
          if (activeFocus !== 'seekbar') setActiveFocus('seekbar')
          else setShowControls(false)
          break
        case TVKey.DOWN:
          if (activeFocus === 'seekbar') setActiveFocus('playpause')
          break
        case TVKey.LEFT:
          if (activeFocus === 'seekbar') doSeek(-1)
          else setActiveFocus(f => FOCUS_LEFT[f])
          break
        case TVKey.RIGHT:
          if (activeFocus === 'seekbar') doSeek(1)
          else setActiveFocus(f => FOCUS_RIGHT[f])
          break
        case TVKey.OK:
          if (activeFocus === 'back') handleBack()
          else if (activeFocus === 'rewind') doSeek(-1)
          else if (activeFocus === 'forward') doSeek(1)
          else if (activeFocus === 'more') { setShowMoreLikeThis(true); setMltFocusIdx(0); if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current) }
          else togglePlayPause()
          break
        case TVKey.PLAY_PAUSE:
        case TVKey.PLAY:
        case TVKey.PAUSE:
          togglePlayPause()
          break
        case TVKey.REWIND:
          doSeek(-1)
          break
        case TVKey.FAST_FORWARD:
          doSeek(1)
          break
      }
    }
    const handleKeyUp = (event: KeyboardEvent) => {
      const key = mapKeyEvent(event)
      if (
        key === TVKey.LEFT || key === TVKey.RIGHT ||
        key === TVKey.OK || key === TVKey.REWIND || key === TVKey.FAST_FORWARD
      ) {
        if (seekDisplayTimerRef.current) clearTimeout(seekDisplayTimerRef.current)
        seekDisplayTimerRef.current = window.setTimeout(() => {
          setSeekDisplay(null)
          seekPressCountRef.current = 0
          seekAccumRef.current = 0
          seekDirectionRef.current = 0
        }, 800)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [showControls, activeFocus, doSeek, togglePlayPause, handleBack, revealControls, scheduleHideControls, localOpts, playNext, cancelNextUp, showMoreLikeThis, mltFocusIdx, relatedMovies, savePosition, navigateToMovieDetailFromTizenPlayer])

  const progress = durationMs > 0 ? (currentTimeMs / durationMs) * 100 : 0

  if (!opts) { goBack(); return null }

  const nextItem = localOpts.playlist && localOpts.playlistIndex !== undefined
    ? localOpts.playlist[localOpts.playlistIndex + 1]
    : null

  return (
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'transparent', display: 'flex', overflow: 'hidden' }}>
      <div style={{ position: 'relative', width: showMoreLikeThis ? '70%' : '100%', height: '100%', transition: 'width 0.35s ease', flexShrink: 0, overflow: 'hidden' }}>
      {isBuffering && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 2, pointerEvents: 'none',
        }}>
          <CircularProgress />
        </div>
      )}

      {error && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.85)', zIndex: 3,
        }}>
          <p style={{ color: '#fff', fontSize: '1.1rem', textAlign: 'center', padding: '0 32px', marginBottom: 28 }}>{error}</p>
          <button
            onClick={handleBack}
            style={{ background: '#e50914', color: '#fff', padding: '12px 36px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: '0.95rem', fontWeight: 600 }}
          >
            Go Back
          </button>
        </div>
      )}

      {showNextUp && nextItem && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end',
          zIndex: 10, padding: '0 60px 80px 0',
          background: 'linear-gradient(to left, rgba(0,0,0,0.75) 0%, transparent 60%)',
        }}>
          <div style={{
            background: 'rgba(20,20,20,0.95)',
            borderRadius: 16,
            padding: '20px 24px',
            display: 'flex', flexDirection: 'column', gap: 12,
            maxWidth: 340, width: '100%',
            boxShadow: '0 8px 32px rgba(0,0,0,0.7)',
            border: '1px solid rgba(255,255,255,0.1)',
          }}>
            <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase' }}>
              Next Up in {nextUpCountdown}s
            </div>
            <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
              {nextItem.thumbnailUrl ? (
                <img
                  src={nextItem.thumbnailUrl}
                  alt={nextItem.title}
                  style={{ width: 96, height: 54, objectFit: 'cover', borderRadius: 8, flexShrink: 0 }}
                />
              ) : (
                <div style={{ width: 96, height: 54, background: 'rgba(255,255,255,0.08)', borderRadius: 8, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <PlayIcon />
                </div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: '#fff', fontSize: '0.95rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {nextItem.title}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => { if (nextUpTimerRef.current) { clearInterval(nextUpTimerRef.current); nextUpTimerRef.current = null } playNext() }}
                style={{ flex: 1, background: '#e50914', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 0', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer' }}
              >
                Play Now
              </button>
              <button
                onClick={cancelNextUp}
                style={{ flex: 1, background: 'rgba(255,255,255,0.12)', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 0', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {seekDisplay && !localOpts.isLive && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 5,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'none',
        }}>
          <div style={{
            background: 'rgba(0,0,0,0.72)',
            borderRadius: '14px',
            padding: '14px 28px',
            backdropFilter: 'blur(4px)',
          }}>
            <span style={{ fontSize: '22px', color: '#fff', fontWeight: 700, fontVariantNumeric: 'tabular-nums', letterSpacing: 0.5 }}>
              {formatSeekDelta(seekDisplay.totalMs)}
            </span>
          </div>
        </div>
      )}

      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        zIndex: 4,
        opacity: showControls ? 1 : 0,
        pointerEvents: showControls ? 'auto' : 'none',
        transition: 'opacity 0.3s ease',
        display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
      }}>
        <div style={{
          background: 'rgba(0,0,0,0.78)',
          borderRadius: '24px 24px 0 0',
          padding: '16px 48px 14px',
          display: 'flex', flexDirection: 'column', gap: 8,
        }}>

          {!localOpts.isLive && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ color: '#fff', fontSize: '0.92rem', fontWeight: 500, minWidth: 48, textAlign: 'right', fontVariantNumeric: 'tabular-nums', flexShrink: 0, letterSpacing: 0.4 }}>
                {formatTime(currentTimeMs)}
              </span>

              <div style={{ flex: 1, position: 'relative', padding: '14px 0', cursor: 'pointer' }} onClick={() => setActiveFocus('seekbar')}>
                <div style={{ height: 18, background: 'rgba(255,255,255,0.2)', borderRadius: 9, overflow: 'hidden', position: 'relative' }}>
                  <div style={{
                    position: 'absolute', top: 0, left: 0, bottom: 0,
                    width: `${progress}%`,
                    background: '#e50914',
                    borderRadius: 9,
                    transition: 'width 0.15s linear',
                  }} />
                </div>
                <div style={{
                  position: 'absolute', top: '50%', left: `clamp(14px, ${progress}%, calc(100% - 14px))`,
                  transform: 'translate(-50%, -50%)',
                  width: activeFocus === 'seekbar' ? 28 : 24,
                  height: activeFocus === 'seekbar' ? 28 : 24,
                  background: activeFocus === 'seekbar' ? '#e50914' : '#ffffff',
                  borderRadius: '50%',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.7)',
                  transition: 'width 0.12s, height 0.12s, background 0.12s',
                }} />
              </div>

              <span style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.92rem', fontWeight: 400, minWidth: 48, fontVariantNumeric: 'tabular-nums', flexShrink: 0, letterSpacing: 0.4 }}>
                {formatTime(durationMs)}
              </span>
            </div>
          )}

          {localOpts.isLive ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <button style={btnStyle(true)} onClick={togglePlayPause}>
                {isPlaying ? <PauseIcon /> : <PlayIcon />}
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button style={btnStyle(activeFocus === 'back')} onClick={handleBack}>
                <BackIcon />
              </button>

              <div style={{ width: 1, height: 28, background: 'rgba(255,255,255,0.15)', flexShrink: 0 }} />

              <button style={btnStyle(activeFocus === 'rewind')} onClick={() => doSeek(-1)}>
                <RewindIcon />
              </button>

              <button style={btnStyle(activeFocus === 'playpause')} onClick={togglePlayPause}>
                {isPlaying ? <PauseIcon /> : <PlayIcon />}
              </button>

              <button style={btnStyle(activeFocus === 'forward')} onClick={() => doSeek(1)}>
                <ForwardIcon />
              </button>

              {relatedMovies.length > 0 && !localOpts.isLive && (
                <button
                  style={btnStyle(activeFocus === 'more')}
                  onClick={() => { setShowMoreLikeThis(true); setMltFocusIdx(0); if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current) }}
                >
                  <MoreIcon />
                </button>
              )}
            </div>
          )}

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
        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', padding: '8px 0px 20px 16px', boxSizing: 'border-box', overflow: 'hidden' }}>
          <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10, fontWeight: 700, letterSpacing: 2.5, textTransform: 'uppercase', marginBottom: 10, paddingLeft: 2 }}>
            More Like This
          </div>
          <div ref={mltScrollRef} style={{ overflowY: 'auto', flex: 1, width: '100%', padding: '4px 4px 4px 4px', boxSizing: 'border-box' }} className="scrollbar-hide">
            {Array.from({ length: Math.ceil(relatedMovies.length / 2) }).map((_, rowIdx) => {
              const rowMovies = relatedMovies.slice(rowIdx * 2, (rowIdx + 1) * 2)
              return (
                <div key={rowIdx} ref={(el) => { mltRowRefs.current[rowIdx] = el }} style={{ display: 'flex', marginBottom: 8 }}>
                  {rowMovies.map((movie, colIdx) => {
                    const idx = rowIdx * 2 + colIdx
                    return (
                      <div key={movie.id} style={{ flex: 1, marginRight: colIdx === 0 ? 8 : 0 }}>
                        <div
                          ref={(el) => { mltCardRefs.current[idx] = el }}
                          onClick={() => {
                            const av2 = getAVPlay()
                            let posMs = 0
                            try { if (av2) posMs = av2.getCurrentTime() } catch { }
                            savePosition()
                            navigateToMovieDetailFromTizenPlayer(movie.id, posMs)
                          }}
                          style={{
                            position: 'relative',
                            width: '100%',
                            paddingBottom: '150%',
                            height: 0,
                            borderRadius: 8,
                            overflow: 'hidden',
                            boxShadow: 'none',
                            background: '#1a1a1a',
                            cursor: 'pointer',
                          }}
                        >
                          <img src={movie.logo} alt={movie.name} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
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
                      </div>
                    )
                  })}
                  {rowMovies.length < 2 && <div style={{ flex: 1 }}><div style={{ paddingBottom: '150%' }} /></div>}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
    </div>
  )
}

