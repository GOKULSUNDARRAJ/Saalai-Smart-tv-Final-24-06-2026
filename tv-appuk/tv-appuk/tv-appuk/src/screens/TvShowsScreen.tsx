import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useFocusable, FocusContext } from '@noriginmedia/norigin-spatial-navigation'
import { fetchTvShowDashboard, fetchTvShowList } from '../api/tvShowsApi'
import type { TvShowCategory, TvShowItem } from '../api/tvShowsApi'
import { useAppStore } from '../store/appStore'

interface TvShowsCache {
  categories: TvShowCategory[]
  shows: TvShowItem[]
  selectedGenre: number
  scrollTop: number
  lastFocusKey: string
}

let _cache: TvShowsCache | null = null
let _navigatingToDetail = false

type FocusLevel = 'pill' | 'card' | 'other'
let _focusLevel: FocusLevel = 'other'
let _currentGenreIdx = 0
let _setFocusFn: ((key: string) => void) | null = null
let _resetToAllFn: (() => void) | null = null

export function tryTvShowsBack(): boolean {
  if (_focusLevel === 'card') {
    _focusLevel = 'pill'
    _setFocusFn?.(`tvshow-cat-${_currentGenreIdx}`)
    return true
  }
  if (_focusLevel === 'pill' && _currentGenreIdx > 0) {
    _currentGenreIdx = 0
    _focusLevel = 'pill'
    _resetToAllFn?.()
    _setFocusFn?.('tvshow-cat-0')
    return true
  }
  if (_focusLevel === 'pill' && _currentGenreIdx === 0) {
    _focusLevel = 'other'
    _setFocusFn?.('nav-tvshows')
    return true
  }
  return false
}

