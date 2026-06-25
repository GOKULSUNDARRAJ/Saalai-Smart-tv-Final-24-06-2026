import { useState, useRef, useCallback, useEffect } from 'react'
import { useFocusable, FocusContext } from '@noriginmedia/norigin-spatial-navigation'
import { fetchMovieDashboard, fetchCategoryMovies } from '../api/moviesApi'
import type { MovieCategory, MovieItem } from '../api/moviesApi'
import { useAppStore } from '../store/appStore'

const COLS = 5
const COLS_CONTINUE = 3
const PAGE_COUNT = 20

function parseMinutesLeft(text: string): number {
  let mins = 0
  const h = text.match(/(\d+)h/)
  const m = text.match(/(\d+)m/)
  if (h) mins += parseInt(h[1]) * 60
  if (m) mins += parseInt(m[1])
  return mins
}

function getContinueProgress(item: MovieItem): number {
  const played = parseInt(item.playedDuration ?? '0') || 0
  if (played === 0) return 0
  const remaining = parseMinutesLeft(item.channelDuration ?? '')
  const total = played + remaining
  if (total === 0) return 0
  return Math.min(played / total, 1)
}

interface MoviesCache {
  categories: MovieCategory[]
  movies: MovieItem[]
  selectedGenre: number
  selectedCatId: number
  page: number
  hasMore: boolean
  scrollTop: number
  lastFocusKey: string
  dashboardItems: Record<number, MovieItem[]>
  lastClickedMovieId: number | null
}

let _cache: MoviesCache | null = null
let _navigatingToDetail = false

type FocusLevel = 'pill' | 'card' | 'other'
let _focusLevel: FocusLevel = 'other'
let _currentGenreIdx = 0
let _setFocusFn: ((key: string) => void) | null = null
let _resetToAllFn: (() => void) | null = null

export function tryMoviesBack(): boolean {
  if (_focusLevel === 'card') {
    _focusLevel = 'pill'
    _setFocusFn?.(`movies-cat-${_currentGenreIdx}`)
    return true
  }
  if (_focusLevel === 'pill' && _currentGenreIdx > 0) {
    _currentGenreIdx = 0
    _focusLevel = 'pill'
    _resetToAllFn?.()
    _setFocusFn?.('movies-cat-0')
    return true
  }
  if (_focusLevel === 'pill' && _currentGenreIdx === 0) {
    _focusLevel = 'other'
    _setFocusFn?.('nav-movies')
    return true
  }
  return false
}

export function notifyMoviesFocusLevel(level: FocusLevel, genreIdx: number) {
  _focusLevel = level
  _currentGenreIdx = genreIdx
}

