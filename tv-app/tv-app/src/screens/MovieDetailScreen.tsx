import { useState, useEffect, useCallback, useRef, type RefObject } from 'react'
import { useFocusable, FocusContext } from '@noriginmedia/norigin-spatial-navigation'
import { fetchMovieDetails } from '../api/moviesApi'
import type { MovieDetail, MovieItem } from '../api/moviesApi'
import { useAppStore } from '../store/appStore'
import { playNativeMovie } from '../platform/nativeVideoPlayer'
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
  const { ref, focused } = useFocusable({
    focusKey,
    onEnterPress: onSelect,
    onArrowPress: onArrow,
    onFocus: () => (ref as RefObject<HTMLDivElement>).current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }),
  })

  return (
    <div
      ref={ref}
      onClick={onSelect}
      style={{
        flex: 1, aspectRatio: '2/3', borderRadius: 10, overflow: 'hidden', position: 'relative',
        outline: focused ? '3px solid #e50914' : '3px solid transparent',
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
  const { selectedMovieId, navigateToMovieDetail, navigate, goBack, getPreviousScreen } = useAppStore()
  const [detail, setDetail] = useState<MovieDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [localSavedMs, setLocalSavedMs] = useState(0)
  const [, setIsLaunching] = useState(false)
  const isLaunchingRef = useRef(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const { ref, focusKey, setFocus } = useFocusable({ focusKey: 'moviedetail-screen', trackChildren: true })

  const scrollToTop = useCallback(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  useEffect(() => {
    if (!selectedMovieId) return
    setLoading(true)
    setDetail(null)
    setLocalSavedMs(0)
    if (scrollRef.current) scrollRef.current.scrollTop = 0
    fetchMovieDetails(selectedMovieId).then((d) => {
      setDetail(d)
      setLoading(false)
      const stored = Number(tvStorage.getItem(`resume_pos_${selectedMovieId}`) ?? '0')
      const serverMs = d ? hhmmssToMs(d.playedTime) : 0
      const pos = stored > 0 ? stored : serverMs
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

  const refreshDetail = useCallback(() => {
    if (!selectedMovieId) return
    fetchMovieDetails(selectedMovieId).then(d => { if (d) setDetail(d) })
  }, [selectedMovieId])

  const handlePlay = useCallback(async () => {
    if (!detail || isLaunchingRef.current) return
    isLaunchingRef.current = true
    setIsLaunching(true)
    tvStorage.removeItem(`resume_pos_${detail.id}`)
    setLocalSavedMs(0)
    const launched = await playNativeMovie(detail.streamUrl, detail.name, detail.id, 0)
    if (launched) {
      const savedPos = Number(tvStorage.getItem(`resume_pos_${detail.id}`) ?? '0')
      setLocalSavedMs(savedPos)
      refreshDetail()
      if (savedPos > 0) {
        setTimeout(() => {
          setFocus('moviedetail-resume')
          isLaunchingRef.current = false
          setIsLaunching(false)
        }, 300)
      } else {
        isLaunchingRef.current = false
        setIsLaunching(false)
      }
    } else {
      isLaunchingRef.current = false
      setIsLaunching(false)
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
  }, [detail, navigate, refreshDetail, setFocus])

  const handleResume = useCallback(async () => {
    if (!detail || isLaunchingRef.current) return
    isLaunchingRef.current = true
    setIsLaunching(true)
    const storedMs = Number(tvStorage.getItem(`resume_pos_${detail.id}`) ?? '0')
    const startMs = storedMs > 0 ? storedMs : hhmmssToMs(detail.playedTime)
    const launched = await playNativeMovie(detail.streamUrl, detail.name, detail.id, startMs)
    if (launched) {
      const savedPos = Number(tvStorage.getItem(`resume_pos_${detail.id}`) ?? '0')
      setLocalSavedMs(savedPos)
      refreshDetail()
      if (savedPos > 0) {
        setTimeout(() => {
          setFocus('moviedetail-resume')
          isLaunchingRef.current = false
          setIsLaunching(false)
        }, 300)
      } else {
        isLaunchingRef.current = false
        setIsLaunching(false)
      }
    } else {
      isLaunchingRef.current = false
      setIsLaunching(false)
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
          <div style={{ position: 'relative', minHeight: '55vh', marginBottom: 32 }}>
            <img
              src={detail.logo}
              alt=""
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.22 }}
            />
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, #0a0a0a 0%, rgba(10,10,10,0.88) 55%, rgba(10,10,10,0.5) 100%)' }} />
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 50%, #0a0a0a 100%)' }} />

            <div style={{ position: 'relative', zIndex: 2, display: 'flex', alignItems: 'flex-start', padding: '40px 5vw 40px', gap: 32 }}>
              <img
                src={detail.logo}
                alt={detail.name}
                style={{ width: 160, flexShrink: 0, borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.6)', objectFit: 'cover', aspectRatio: '2/3' }}
              />

              <div style={{ flex: 1, paddingTop: 8 }}>
                {detail.category && (
                  <span style={{ background: 'rgba(229,9,20,0.8)', color: '#fff', fontSize: 12, padding: '2px 12px', borderRadius: 4, marginBottom: 12, display: 'inline-block' }}>
                    {detail.category}
                  </span>
                )}
                <h1 style={{ color: '#fff', fontSize: 'clamp(22px, 3.5vw, 42px)', fontWeight: 700, margin: '8px 0 12px', lineHeight: 1.2 }}>
                  {detail.name}
                </h1>

                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, color: 'rgba(255,255,255,0.55)', fontSize: 13 }}>
                  {detail.releaseYear && <span>{detail.releaseYear}</span>}
                  {detail.duration && <><span>·</span><span>{detail.duration}</span></>}
                </div>

                {detail.description && (
                  <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13, lineHeight: 1.6, marginBottom: 16, maxWidth: 520 }}>
                    {detail.description}
                  </p>
                )}

                <div style={{ marginBottom: 20 }}>
                  <MetaRow label="Director" value={detail.director} />
                  <MetaRow label="Cast" value={detail.cast} />
                  <MetaRow label="Music" value={detail.music} />
                </div>

                <div style={{ display: 'flex', gap: 16 }}>
                  <ActionButton
                    focusKey="moviedetail-play"
                    primary
                    onPress={handlePlay}
                    scrollToTop={scrollToTop}
                    onUp={handleUpToNav}
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
                        onUp={handleUpToNav}
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
                        ⏵ Resume ({resumeLabel})
                      </ActionButton>
                      <ActionButton
                        focusKey="moviedetail-back"
                        onPress={handleBack}
                        scrollToTop={scrollToTop}
                        onUp={handleUpToNav}
                        onArrow={(dir) => {
                          if (dir === 'left') { setFocus('moviedetail-resume'); return false }
                          if (dir === 'down') {
                            if (detail.related.length > 0) { setFocus('related-card-0-0'); return false }
                            return false
                          }
                          return false
                        }}
                      >
                        « Back
                      </ActionButton>
                    </>
                  ) : (
                    <ActionButton
                      focusKey="moviedetail-back"
                      onPress={handleBack}
                      scrollToTop={scrollToTop}
                      onUp={handleUpToNav}
                      onArrow={(dir) => {
                        if (dir === 'left') { setFocus('moviedetail-play'); return false }
                        if (dir === 'down') {
                          if (detail.related.length > 0) { setFocus('related-card-0-0'); return false }
                          return false
                        }
                        return false
                      }}
                    >
                      « Back
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
                      <div key={i} style={{ flex: 1, aspectRatio: '2/3' }} />
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
