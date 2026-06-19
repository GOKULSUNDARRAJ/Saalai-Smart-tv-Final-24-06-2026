import { useState, useEffect, useCallback, useRef, type RefObject } from 'react'
import { useFocusable, FocusContext } from '@noriginmedia/norigin-spatial-navigation'
import { fetchMovieDetails } from '../api/moviesApi'
import type { MovieDetail, MovieItem } from '../api/moviesApi'
import { useAppStore } from '../store/appStore'
import { playNativeMovie, shouldUseNativePlayer, getResumePositionByTitle } from '../platform/nativeVideoPlayer'
import { hhmmssToMs, msToHHMMSS } from '../api/moviesApi'
import { tvStorage } from '../platform/storage'

const RELATED_COLS = 6

function RelatedCard({
  item, focusKey, onArrow, onSelect,
}: {
  item: MovieItem; focusKey: string
  onArrow: (dir: string) => boolean
  onSelect: () => void
}) {
  const [imgError, setImgError] = useState(false)
  const domRef = useRef<HTMLDivElement | null>(null)
  const { ref, focused } = useFocusable({
    focusKey,
    onEnterPress: onSelect,
    onArrowPress: onArrow,
  })
  const mergedRef = useCallback((el: HTMLDivElement | null) => {
    domRef.current = el
    const r = ref as unknown
    if (typeof r === 'function') (r as (e: HTMLDivElement | null) => void)(el)
    else if (r && typeof r === 'object') (r as { current: HTMLDivElement | null }).current = el
  }, [ref])
  useEffect(() => {
    if (!focused || !domRef.current) return
    let parent = domRef.current.parentElement
    while (parent) {
      const ov = getComputedStyle(parent).overflowY
      if (ov === 'auto' || ov === 'scroll') break
      parent = parent.parentElement
    }
    if (!parent) return
    const pRect = parent.getBoundingClientRect()
    const eRect = domRef.current.getBoundingClientRect()
    const safeBottom = pRect.bottom - 64
    const safeTop = pRect.top + 8
    if (eRect.top < safeTop) {
      parent.scrollTop -= safeTop - eRect.top + 8
    } else if (eRect.bottom > safeBottom) {
      parent.scrollTop += eRect.bottom - safeBottom + 16
    }
  }, [focused])

  return (
    <div style={{ flex: 1 }}>
      <div style={{ position: 'relative', width: '100%', paddingBottom: '150%' }}>
        <div
          ref={mergedRef}
          onClick={onSelect}
          style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            borderRadius: 10, overflow: 'hidden',
            outline: (window as any).isLegacyTv ? 'none' : (focused ? '3px solid #e50914' : '3px solid transparent'),
        boxShadow: (window as any).isLegacyTv && focused ? '0 0 0 3px #0a0a0a, 0 0 0 6px #e50914' : 'none',
            outlineOffset: 2,
            transform: focused ? 'scale(1.06)' : 'scale(1)',
            transition: 'transform 0.15s, outline-color 0.12s',
            zIndex: focused ? 10 : 1,
            background: '#1a1a1a', cursor: 'pointer',
          }}
        >
          {!imgError ? (
            <img src={item.logo} alt={item.name} onError={() => setImgError(true)}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          ) : (
            <div style={{
              width: '100%', height: '100%',
              background: 'linear-gradient(135deg, #1a1a2e, #16213e)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 6,
            }}>
              <span style={{ color: '#fff', fontSize: 9, fontWeight: 600, textAlign: 'center' }}>{item.name}</span>
            </div>
          )}
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 100%)',
            padding: '14px 4px 4px',
          }}>
            <p style={{ color: '#fff', fontSize: 9, fontWeight: 600, textAlign: 'center', margin: 0, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
              {item.name}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function MetaRow({ label, value }: { label: string; value: string }) {
  if (!value) return null
  return (
    <div style={{ display: 'flex', marginBottom: 8 }}>
      <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, width: 90, flexShrink: 0 }}>{label}</span>
      <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13 }}>{value}</span>
    </div>
  )
}

