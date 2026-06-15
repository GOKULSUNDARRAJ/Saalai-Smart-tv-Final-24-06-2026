import { useState, useRef, useCallback, useEffect } from 'react'
import { useFocusable, FocusContext } from '@noriginmedia/norigin-spatial-navigation'
import { fetchMovieDashboard, fetchCategoryMovies } from '../api/moviesApi'
import type { MovieCategory, MovieItem } from '../api/moviesApi'
import { useAppStore } from '../store/appStore'

const COLS = 5
const PAGE_COUNT = 20

interface MoviesCache {
  categories: MovieCategory[]
  movies: MovieItem[]
  selectedGenre: number
  selectedCatId: number
  page: number
  hasMore: boolean
  scrollTop: number
  lastFocusKey: string
}

let _cache: MoviesCache | null = null

function GenrePill({
  label, index, total, isSelected, onSelect, onUp, onDown,
}: {
  label: string; index: number; total: number; isSelected: boolean
  onSelect: () => void; onUp: () => void; onDown: () => void
}) {
  const pillRef = useRef<HTMLButtonElement>(null)
  const { ref, focused, setFocus } = useFocusable({
    focusKey: `movies-cat-${index}`,
    onEnterPress: onSelect,
    onFocus: () => pillRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' }),
    onArrowPress: (dir) => {
      if (dir === 'up') { onUp(); return false }
      if (dir === 'down') { onDown(); return false }
      if (dir === 'left') { if (index > 0) setFocus(`movies-cat-${index - 1}`); return false }
      if (dir === 'right') { if (index < total - 1) setFocus(`movies-cat-${index + 1}`); return false }
      return false
    },
  })
  const setRef = useCallback((el: HTMLButtonElement | null) => {
    (ref as React.MutableRefObject<HTMLButtonElement | null>).current = el;
    (pillRef as React.MutableRefObject<HTMLButtonElement | null>).current = el
  }, [ref])

  return (
    <button
      ref={setRef}
      onClick={onSelect}
      style={{
        padding: '6px 20px', borderRadius: 999, fontSize: '1rem', fontWeight: 600,
        whiteSpace: 'nowrap', flexShrink: 0, border: 'none', cursor: 'pointer', outline: 'none',
        marginRight: 12,
        backgroundColor: focused ? '#e50914' : isSelected ? 'rgba(229,9,20,0.35)' : 'rgba(255,255,255,0.10)',
        color: focused || isSelected ? '#fff' : 'rgba(255,255,255,0.55)',
        transform: focused ? 'scale(1.1)' : 'scale(1)',
        transition: 'transform 0.15s, background-color 0.15s',
      }}
    >
      {label}
    </button>
  )
}

function MovieCard({
  item, focusKey, onArrow, onSelect,
}: {
  item: MovieItem; focusKey: string; onArrow: (dir: string) => boolean; onSelect: () => void
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
    if (eRect.top < pRect.top) {
      parent.scrollTop -= pRect.top - eRect.top + 16
    } else if (eRect.bottom > pRect.bottom) {
      parent.scrollTop += eRect.bottom - pRect.bottom + 16
    }
  }, [focused])

  return (
    <div
      ref={mergedRef}
      onClick={onSelect}
      style={{
        flex: 1,
        aspectRatio: '2/3',
        borderRadius: 12,
        overflow: 'hidden',
        position: 'relative',
        outline: focused ? '3px solid #e50914' : '3px solid transparent',
        outlineOffset: 3,
        transform: focused ? 'scale(1.06)' : 'scale(1)',
        transition: 'transform 0.15s, outline-color 0.12s',
        zIndex: focused ? 10 : 1,
        background: '#1a1a1a',
        cursor: 'pointer',
      }}
    >
      {!imgError ? (
        <img
          src={item.logo}
          alt={item.name}
          onError={() => setImgError(true)}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      ) : (
        <div style={{
          width: '100%', height: '100%',
          background: 'linear-gradient(135deg, #1a1a2e, #16213e)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 8,
        }}>
          <span style={{ color: '#fff', fontSize: 11, fontWeight: 600, textAlign: 'center', lineHeight: 1.4 }}>
            {item.name}
          </span>
        </div>
      )}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        background: 'linear-gradient(to top, rgba(0,0,0,0.9) 0%, transparent 100%)',
        padding: '18px 6px 6px',
        opacity: focused ? 1 : 0.8,
        transition: 'opacity 0.15s',
      }}>
        <p style={{ color: '#fff', fontSize: 10, fontWeight: 600, textAlign: 'center', margin: 0, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
          {item.name}
        </p>
      </div>
    </div>
  )
}