function GenrePill({
  label, index, total, isSelected, onSelect, onUp, onDown, onFocused,
}: {
  label: string; index: number; total: number; isSelected: boolean
  onSelect: () => void; onUp: () => void; onDown: () => void; onFocused: () => void
}) {
  const pillRef = useRef<HTMLButtonElement>(null)
  const { ref, focused, setFocus } = useFocusable({
    focusKey: `movies-cat-${index}`,
    onEnterPress: onSelect,
    onFocus: () => { pillRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' }); onFocused() },
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
  item, focusKey, onArrow, onSelect, onFocused, style
}: {
  item: MovieItem; focusKey: string; onArrow: (dir: string) => boolean; onSelect: () => void; onFocused: (rect?: DOMRect) => void;
  style?: React.CSSProperties
}) {
  const [imgError, setImgError] = useState(false)
  const domRef = useRef<HTMLDivElement | null>(null)
  const { ref, focused } = useFocusable({
    focusKey,
    onEnterPress: onSelect,
    onArrowPress: onArrow,
    onFocus: () => {
      if (domRef.current) onFocused(domRef.current.getBoundingClientRect())
      else onFocused()
    },
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
    const safeTop = pRect.top + 64
    if (eRect.top < safeTop) {
      parent.scrollTop -= safeTop - eRect.top + 8
    } else if (eRect.bottom > safeBottom) {
      parent.scrollTop += eRect.bottom - safeBottom + 16
    }
  }, [focused])

  const isLegacy = (window as any).isLegacyTv

  const innerContent = (
    <div style={{ width: '100%', height: '100%', borderRadius: 12, overflow: 'hidden', background: '#1a1a1a', position: 'relative' }}>
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
    </div>
  )

  if (isLegacy) {
    return (
      <div style={{ flex: 1, position: 'relative', ...style }}>
        <div style={{ paddingBottom: '150%' }} />
        
        {/* Outer Focus Ring wrapper for legacy TV to give gap */}
        <div style={{
          position: 'absolute', top: -5, left: -5, right: -5, bottom: -5,
          borderRadius: 16,
          border: focused ? '3px solid #e50914' : '3px solid transparent',
          pointerEvents: 'none', zIndex: 10,
          transition: 'border-color 0.12s',
        }} />

        {/* Card Content */}
        <div
          ref={mergedRef}
          onClick={onSelect}
          style={{
            position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
            borderRadius: 12, overflow: 'hidden',
            background: '#1a1a1a', cursor: 'pointer',
          }}
        >
          {innerContent}
        </div>
      </div>
    )
  }

  // Modern TV rendering
  return (
    <div
      ref={mergedRef}
      onClick={onSelect}
      style={{
        flex: 1,
        aspectRatio: '2/3',
        borderRadius: 12,
        outline: focused ? '3px solid #e50914' : '3px solid transparent',
        outlineOffset: 3,
        transform: focused ? 'scale(1.06)' : 'scale(1)',
        transition: 'transform 0.15s, outline-color 0.12s',
        zIndex: focused ? 10 : 1,
        cursor: 'pointer',
        position: 'relative',
        ...style
      }}
    >
      {innerContent}
    </div>
  )
}

function ContinueCard({
  item, focusKey, onArrow, onSelect, onFocused, style
}: {
  item: MovieItem; focusKey: string; onArrow: (dir: string) => boolean; onSelect: () => void; onFocused: (rect?: DOMRect) => void;
  style?: React.CSSProperties
}) {
  const [imgError, setImgError] = useState(false)
  const domRef = useRef<HTMLDivElement | null>(null)
  const { ref, focused } = useFocusable({
    focusKey,
    onEnterPress: onSelect,
    onArrowPress: onArrow,
    onFocus: () => {
      if (domRef.current) onFocused(domRef.current.getBoundingClientRect())
      else onFocused()
    },
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
    const safeTop = pRect.top + 64
    if (eRect.top < safeTop) {
      parent.scrollTop -= safeTop - eRect.top + 8
    } else if (eRect.bottom > safeBottom) {
      parent.scrollTop += eRect.bottom - safeBottom + 16
    }
  }, [focused])

  const progress = getContinueProgress(item)
  const timeLeft = item.channelDuration?.replace(' left', '') ?? ''

  const isLegacy = (window as any).isLegacyTv

  const innerContent = (
    <div style={{ width: '100%', height: '100%', borderRadius: 12, overflow: 'hidden', background: '#1a1a1a', position: 'relative' }}>
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
        }} />
      )}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        background: 'linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.5) 60%, transparent 100%)',
        padding: '24px 10px 0px',
      }}>
        <p style={{ color: '#fff', fontSize: 12, fontWeight: 700, margin: '0 0 2px', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
          {item.name}
        </p>
        {timeLeft && (
          <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 10, margin: '0 0 6px' }}>
            {timeLeft} remaining
          </p>
        )}
        <div style={{ height: 3, background: 'rgba(255,255,255,0.2)', borderRadius: 2, marginBottom: 0 }}>
          <div style={{
            height: '100%',
            width: `${Math.round(progress * 100)}%`,
            background: '#2196F3',
            borderRadius: 2,
            transition: 'width 0.3s',
          }} />
        </div>
      </div>
    </div>
  )

  if (isLegacy) {
    return (
      <div style={{ flex: 1, position: 'relative', ...style }}>
        <div style={{ paddingBottom: '56.25%' }} />
        
        {/* Outer Focus Ring wrapper for legacy TV to give gap */}
        <div style={{
          position: 'absolute', top: -5, left: -5, right: -5, bottom: -5,
          borderRadius: 16,
          border: focused ? '3px solid #e50914' : '3px solid transparent',
          pointerEvents: 'none', zIndex: 10,
          transition: 'border-color 0.12s',
        }} />

        {/* Card Content */}
        <div
          ref={mergedRef}
          onClick={onSelect}
          style={{
            position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
            borderRadius: 12, overflow: 'hidden',
            background: '#1a1a1a', cursor: 'pointer',
          }}
        >
          {innerContent}
        </div>
      </div>
    )
  }

  // Modern TV rendering
  return (
    <div
      ref={mergedRef}
      onClick={onSelect}
      style={{
        flex: 1,
        aspectRatio: '16/9',
        borderRadius: 12,
        outline: focused ? '3px solid #e50914' : '3px solid transparent',
        outlineOffset: 3,
        transform: focused ? 'scale(1.04)' : 'scale(1)',
        transition: 'transform 0.15s, outline-color 0.12s',
        zIndex: focused ? 10 : 1,
        cursor: 'pointer',
        position: 'relative',
        ...style
      }}
    >
      {innerContent}
    </div>
  )
}