function ActionButton({
  focusKey, primary, children, onPress, onArrow, scrollToTop, onUp,
}: {
  focusKey: string
  primary?: boolean
  children: React.ReactNode
  onPress: () => void
  onArrow: (dir: string) => boolean
  scrollToTop: () => void
  onUp: () => void
}) {
  const { ref, focused } = useFocusable({
    focusKey,
    onEnterPress: onPress,
    onArrowPress: (dir) => {
      if (dir === 'up') { onUp(); return false }
      return onArrow(dir)
    },
    onFocus: scrollToTop,
  })

  return (
    <div
      ref={ref}
      onClick={onPress}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '10px 28px', borderRadius: 8, cursor: 'pointer', outline: 'none',
        border: primary ? 'none' : '2px solid rgba(255,255,255,0.3)',
        background: primary
          ? (focused ? '#e50914' : 'rgba(229,9,20,0.85)')
          : (focused ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.07)'),
        color: '#fff',
        fontWeight: primary ? 700 : 600,
        fontSize: 15,
        transform: focused ? 'scale(1.05)' : 'scale(1)',
        boxShadow: focused
          ? (primary ? '0 0 0 3px rgba(229,9,20,0.4)' : '0 0 0 3px rgba(255,255,255,0.2)')
          : 'none',
        transition: 'transform 0.12s, box-shadow 0.12s, background 0.12s',
      }}
    >
      {children}
    </div>
  )
}