export function MoviesScreen() {
  const initialCache = useRef(_cache).current
  const [categories, setCategories] = useState<MovieCategory[]>(initialCache?.categories ?? [])
  const [movies, setMovies] = useState<MovieItem[]>(initialCache?.movies ?? [])
  const [selectedGenre, setSelectedGenre] = useState(initialCache?.selectedGenre ?? 0)
  const [selectedCatId, setSelectedCatId] = useState(initialCache?.selectedCatId ?? 0)
  const [loadingCats, setLoadingCats] = useState(!initialCache)
  const [loadingMovies, setLoadingMovies] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(initialCache?.hasMore ?? true)
  const pageRef = useRef(initialCache?.page ?? 1)
  const scrollRef = useRef<HTMLDivElement>(null)
  const lastFocusKeyRef = useRef(initialCache?.lastFocusKey ?? 'movies-cat-0')
  const stateRef = useRef({ categories, movies, selectedGenre, selectedCatId, hasMore })

  const { navigateToMovieDetail } = useAppStore()
  const { ref, focusKey, setFocus } = useFocusable({ focusKey: 'movies-screen', trackChildren: true })

  useEffect(() => {
    stateRef.current = { categories, movies, selectedGenre, selectedCatId, hasMore }
  }, [categories, movies, selectedGenre, selectedCatId, hasMore])

  const saveCache = useCallback(() => {
    const s = stateRef.current
    _cache = {
      categories: s.categories,
      movies: s.movies,
      selectedGenre: s.selectedGenre,
      selectedCatId: s.selectedCatId,
      page: pageRef.current,
      hasMore: s.hasMore,
      scrollTop: scrollRef.current?.scrollTop ?? 0,
      lastFocusKey: lastFocusKeyRef.current,
    }
  }, [])

  const loadMovies = useCallback(async (catId: number, reset: boolean) => {
    const page = reset ? 0 : pageRef.current
    if (reset) {
      setLoadingMovies(true)
      setMovies([])
      setHasMore(true)
      pageRef.current = 0
    } else {
      setLoadingMore(true)
    }
    const items = await fetchCategoryMovies(catId, page, PAGE_COUNT)
    if (reset) {
      setMovies(items)
      setLoadingMovies(false)
    } else {
      setMovies((prev) => [...prev, ...items])
      setLoadingMore(false)
    }
    pageRef.current = page + 1
    if (items.length < PAGE_COUNT) setHasMore(false)
  }, [])

  useEffect(() => {
    if (initialCache) {
      setTimeout(() => {
        setFocus(initialCache.lastFocusKey)
        if (scrollRef.current) scrollRef.current.scrollTop = initialCache.scrollTop
      }, 60)
      return
    }
    fetchMovieDashboard().then((data) => {
      setCategories(data.categories)
      setLoadingCats(false)
      if (data.categories.length > 0) {
        const firstCatId = data.categories[0].id
        setSelectedCatId(firstCatId)
        loadMovies(firstCatId, true)
      }
      setTimeout(() => setFocus('movies-cat-0'), 100)
    })
  }, [setFocus, loadMovies, initialCache])

  const handleSelectCategory = useCallback((i: number, catId: number) => {
    setSelectedGenre(i)
    setSelectedCatId(catId)
    pageRef.current = 0
    if (scrollRef.current) scrollRef.current.scrollTop = 0
    loadMovies(catId, true)
  }, [loadMovies])

  const handleScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el || loadingMore || !hasMore) return
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 300
    if (nearBottom) {
      loadMovies(selectedCatId, false)
    }
  }, [loadingMore, hasMore, selectedCatId, loadMovies])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.addEventListener('scroll', handleScroll)
    return () => el.removeEventListener('scroll', handleScroll)
  }, [handleScroll])

  const rows = Math.ceil(movies.length / COLS)

  const cardArrow = useCallback((row: number, col: number) => (dir: string): boolean => {
    if (dir === 'up') {
      if (row === 0) { setFocus(`movies-cat-${Math.min(0, categories.length - 1)}`); return false }
      setFocus(`movie-card-${row - 1}-${col}`); return false
    }
    if (dir === 'down') {
      if (row + 1 < rows) {
        const nextRowLen = movies.slice((row + 1) * COLS, (row + 2) * COLS).length
        setFocus(`movie-card-${row + 1}-${Math.min(col, nextRowLen - 1)}`); return false
      }
      return false
    }
    if (dir === 'left') {
      if (col > 0) { setFocus(`movie-card-${row}-${col - 1}`); return false }
      return false
    }
    if (dir === 'right') {
      const rowLen = movies.slice(row * COLS, (row + 1) * COLS).length
      if (col < rowLen - 1) { setFocus(`movie-card-${row}-${col + 1}`); return false }
      return false
    }
    return true
  }, [rows, movies, setFocus, categories.length])

  const selectedName = categories[selectedGenre]?.name ?? ''

  return (
    <FocusContext.Provider value={focusKey}>
      <div ref={ref} style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{
          background: 'transparent',
          paddingLeft: '5vw', paddingRight: '5vw',
          paddingTop: 'clamp(14px, 2.5vh, 28px)', paddingBottom: 'clamp(8px, 1.5vh, 12px)',
          flexShrink: 0,
        }}>
          <h1 className="text-tv-3xl font-bold text-white leading-tight">🎬 Movies</h1>
          <p className="text-white/50 text-tv-sm mt-1 mb-2">
            {loadingCats ? 'Loading…' : `${selectedName} · ${movies.length} titles`}
          </p>
        </div>

        {!loadingCats && (
          <div className="scrollbar-hide" style={{
            display: 'flex', overflowX: 'auto', flexShrink: 0,
            paddingLeft: '5vw', paddingRight: '5vw',
            paddingTop: '8px', paddingBottom: '8px',
          }}>
            {categories.map((cat, i) => (
              <GenrePill
                key={cat.id}
                label={cat.name}
                index={i}
                total={categories.length}
                isSelected={selectedGenre === i}
                onSelect={() => handleSelectCategory(i, cat.id)}
                onUp={() => setFocus('nav-movies')}
                onDown={() => { if (movies.length > 0) setFocus('movie-card-0-0') }}
              />
            ))}
          </div>
        )}

        {loadingCats && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, color: 'rgba(255,255,255,0.4)', fontSize: 16 }}>
            Loading…
          </div>
        )}

        {!loadingCats && (
          <div
            ref={scrollRef}
            style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}
            className="scrollbar-hide"
          >
            <div style={{ paddingLeft: '5vw', paddingRight: '5vw', paddingTop: 16, paddingBottom: 32 }}>
              {loadingMovies ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '30vh', color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>
                  Loading…
                </div>
              ) : movies.length === 0 ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '30vh', color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>
                  No movies available
                </div>
              ) : (
                <>
                  {Array.from({ length: rows }).map((_, rowIdx) => {
                    const rowItems = movies.slice(rowIdx * COLS, (rowIdx + 1) * COLS)
                    return (
                      <div key={rowIdx} style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
                        {rowItems.map((item, colIdx) => {
                          const fk = `movie-card-${rowIdx}-${colIdx}`
                          return (
                            <MovieCard
                              key={item.id}
                              item={item}
                              focusKey={fk}
                              onArrow={cardArrow(rowIdx, colIdx)}
                              onSelect={() => {
                                lastFocusKeyRef.current = fk
                                saveCache()
                                navigateToMovieDetail(item.id)
                              }}
                            />
                          )
                        })}
                        {rowItems.length < COLS && Array.from({ length: COLS - rowItems.length }).map((_, i) => (
                          <div key={`spacer-${i}`} style={{ flex: 1, aspectRatio: '2/3' }} />
                        ))}
                      </div>
                    )
                  })}
                  {loadingMore && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 60, color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>
                      Loading more…
                    </div>
                  )}
                  {!hasMore && movies.length > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 40, color: 'rgba(255,255,255,0.2)', fontSize: 12 }}>
                      — end —
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </FocusContext.Provider>
  )
}