function ViewMoreCard({
  rowIdx, colIdx, isContinue, onArrow, onSelect, onFocused,
}: {
  rowIdx: number; colIdx: number; isContinue: boolean; onArrow: (dir: string) => boolean; onSelect: () => void; onFocused: (rect?: DOMRect) => void
}) {
  const domRef = useRef<HTMLDivElement | null>(null)
  const { ref, focused } = useFocusable({
    focusKey: `movie-dash-${rowIdx}-${colIdx}`,
    onEnterPress: onSelect,
    onArrowPress: onArrow,
    onFocus: () => {
      if (domRef.current) onFocused(domRef.current.getBoundingClientRect())
      else onFocused()
    },
  })
  const mergedRef = useCallback((el: HTMLDivElement | null) => {
    domRef.current = el
    const r = ref as unknown
    if (typeof r === 'function') (r as (e: HTMLDivElement | null) => void)(el)
    else if (r && typeof r === 'object') (r as { current: HTMLDivElement | null }).current = el
  }, [ref])

  return (
    <div
      ref={mergedRef}
      onClick={onSelect}
      style={{
        flexShrink: 0,
        width: isContinue ? 240 : 160,
        position: 'relative',
        cursor: 'pointer', outline: 'none',
      }}
    >
      <div style={{ paddingBottom: isContinue ? '56.25%' : '150%' }} />
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        borderRadius: 12,
        overflow: 'hidden',
        border: `2px solid ${focused ? '#e50914' : 'rgba(255,255,255,0.18)'}`,
        background: focused ? 'rgba(229,9,20,0.15)' : 'rgba(255,255,255,0.05)',
        color: focused ? '#fff' : 'rgba(255,255,255,0.55)',
        transform: focused ? 'scale(1.06)' : 'scale(1)',
        transition: 'all 0.15s',
        zIndex: focused ? 10 : 1,
      }}>
        <div style={{
          position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
        }}>
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" style={{ marginBottom: 10 }}>
            <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase' }}>View More</span>
        </div>
      </div>
    </div>
  )
}