export function MovieDetailScreen() {
  const { selectedMovieId, navigateToMovieDetail, navigate, goBack, getPreviousScreen, pendingAndroidResume, clearPendingAndroidResume } = useAppStore()
  const [detail, setDetail] = useState<MovieDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [localSavedMs, setLocalSavedMs] = useState(0)
  const isLaunchingRef = useRef(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const { ref, focusKey, setFocus } = useFocusable({ focusKey: 'moviedetail-screen', trackChildren: true })


  const scrollToTop = useCallback(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  const refreshDetail = useCallback(() => {
    if (!selectedMovieId) return
    fetchMovieDetails(selectedMovieId).then(d => { if (d) setDetail(d) })
  }, [selectedMovieId])

  useEffect(() => {
    if (!pendingAndroidResume) return
    if (!selectedMovieId || pendingAndroidResume.movieId !== selectedMovieId) return
    if (!shouldUseNativePlayer()) return
    const { url, title, movieId, startMs, relatedJson } = pendingAndroidResume
    clearPendingAndroidResume()
    isLaunchingRef.current = true
    playNativeMovie(url, title, movieId, startMs, undefined, relatedJson).then(() => {
      const savedPos = Number(tvStorage.getItem(`resume_pos_${movieId}`) ?? '0')
      setLocalSavedMs(savedPos)
      refreshDetail()
      isLaunchingRef.current = false
    })
  }, [selectedMovieId, pendingAndroidResume, clearPendingAndroidResume, refreshDetail])

  useEffect(() => {
    if (!selectedMovieId) return
    setLoading(true)
    setDetail(null)
    setLocalSavedMs(0)
    if (scrollRef.current) scrollRef.current.scrollTop = 0
    fetchMovieDetails(selectedMovieId).then(async (d) => {
      setDetail(d)
      setLoading(false)
      const stored = Number(tvStorage.getItem(`resume_pos_${selectedMovieId}`) ?? '0')
      const serverMs = d ? hhmmssToMs(d.playedTime) : 0
      let pos = stored > 0 ? stored : serverMs
      if (pos === 0 && d) {
        const titlePos = await getResumePositionByTitle(d.name)
        if (titlePos > 0) {
          pos = titlePos
          tvStorage.setItem(`resume_pos_${selectedMovieId}`, String(pos))
        }
      }
      setLocalSavedMs(pos)
      setTimeout(() => setFocus(pos > 0 ? 'moviedetail-resume' : 'moviedetail-play'), 100)
    })
  }, [selectedMovieId, setFocus])

  const prevScreen = getPreviousScreen()
  const DETAIL_PARENT: Partial<Record<string, string>> = {
    moviedetail: 'movies',
    tvshowdetail: 'tvshows',
    catchupdetail: 'catchup',
    radioplayer: 'radio',
  }
  const resolvedPrev = DETAIL_PARENT[prevScreen] ?? prevScreen
  const prevNavKey = `nav-${resolvedPrev}`

  const handleBack = useCallback(() => {
    const goingToMovieDetail = prevScreen === 'moviedetail'
    const goingToMovies = prevScreen === 'movies'
    const goingToHome = prevScreen === 'home'
    goBack()
    if (!goingToMovies && !goingToHome) {
      setTimeout(() => setFocus(goingToMovieDetail ? 'moviedetail-play' : prevNavKey), 80)
    }
  }, [goBack, setFocus, prevNavKey, prevScreen])

  const handleUpToNav = useCallback(() => {
    setFocus(prevNavKey)
  }, [setFocus, prevNavKey])

  const handlePlay = useCallback(async () => {
    if (!detail || isLaunchingRef.current) return
    isLaunchingRef.current = true
    const relatedJson = detail.related && detail.related.length > 0 ? JSON.stringify(detail.related) : undefined
    const launched = await playNativeMovie(detail.streamUrl, detail.name, detail.id, 0, true, relatedJson)
    if (launched) {
      if (useAppStore.getState().selectedMovieId !== detail.id) {
        isLaunchingRef.current = false
        return
      }
      const savedPos = Number(tvStorage.getItem(`resume_pos_${detail.id}`) ?? '0')
      setLocalSavedMs(savedPos)
      refreshDetail()
      if (savedPos > 0) {
        setTimeout(() => {
          setFocus('moviedetail-resume')
          isLaunchingRef.current = false
        }, 80)
      } else {
        isLaunchingRef.current = false
      }
    } else {
      isLaunchingRef.current = false
      if (!shouldUseNativePlayer()) {
        navigate('player', {
          id: `movie-${detail.id}`,
          title: detail.name,
          description: detail.description,
          thumbnailUrl: detail.logo,
          backdropUrl: detail.logo,
          streamUrl: detail.streamUrl,
          duration: 0,
          genre: [detail.category],
          year: parseInt(detail.releaseYear) || new Date().getFullYear(),
          rating: '',
          type: 'movie' as const,
          startPositionMs: 0,
          movieId: detail.id,
        })
      }
    }
  }, [detail, navigate, refreshDetail, setFocus])

  const handleResume = useCallback(async () => {
    if (!detail || isLaunchingRef.current) return
    isLaunchingRef.current = true
    const storedMs = Number(tvStorage.getItem(`resume_pos_${detail.id}`) ?? '0')
    const startMs = storedMs > 0 ? storedMs : hhmmssToMs(detail.playedTime)
    const relatedJson = detail.related && detail.related.length > 0 ? JSON.stringify(detail.related) : undefined
    const launched = await playNativeMovie(detail.streamUrl, detail.name, detail.id, startMs, undefined, relatedJson)
    if (launched) {
      if (useAppStore.getState().selectedMovieId !== detail.id) {
        isLaunchingRef.current = false
        return
      }
      const savedPos = Number(tvStorage.getItem(`resume_pos_${detail.id}`) ?? '0')
      setLocalSavedMs(savedPos)
      refreshDetail()
      if (savedPos > 0) {
        setTimeout(() => {
          setFocus('moviedetail-resume')
          isLaunchingRef.current = false
        }, 80)
      } else {
        isLaunchingRef.current = false
      }
    } else {
      isLaunchingRef.current = false
      if (!shouldUseNativePlayer()) {
        navigate('player', {
          id: `movie-${detail.id}`,
          title: detail.name,
          description: detail.description,
          thumbnailUrl: detail.logo,
          backdropUrl: detail.logo,
          streamUrl: detail.streamUrl,
          duration: 0,
          genre: [detail.category],
          year: parseInt(detail.releaseYear) || new Date().getFullYear(),
          rating: '',
          type: 'movie' as const,
          startPositionMs: startMs,
          movieId: detail.id,
        })
      }
    }
  }, [detail, navigate, refreshDetail, setFocus])

  const relatedRows = detail ? Math.ceil(detail.related.length / RELATED_COLS) : 0

  const relatedArrow = useCallback((row: number, col: number) => (dir: string): boolean => {
    if (!detail) return true
    if (dir === 'up') {
      if (row === 0) {
        scrollToTop()
        setFocus('moviedetail-play')
        return false
      }
      setFocus(`related-card-${row - 1}-${col}`)
      return false
    }
    if (dir === 'down') {
      if (row + 1 < relatedRows) {
        const nextLen = detail.related.slice((row + 1) * RELATED_COLS, (row + 2) * RELATED_COLS).length
        setFocus(`related-card-${row + 1}-${Math.min(col, nextLen - 1)}`)
        return false
      }
      return false
    }
    if (dir === 'left') {
      if (col > 0) { setFocus(`related-card-${row}-${col - 1}`); return false }
      return false
    }
    if (dir === 'right') {
      const rowLen = detail.related.slice(row * RELATED_COLS, (row + 1) * RELATED_COLS).length
      if (col < rowLen - 1) { setFocus(`related-card-${row}-${col + 1}`); return false }
      return false
    }
    return true
  }, [detail, relatedRows, setFocus, scrollToTop])

  if (loading) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.4)', fontSize: 16 }}>
        Loading…
      </div>
    )
  }

  if (!detail) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.4)', fontSize: 16 }}>
        Movie not found
      </div>
    )
  }

  const resumeMs = localSavedMs
  const resumeLabel = resumeMs > 0 ? msToHHMMSS(resumeMs) : ''

  return (
    <FocusContext.Provider value={focusKey}>
      <div ref={ref} style={{ height: '100%', overflow: 'hidden', position: 'relative' }}>
        <div
          ref={scrollRef}
          style={{ height: '100%', overflowY: 'auto', overflowX: 'hidden' }}
          className="scrollbar-hide"
        >
          <div style={{ position: 'relative', marginBottom: 12 }}>
            <img
              src={detail.logo}
              alt=""
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.22 }}
            />
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, #0a0a0a 0%, rgba(10,10,10,0.88) 55%, rgba(10,10,10,0.5) 100%)' }} />
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 50%, #0a0a0a 100%)' }} />

            <div style={{ position: 'relative', zIndex: 2, display: 'flex', alignItems: 'flex-start', padding: '20px 5vw 20px', gap: 24 }}>
              <img
                src={detail.logo}
                alt={detail.name}
                style={{ width: 350, height: 200, flexShrink: 0, borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.6)', objectFit: 'cover' }}
              />

              <div style={{ flex: 1, paddingTop: 4 }}>
                {detail.category && (
                  <span style={{ background: 'rgba(229,9,20,0.8)', color: '#fff', fontSize: 11, padding: '2px 10px', borderRadius: 4, marginBottom: 8, display: 'inline-block' }}>
                    {detail.category}
                  </span>
                )}
                <h1 style={{ color: '#fff', fontSize: 'clamp(18px, 2.8vw, 34px)', fontWeight: 700, margin: '6px 0 8px', lineHeight: 1.2 }}>
                  {detail.name}
                </h1>

                <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 10, color: 'rgba(255,255,255,0.55)', fontSize: 12 }}>
                  {detail.releaseYear && <span>{detail.releaseYear}</span>}
                  {detail.duration && <><span>·</span><span>{detail.duration}</span></>}
                  {detail.director && <><span>·</span><span>Dir: {detail.director}</span></>}
                  {detail.music && <><span>·</span><span>Music: {detail.music}</span></>}
                </div>

                {detail.description && (
                  <p style={{
                    color: 'rgba(255,255,255,0.75)', fontSize: 12, lineHeight: 1.55, marginBottom: 14, maxWidth: 520,
                    overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                  } as React.CSSProperties}>
                    {detail.description}
                  </p>
                )}

                {detail.cast && (
                  <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, marginBottom: 14, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', maxWidth: 480 }}>
                    Cast: {detail.cast}
                  </p>
                )}

                <div style={{ display: 'flex', gap: 16 }}>
                  <ActionButton
                    focusKey="moviedetail-play"
                    primary
                    onPress={handlePlay}
                    scrollToTop={scrollToTop}
                    onUp={() => {}}
                    onArrow={(dir) => {
                      if (dir === 'right') {
                        setFocus(resumeMs > 0 ? 'moviedetail-resume' : 'moviedetail-back')
                        return false
                      }
                      if (dir === 'down') {
                        if (detail.related.length > 0) { setFocus('related-card-0-0'); return false }
                        return false
                      }
                      return false
                    }}
                  >
                    ▶ Play
                  </ActionButton>
                  {resumeMs > 0 ? (
                    <>
                      <ActionButton
                        focusKey="moviedetail-resume"
                        onPress={handleResume}
                        scrollToTop={scrollToTop}
                        onUp={() => {}}
                        onArrow={(dir) => {
                          if (dir === 'left') { setFocus('moviedetail-play'); return false }
                          if (dir === 'right') { setFocus('moviedetail-back'); return false }
                          if (dir === 'down') {
                            if (detail.related.length > 0) { setFocus('related-card-0-0'); return false }
                            return false
                          }
                          return false
                        }}
                      >
                        ▶ Resume · {resumeLabel}
                      </ActionButton>
                      <ActionButton
                        focusKey="moviedetail-back"
                        onPress={handleBack}
                        scrollToTop={scrollToTop}
                        onUp={() => {}}
                        onArrow={(dir) => {
                          if (dir === 'left') { setFocus('moviedetail-resume'); return false }
                          if (dir === 'down') {
                            if (detail.related.length > 0) { setFocus('related-card-0-0'); return false }
                            return false
                          }
                          return false
                        }}
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M15 5L8 12L15 19" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/></svg> Back
                      </ActionButton>
                    </>
                  ) : (
                    <ActionButton
                      focusKey="moviedetail-back"
                      onPress={handleBack}
                      scrollToTop={scrollToTop}
                      onUp={() => {}}
                      onArrow={(dir) => {
                        if (dir === 'left') { setFocus('moviedetail-play'); return false }
                        if (dir === 'down') {
                          if (detail.related.length > 0) { setFocus('related-card-0-0'); return false }
                          return false
                        }
                        return false
                      }}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M15 5L8 12L15 19" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/></svg> Back
                    </ActionButton>
                  )}
                </div>
              </div>
            </div>
          </div>

          {detail.related.length > 0 && (
            <div style={{ paddingLeft: '5vw', paddingRight: '5vw', paddingBottom: 40 }}>
              <h2 style={{ color: '#fff', fontSize: 16, fontWeight: 700, marginBottom: 16 }}>More Like This</h2>
              {Array.from({ length: relatedRows }).map((_, rowIdx) => {
                const rowItems = detail.related.slice(rowIdx * RELATED_COLS, (rowIdx + 1) * RELATED_COLS)
                return (
                  <div key={rowIdx} style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                    {rowItems.map((item, colIdx) => (
                      <RelatedCard
                        key={item.id}
                        item={item}
                        focusKey={`related-card-${rowIdx}-${colIdx}`}
                        onArrow={relatedArrow(rowIdx, colIdx)}
                        onSelect={() => navigateToMovieDetail(item.id)}
                      />
                    ))}
                    {rowItems.length < RELATED_COLS && Array.from({ length: RELATED_COLS - rowItems.length }).map((_, i) => (
                      <div key={i} style={{ flex: 1 }}>
                        <div style={{ width: '100%', paddingBottom: '150%' }} />
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </FocusContext.Provider>
  )
}