export function notifyTvShowsFocusLevel(level: FocusLevel, genreIdx: number) {
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
    focusKey: `tvshow-cat-${index}`,
    onEnterPress: onSelect,
    onFocus: () => { pillRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' }); onFocused() },
    onArrowPress: (dir) => {
      if (dir === 'up') { onUp(); return false }
      if (dir === 'down') { onDown(); return false }
      if (dir === 'left') { if (index > 0) setFocus(`tvshow-cat-${index - 1}`); return false }
      if (dir === 'right') { if (index < total - 1) setFocus(`tvshow-cat-${index + 1}`); return false }
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

function ShowCard({
  item, focusKey, onArrow, onSelect, onFocused,
}: {
  item: TvShowItem; focusKey: string; onArrow: (dir: string) => boolean; onSelect: () => void; onFocused: () => void
}) {
  const [imgError, setImgError] = useState(false)
  const cardRef = useRef<HTMLDivElement | null>(null)
  const { ref, focused } = useFocusable({
    focusKey,
    onEnterPress: onSelect,
    onArrowPress: onArrow,
    onFocus: onFocused,
  })
  const setRef = useCallback((el: HTMLDivElement | null) => {
    cardRef.current = el
    const r = ref as unknown
    if (typeof r === 'function') (r as (e: HTMLDivElement | null) => void)(el)
    else if (r && typeof r === 'object') (r as { current: HTMLDivElement | null }).current = el
  }, [ref])
  useEffect(() => {
    if (!focused || !cardRef.current) return
    let parent = cardRef.current.parentElement
    while (parent) {
      const ov = getComputedStyle(parent).overflowY
      if (ov === 'auto' || ov === 'scroll') break
      parent = parent.parentElement
    }
    if (!parent) return
    const pRect = parent.getBoundingClientRect()
    const eRect = cardRef.current.getBoundingClientRect()
    const safeBottom = pRect.bottom - 64
    const safeTop = pRect.top + 8
    if (eRect.top < safeTop) {
      parent.scrollTop -= safeTop - eRect.top + 8
    } else if (eRect.bottom > safeBottom) {
      parent.scrollTop += eRect.bottom - safeBottom + 16
    }
  }, [focused])

  return (
    <div
      ref={setRef}
      onClick={onSelect}
      style={{
        flex: 1,
        aspectRatio: '16/8',
        borderRadius: 12,
        outline: focused ? '3px solid #e50914' : '3px solid transparent',
        outlineOffset: 3,
        transform: focused ? 'scale(1.06)' : 'scale(1)',
        transition: 'transform 0.15s, outline-color 0.12s',
        zIndex: focused ? 10 : 1,
        cursor: 'pointer',
        position: 'relative',
      }}
    >
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
    </div>
  )
}

export function TvShowsScreen() {
  const initialCache = useRef(_cache).current
  const [categories, setCategories] = useState<TvShowCategory[]>(initialCache?.categories ?? [])
  const [shows, setShows] = useState<TvShowItem[]>(initialCache?.shows ?? [])
  const [selectedGenre, setSelectedGenre] = useState(initialCache?.selectedGenre ?? 0)
  const [loadingCats, setLoadingCats] = useState(!initialCache)
  const [loadingShows, setLoadingShows] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const lastFocusKeyRef = useRef(initialCache?.lastFocusKey ?? 'tvshow-cat-0')
  const stateRef = useRef({ categories, shows, selectedGenre })

  const { navigateToTvShowDetail } = useAppStore()
  const { ref, focusKey, setFocus } = useFocusable({ focusKey: 'tvshows-screen', trackChildren: true })

  useEffect(() => {
    stateRef.current = { categories, shows, selectedGenre }
  }, [categories, shows, selectedGenre])

  const saveCache = useCallback(() => {
    const s = stateRef.current
    _cache = {
      categories: s.categories,
      shows: s.shows,
      selectedGenre: s.selectedGenre,
      scrollTop: scrollRef.current?.scrollTop ?? 0,
      lastFocusKey: lastFocusKeyRef.current,
    }
  }, [])

  const loadShows = useCallback(async (catId: number) => {
    setLoadingShows(true)
    setShows([])
    const items = await fetchTvShowList(catId)
    setShows(items)
    setLoadingShows(false)
  }, [])

  useEffect(() => {
    if (initialCache) {
      setTimeout(() => {
        setFocus(initialCache.lastFocusKey)
        if (scrollRef.current) scrollRef.current.scrollTop = initialCache.scrollTop
      }, 60)
      return
    }
    fetchTvShowDashboard().then((data) => {
      setCategories(data.categories)
      setLoadingCats(false)
      if (data.categories.length > 0) {
        loadShows(data.categories[0].id)
      }
      setTimeout(() => setFocus('tvshow-cat-0'), 100)
    })
  }, [setFocus, loadShows, initialCache])

  useEffect(() => {
    if (categories.length > 0) {
      const defaultCatId = categories[0].id
      _resetToAllFn = () => {
        setSelectedGenre(0)
        if (scrollRef.current) scrollRef.current.scrollTop = 0
        loadShows(defaultCatId)
      }
    } else {
      _resetToAllFn = null
    }
    return () => { _resetToAllFn = null }
  }, [categories, loadShows])

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

  const handleSelectCategory = useCallback((i: number, catId: number) => {
    setSelectedGenre(i)
    if (scrollRef.current) scrollRef.current.scrollTop = 0
    loadShows(catId)
    setTimeout(() => setFocus('tvshow-card-0-0'), 500)
  }, [loadShows, setFocus])

  const COLS = 3
  const selectedName = categories[selectedGenre]?.name ?? ''
  const rows = Math.ceil(shows.length / COLS)

  const cardArrow = useCallback((row: number, col: number) => (dir: string): boolean => {
    if (dir === 'up') {
      if (row === 0) { setFocus(`tvshow-cat-${Math.min(selectedGenre, categories.length - 1)}`); return false }
      setFocus(`tvshow-card-${row - 1}-${col}`); return false
    }
    if (dir === 'down') {
      if (row + 1 < rows) {
        const nextRowLen = shows.slice((row + 1) * COLS, (row + 2) * COLS).length
        setFocus(`tvshow-card-${row + 1}-${Math.min(col, nextRowLen - 1)}`); return false
      }
      return false
    }
    if (dir === 'left') { if (col > 0) { setFocus(`tvshow-card-${row}-${col - 1}`); return false } return false }
    if (dir === 'right') {
      const rowLen = shows.slice(row * COLS, (row + 1) * COLS).length
      if (col < rowLen - 1) { setFocus(`tvshow-card-${row}-${col + 1}`); return false }
      return false
    }
    return true
  }, [rows, shows, setFocus, selectedGenre, categories.length])

  return (
    <FocusContext.Provider value={focusKey}>
      <div ref={ref} style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{
          background: 'transparent',
          paddingLeft: '5vw', paddingRight: '5vw',
          paddingTop: 'clamp(14px, 2.5vh, 28px)', paddingBottom: 'clamp(8px, 1.5vh, 12px)',
          flexShrink: 0,
        }}>
          <h1 className="text-tv-3xl font-bold text-white leading-tight">📺 TV Shows</h1>
          <p className="text-white/50 text-tv-sm mt-1 mb-2">
            {loadingCats ? 'Loading…' : `${selectedName} · ${shows.length} shows`}
          </p>
        </div>

        {!loadingCats && (
          <div style={{
            display: 'flex', overflowX: 'auto', flexShrink: 0,
            paddingLeft: '5vw', paddingRight: '5vw',
            paddingTop: '8px', paddingBottom: '8px',
          }} className="scrollbar-hide">
            {categories.map((cat, i) => (
              <GenrePill
                key={cat.id}
                label={cat.name}
                index={i}
                total={categories.length}
                isSelected={selectedGenre === i}
                onSelect={() => handleSelectCategory(i, cat.id)}
                onUp={() => setFocus('nav-tvshows')}
                onDown={() => { if (shows.length > 0) setFocus('tvshow-card-0-0') }}
                onFocused={() => notifyTvShowsFocusLevel('pill', i)}
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
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', paddingTop: 0, paddingBottom: 32 }}>
            {loadingShows ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>
                Loading…
              </div>
            ) : shows.length === 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>
                No shows available
              </div>
            ) : (
              <div
                ref={scrollRef}
                style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', paddingLeft: '5vw', paddingRight: '5vw', paddingTop: 20, paddingBottom: 80 }}
                className="scrollbar-hide"
              >
                {Array.from({ length: rows }).map((_, rowIdx) => {
                  const rowItems = shows.slice(rowIdx * COLS, (rowIdx + 1) * COLS)
                  return (
                    <div key={rowIdx} style={{ display: 'flex', gap: 16, marginBottom: 16, overflow: 'visible' }}>
                      {rowItems.map((item, colIdx) => {
                        const fk = `tvshow-card-${rowIdx}-${colIdx}`
                        return (
                          <ShowCard
                            key={item.id}
                            item={item}
                            focusKey={fk}
                            onArrow={cardArrow(rowIdx, colIdx)}
                            onSelect={() => {
                              lastFocusKeyRef.current = fk
                              _navigatingToDetail = true
                              saveCache()
                              navigateToTvShowDetail(item.id)
                            }}
                            onFocused={() => notifyTvShowsFocusLevel('card', selectedGenre)}
                          />
                        )
                      })}
                      {rowItems.length < COLS && Array.from({ length: COLS - rowItems.length }).map((_, i) => (
                        <div key={`spacer-${i}`} style={{ flex: 1, aspectRatio: '16/8' }} />
                      ))}
                    </div>
                  )
                })}
                {shows.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 40, color: 'rgba(255,255,255,0.2)', fontSize: 12 }}>
                    — end —
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </FocusContext.Provider>
  )
}