function MovieDashboardRow({
  category, items, rowIdx, totalRows, onSelect, onFocused, onViewMore
}: {
  category: MovieCategory; items: MovieItem[]; rowIdx: number; totalRows: number; onSelect: (id: number, focusKey: string) => void; onFocused: () => void; onViewMore: () => void
}) {
  const isContinue = category.name.toLowerCase().includes('continue')
  const horizontalScrollRef = useRef<HTMLDivElement>(null)

  const { ref: rowRef, focusKey: rowFocusKey, focused, hasFocusedChild, setFocus } = useFocusable({
    focusKey: `movie-dash-row-${rowIdx}`,
    trackChildren: true,
  })

  const isRowFocused = focused || hasFocusedChild

  const handleFocus = useCallback((item: MovieItem | null, colIdx: number, eRect?: DOMRect) => {
    onFocused()
    const container = horizontalScrollRef.current
    if (!container || !eRect) return
    const containerRect = container.getBoundingClientRect()
    const absoluteLeft = eRect.left - containerRect.left + container.scrollLeft
    const absoluteRight = absoluteLeft + eRect.width
    const leftPadding = 960 * 0.05
    const rightPadding = 960 * 0.05
    if (eRect.right > containerRect.right) {
      container.scrollTo({ left: Math.max(0, absoluteRight - containerRect.width + rightPadding), behavior: 'smooth' })
    } else if (eRect.left < containerRect.left) {
      container.scrollTo({ left: Math.max(0, absoluteLeft - leftPadding), behavior: 'smooth' })
    }
  }, [onFocused])

  return (
    <FocusContext.Provider value={rowFocusKey}>
      <div 
        ref={rowRef}
        style={{ marginBottom: 24 }}
      >
        <h2 style={{ 
          fontSize: isRowFocused ? 24 : 15, 
          fontWeight: isRowFocused ? 800 : 600, 
          letterSpacing: 0.3,
          color: isRowFocused ? '#fff' : 'rgba(255,255,255,0.45)', 
          marginBottom: 10, 
          paddingLeft: '5vw',
          transition: 'all 0.2s ease-in-out',
        }}>
          {category.name}
        </h2>
        <div
        ref={horizontalScrollRef}
        className="scrollbar-hide"
        style={{ display: 'flex', overflowX: 'auto', paddingLeft: '5vw', paddingRight: '5vw', paddingTop: 16, paddingBottom: 16 }}
      >
        {items.map((item, colIdx) => {
          const fk = `movie-dash-${rowIdx}-${colIdx}`
          const onArrow = (dir: string) => {
            if (dir === 'up') {
              if (rowIdx === 0) { setFocus('movies-cat-0'); return false }
              setFocus(`movie-dash-${rowIdx - 1}-0`); return false
            }
            if (dir === 'down') {
              if (rowIdx < totalRows - 1) { setFocus(`movie-dash-${rowIdx + 1}-0`); return false }
              return false
            }
            if (dir === 'left') {
              if (colIdx > 0) { setFocus(`movie-dash-${rowIdx}-${colIdx - 1}`); return false }
              return false
            }
            if (dir === 'right') {
              setFocus(`movie-dash-${rowIdx}-${colIdx + 1}`); return false
            }
            return true
          }

          const props = {
            item, focusKey: fk, onSelect: () => onSelect(item.id, fk), onArrow,
            onFocused: (rect?: DOMRect) => handleFocus(item, colIdx, rect)
          }

          return (
            <div key={item.id} style={{ marginRight: 16, flexShrink: 0, width: isContinue ? 240 : 160 }}>
              {isContinue ? <ContinueCard {...props} /> : <MovieCard {...props} />}
            </div>
          )
        })}
        <div key="view-more" style={{ marginRight: '5vw' }}>
          <ViewMoreCard
            rowIdx={rowIdx}
            colIdx={items.length}
            isContinue={isContinue}
            onArrow={(dir) => {
              if (dir === 'up') {
                if (rowIdx === 0) { setFocus('movies-cat-0'); return false }
                setFocus(`movie-dash-${rowIdx - 1}-0`); return false
              }
              if (dir === 'down') {
                if (rowIdx < totalRows - 1) { setFocus(`movie-dash-${rowIdx + 1}-0`); return false }
                return false
              }
              if (dir === 'left') {
                if (items.length > 0) { setFocus(`movie-dash-${rowIdx}-${items.length - 1}`); return false }
                return false
              }
              if (dir === 'right') return false
              return true
            }}
            onSelect={onViewMore}
            onFocused={(rect) => handleFocus(null, items.length, rect)}
          />
        </div>
      </div>
    </div>
    </FocusContext.Provider>
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
  const lastClickedMovieIdRef = useRef<number | null>(initialCache?.lastClickedMovieId ?? null)
  const stateRef = useRef({ categories, movies, selectedGenre, selectedCatId, hasMore })
  const dashboardItemsRef = useRef<Record<number, MovieItem[]>>(initialCache?.dashboardItems ?? {})

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
      dashboardItems: dashboardItemsRef.current,
      lastClickedMovieId: lastClickedMovieIdRef.current,
    }
  }, [])

  const loadMovies = useCallback(async (catId: number, reset: boolean, passedCatName?: string) => {
    if (catId === -1) {
      if (reset) {
        setLoadingMovies(false)
        setMovies([])
        setHasMore(false)
        pageRef.current = 0
      }
      return
    }
    const preloaded = dashboardItemsRef.current[catId]
    const catName = passedCatName ?? stateRef.current.categories.find(c => c.id === catId)?.name ?? ''
    const isContinue = catName.toLowerCase().includes('continue')
    if (reset && preloaded && preloaded.length > 0 && isContinue) {
      setLoadingMovies(true)
      setMovies([])
      setHasMore(false)
      pageRef.current = 0
      setMovies(preloaded)
      setLoadingMovies(false)
      return
    }
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
      
      fetchMovieDashboard().then((data) => {
        dashboardItemsRef.current = data.channelsByCategory
        const allCat = { id: -1, name: 'All' }
        const fullCats = [allCat, ...data.categories]
        setCategories(fullCats)
        const s = stateRef.current
        const currentCat = fullCats[s.selectedGenre]
        
        if (currentCat?.name.toLowerCase().includes('continue')) {
          const fresh = data.channelsByCategory[s.selectedCatId] ?? []
          setMovies(fresh)
        }
      })
      return
    }
    fetchMovieDashboard().then((data) => {
      dashboardItemsRef.current = data.channelsByCategory
      const allCat = { id: -1, name: 'All' }
      const fullCats = [allCat, ...data.categories]
      setCategories(fullCats)
      setLoadingCats(false)
      if (fullCats.length > 0) {
        const firstCat = fullCats[0]
        setSelectedCatId(firstCat.id)
        loadMovies(firstCat.id, true, firstCat.name)
      }
      setTimeout(() => setFocus('movies-cat-0'), 100)
    })
  }, [setFocus, loadMovies, initialCache])

  const handleSelectCategory = useCallback((i: number, catId: number, catName: string) => {
    setSelectedGenre(i)
    setSelectedCatId(catId)
    pageRef.current = 0
    if (scrollRef.current) scrollRef.current.scrollTop = 0
    loadMovies(catId, true, catName)
    setTimeout(() => {
      if (catId === -1) {
        setFocus('movie-dash-0-0')
      } else {
        setFocus('movie-card-0-0')
      }
    }, 500)
  }, [loadMovies, setFocus])

  useEffect(() => {
    if (categories.length > 0) {
      const defaultCat = categories[0]
      _resetToAllFn = () => {
        setSelectedGenre(0)
        setSelectedCatId(defaultCat.id)
        pageRef.current = 0
        if (scrollRef.current) scrollRef.current.scrollTop = 0
        loadMovies(defaultCat.id, true, defaultCat.name)
      }
    } else {
      _resetToAllFn = null
    }
    return () => { _resetToAllFn = null }
  }, [categories, loadMovies])

  useEffect(() => {
    _setFocusFn = setFocus
    return () => { _setFocusFn = null }
  }, [setFocus])

  useEffect(() => {
    return () => {
      if (!_navigatingToDetail) {
        _cache = null
      }
      _navigatingToDetail = false
    }
  }, [])

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

  const selectedName = categories[selectedGenre]?.name ?? ''
  const isContinueCat = selectedName.toLowerCase().includes('continue')
  const activeCols = isContinueCat ? COLS_CONTINUE : COLS
  const rows = Math.ceil(movies.length / activeCols)
  
  const isAll = selectedCatId === -1
  const dashboardRows = isAll ? categories.filter(c => c.id !== -1 && dashboardItemsRef.current[c.id]?.length > 0) : []

  const handleViewMore = useCallback((catId: number, catIdx: number) => {
    setSelectedGenre(catIdx)
    setSelectedCatId(catId)
    loadMovies(catId, true, categories[catIdx]?.name)
    setTimeout(() => {
      setFocus('movie-card-0-0')
      if (scrollRef.current) scrollRef.current.scrollTop = 0
    }, 150)
  }, [loadMovies, setFocus, categories])

  const cardArrow = useCallback((row: number, col: number, cols: number) => (dir: string): boolean => {
    if (dir === 'up') {
      if (row === 0) { setFocus(`movies-cat-${Math.min(selectedGenre, categories.length - 1)}`); return false }
      setFocus(`movie-card-${row - 1}-${col}`); return false
    }
    if (dir === 'down') {
      const totalRows = Math.ceil(movies.length / cols)
      if (row + 1 < totalRows) {
        const nextRowLen = movies.slice((row + 1) * cols, (row + 2) * cols).length
        setFocus(`movie-card-${row + 1}-${Math.min(col, nextRowLen - 1)}`); return false
      }
      return false
    }
    if (dir === 'left') {
      if (col > 0) { setFocus(`movie-card-${row}-${col - 1}`); return false }
      return false
    }
    if (dir === 'right') {
      const rowLen = movies.slice(row * cols, (row + 1) * cols).length
      if (col < rowLen - 1) { setFocus(`movie-card-${row}-${col + 1}`); return false }
      return false
    }
    return true
  }, [movies, setFocus, categories.length])

  return (
    <FocusContext.Provider value={focusKey}>
      <div ref={ref} style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{
          background: 'transparent',
          paddingLeft: '5vw', paddingRight: '5vw',
          paddingTop: 'clamp(14px, 2.5vh, 28px)', paddingBottom: 'clamp(8px, 1.5vh, 12px)',
          flexShrink: 0,
        }}>
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
                onSelect={() => handleSelectCategory(i, cat.id, cat.name)}
                onUp={() => setFocus('nav-movies')}
                onDown={() => {
                  if (isAll && dashboardRows.length > 0) setFocus('movie-dash-0-0')
                  else if (!isAll && movies.length > 0) setFocus('movie-card-0-0')
                }}
                onFocused={() => notifyMoviesFocusLevel('pill', i)}
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
            <div style={{ paddingLeft: isAll ? 0 : '5vw', paddingRight: isAll ? 0 : '5vw', paddingTop: 16, paddingBottom: 120 }}>
              {loadingMovies ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '30vh', color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>
                  Loading…
                </div>
              ) : (isAll && dashboardRows.length === 0) || (!isAll && movies.length === 0) ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '30vh', color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>
                  No movies available
                </div>
              ) : (
                <>
                  {isAll ? (
                    dashboardRows.map((cat, rowIdx) => (
                      <MovieDashboardRow
                        key={cat.id}
                        category={cat}
                        items={dashboardItemsRef.current[cat.id] ?? []}
                        rowIdx={rowIdx}
                        totalRows={dashboardRows.length}
                        onSelect={(id, fk) => {
                          lastFocusKeyRef.current = fk
                          lastClickedMovieIdRef.current = id
                          _navigatingToDetail = true
                          saveCache()
                          navigateToMovieDetail(id)
                        }}
                        onFocused={() => notifyMoviesFocusLevel('card', selectedGenre)}
                        onViewMore={() => {
                          const actualCatIdx = categories.findIndex(c => c.id === cat.id)
                          if (actualCatIdx !== -1) {
                            handleViewMore(cat.id, actualCatIdx)
                          }
                        }}
                      />
                    ))
                  ) : (
                    Array.from({ length: rows }).map((_, rowIdx) => {
                      const rowItems = movies.slice(rowIdx * activeCols, (rowIdx + 1) * activeCols)
                      return (
                        <div key={rowIdx} style={{ display: 'flex', marginBottom: 16 }}>
                          {rowItems.map((item, colIdx) => {
                            const fk = `movie-card-${rowIdx}-${colIdx}`
                            return isContinueCat ? (
                              <ContinueCard
                                key={item.id}
                                item={item}
                                focusKey={fk}
                                onArrow={cardArrow(rowIdx, colIdx, activeCols)}
                                onSelect={() => {
                                  lastFocusKeyRef.current = fk
                                  lastClickedMovieIdRef.current = item.id
                                  _navigatingToDetail = true
                                  saveCache()
                                  navigateToMovieDetail(item.id)
                                }}
                                onFocused={() => notifyMoviesFocusLevel('card', selectedGenre)}
                                style={{ marginRight: colIdx < activeCols - 1 ? 16 : 0 }}
                              />
                            ) : (
                              <MovieCard
                                key={item.id}
                                item={item}
                                focusKey={fk}
                                onArrow={cardArrow(rowIdx, colIdx, activeCols)}
                                onSelect={() => {
                                  lastFocusKeyRef.current = fk
                                  lastClickedMovieIdRef.current = item.id
                                  _navigatingToDetail = true
                                  saveCache()
                                  navigateToMovieDetail(item.id)
                                }}
                                onFocused={() => notifyMoviesFocusLevel('card', selectedGenre)}
                                style={{ marginRight: colIdx < activeCols - 1 ? 16 : 0 }}
                              />
                            )
                          })}
                          {rowItems.length < activeCols && Array.from({ length: activeCols - rowItems.length }).map((_, i) => (
                            <div key={`spacer-${i}`} style={{ flex: 1, aspectRatio: isContinueCat ? '16/9' : '2/3' }} />
                          ))}
                        </div>
                      )
                    })
                  )}
                  {loadingMore && !isAll && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 60, color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>
                      Loading more…
                    </div>
                  )}
                  {!loadingMore && !isAll && movies.length > 0 && (
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
