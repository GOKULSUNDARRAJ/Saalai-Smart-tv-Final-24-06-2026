import { useState, useRef, useCallback, useEffect } from 'react'
import { useFocusable, FocusContext } from '@noriginmedia/norigin-spatial-navigation'
import { searchProgram } from '../api/searchApi'
import type { SearchItem } from '../api/searchApi'
import { useAppStore } from '../store/appStore'
import { playNative, shouldUseNativePlayer } from '../platform/nativeVideoPlayer'

const COLS = 3
const MOVIE_COLS = 4

const KB_ROWS: string[][] = [
  ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
  ['h', 'i', 'j', 'k', 'l', 'm', 'n'],
  ['o', 'p', 'q', 'r', 's', 't', 'u'],
  ['v', 'w', 'x', 'y', 'z'],
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
  ['⌫', 'space', 'clear', 'ok'],
]

let _searchSetFocusFn: ((key: string) => void) | null = null
let _searchFocused = false

export function trySearchBack(): boolean {
  if (_searchSetFocusFn && _searchFocused) {
    _searchFocused = false
    _searchSetFocusFn('nav-search')
    return true
  }
  return false
}

interface SearchSection {
  title: string
  items: SearchItem[]
  type: 'channel' | 'movie' | 'show'
  sectionIdx: number
}

function SearchCard({
  item, focusKey, onEnter, onArrow, onFocused, isMovie,
}: {
  item: SearchItem
  focusKey: string
  onEnter: () => void
  onArrow: (dir: string) => boolean
  onFocused?: () => void
  isMovie?: boolean
}) {
  const [imgError, setImgError] = useState(false)
  const domRef = useRef<HTMLDivElement | null>(null)
  const onEnterRef = useRef(onEnter)
  onEnterRef.current = onEnter

  const { ref, focused } = useFocusable({
    focusKey,
    onEnterPress: () => onEnterRef.current(),
    onArrowPress: onArrow,
    onFocus: onFocused,
  })

  const setRef = useCallback((el: HTMLDivElement | null) => {
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
    if (eRect.top < pRect.top) parent.scrollTop -= pRect.top - eRect.top + 16
    else if (eRect.bottom > pRect.bottom) parent.scrollTop += eRect.bottom - pRect.bottom + 16
  }, [focused])

  return (
    <div
      ref={setRef}
      onClick={() => onEnterRef.current()}
      style={{
        aspectRatio: isMovie ? '2/3' : '16/9',
        borderRadius: 10,
        overflow: 'hidden',
        position: 'relative',
        cursor: 'pointer',
        border: focused ? '3px solid #e50914' : '3px solid transparent',
        outlineOffset: -1,
        transform: focused ? 'scale(1.05)' : 'scale(1)',
        transition: 'transform 0.15s, border-color 0.12s',
        zIndex: focused ? 10 : 1,
        background: '#1a1a2e',
        flexShrink: 0,
        boxShadow: isMovie && focused ? '0 8px 32px rgba(229,9,20,0.35)' : isMovie ? '0 4px 16px rgba(0,0,0,0.5)' : 'none',
        outline: 'none',
      }}
    >
      {!imgError ? (
        <img
          src={item.channelLogo}
          alt={item.channelName}
          onError={() => setImgError(true)}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      ) : (
        <div style={{
          width: '100%', height: '100%',
          background: isMovie
            ? 'linear-gradient(160deg, #1a1a2e 0%, #16213e 60%, #0f3460 100%)'
            : 'linear-gradient(135deg, #1a1a2e, #16213e)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12,
        }}>
          <span style={{ color: '#fff', fontSize: isMovie ? 13 : 12, fontWeight: 600, textAlign: 'center', lineHeight: 1.4 }}>
            {item.channelName}
          </span>
        </div>
      )}
      {isMovie && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0,
          height: 3,
          background: focused ? '#e50914' : 'transparent',
          transition: 'background 0.15s',
        }} />
      )}
    </div>
  )
}

function ResultSection({
  section, sections, setFocus, onSelect, onCardFocused,
}: {
  section: SearchSection
  sections: SearchSection[]
  setFocus: (key: string) => void
  onSelect: (item: SearchItem, type: 'channel' | 'movie' | 'show') => void
  onCardFocused: () => void
}) {
  const { items, sectionIdx, title, type } = section
  if (items.length === 0) return null

  const cols = type === 'movie' ? MOVIE_COLS : COLS

  const getSectionFirstKey = (si: number, col: number) => {
    const s = sections[si]
    if (!s || s.items.length === 0) return null
    return `search-card-${si}-${Math.min(col, s.items.length - 1)}`
  }

  const getSectionLastRowKey = (si: number, col: number) => {
    const s = sections[si]
    if (!s || s.items.length === 0) return null
    const lastIdx = s.items.length - 1
    const c = sections[si].type === 'movie' ? MOVIE_COLS : COLS
    const lastRowStart = Math.floor(lastIdx / c) * c
    return `search-card-${si}-${Math.min(lastRowStart + col, lastIdx)}`
  }

  return (
    <div style={{ marginBottom: 24 }}>
      <h2 style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, fontWeight: 700, letterSpacing: 2, margin: '0 0 10px' }}>
        {title.toUpperCase()}
      </h2>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: type === 'movie' ? 12 : 10, overflow: 'visible', padding: '6px 8px 8px' }}>
        {items.map((item, idx) => {
          const row = Math.floor(idx / cols)
          const col = idx % cols
          const totalRows = Math.ceil(items.length / cols)
          const isFirstRow = row === 0
          const isLastRow = row === totalRows - 1

          return (
            <SearchCard
              key={item.channelId}
              item={item}
              focusKey={`search-card-${sectionIdx}-${idx}`}
              onEnter={() => onSelect(item, type)}
              onFocused={onCardFocused}
              isMovie={type === 'movie'}
              onArrow={(dir) => {
                if (dir === 'up') {
                  if (isFirstRow) {
                    if (sectionIdx === 0) {
                      setFocus('kb-0-0')
                    } else {
                      const key = getSectionLastRowKey(sectionIdx - 1, col)
                      if (key) setFocus(key)
                      else setFocus('kb-0-0')
                    }
                    return false
                  }
                  setFocus(`search-card-${sectionIdx}-${idx - cols}`)
                  return false
                }
                if (dir === 'down') {
                  if (!isLastRow && idx + cols < items.length) {
                    setFocus(`search-card-${sectionIdx}-${idx + cols}`)
                    return false
                  }
                  if (isLastRow) {
                    const nextKey = getSectionFirstKey(sectionIdx + 1, col)
                    if (nextKey) setFocus(nextKey)
                  }
                  return false
                }
                if (dir === 'left') {
                  if (col === 0) return false
                  setFocus(`search-card-${sectionIdx}-${idx - 1}`)
                  return false
                }
                if (dir === 'right') {
                  if (col < cols - 1 && idx + 1 < items.length) {
                    setFocus(`search-card-${sectionIdx}-${idx + 1}`)
                    return false
                  }
                  setFocus('kb-0-0')
                  return false
                }
                return false
              }}
            />
          )
        })}
      </div>
    </div>
  )
}

function KbKey({ label, focusKey, onPress, onArrow }: {
  label: string
  focusKey: string
  onPress: () => void
  onArrow: (dir: string) => boolean
}) {
  const { ref, focused } = useFocusable({ focusKey, onEnterPress: onPress, onArrowPress: onArrow })

  const isSpace = label === 'space'
  const isClear = label === 'clear'
  const isBackspace = label === '⌫'
  const isOk = label === 'ok'
  const isSpecial = isSpace || isClear || isBackspace || isOk

  const displayLabel = isSpace ? 'SPACE' : isClear ? 'CLEAR' : isOk ? 'OK' : label.toUpperCase()

  return (
    <div
      ref={ref as React.RefObject<HTMLDivElement>}
      onClick={onPress}
      style={{
        flex: isSpace ? 3 : isClear ? 2 : isOk ? 2 : 1,
        minWidth: isSpace ? 64 : isClear ? 52 : isOk ? 52 : 0,
        height: 46,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        borderRadius: 8,
        background: focused
          ? (isOk ? '#2ecc40' : '#e50914')
          : isOk
            ? 'rgba(46,204,64,0.25)'
            : isSpecial
              ? 'rgba(255,255,255,0.1)'
              : 'rgba(255,255,255,0.07)',
        border: focused ? 'none' : isOk ? '1px solid rgba(46,204,64,0.4)' : '1px solid rgba(255,255,255,0.1)',
        color: '#fff',
        fontSize: isSpecial ? 11 : 15,
        fontWeight: 700,
        cursor: 'pointer',
        transform: focused ? 'scale(1.12)' : 'scale(1)',
        transition: 'transform 0.1s, background 0.1s',
        boxShadow: focused ? '0 0 0 2px rgba(229,9,20,0.45)' : 'none',
        userSelect: 'none',
        letterSpacing: isSpecial ? 0.5 : 0,
      }}
    >
      {displayLabel}
    </div>
  )
}

export function SearchScreen() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<{ channelList: SearchItem[]; movieList: SearchItem[]; showList: SearchItem[] } | null>(null)
  const [loading, setLoading] = useState(false)
  const [cursorOn, setCursorOn] = useState(true)
  const [minLengthMsg, setMinLengthMsg] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const sectionsRef = useRef<SearchSection[]>([])
  const { navigate, navigateToMovieDetail, navigateToTvShowDetail } = useAppStore()

  const { ref, focusKey, setFocus } = useFocusable({ focusKey: 'search-screen', trackChildren: true })

  useEffect(() => {
    _searchSetFocusFn = setFocus
    return () => { _searchSetFocusFn = null }
  }, [setFocus])

  useEffect(() => {
    _searchFocused = true
    const t = setTimeout(() => setFocus('kb-0-0'), 80)
    return () => clearTimeout(t)
  }, [setFocus])

  useEffect(() => {
    const t = setInterval(() => setCursorOn(v => !v), 530)
    return () => clearInterval(t)
  }, [])

  const doSearch = useCallback(async (q: string) => {
    const trimmed = q.trim()
    if (trimmed.length < 3) {
      setResults(null)
      setLoading(false)
      setMinLengthMsg('Please enter at least 3 letters')
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => setMinLengthMsg(''), 3000)
      return
    }
    setMinLengthMsg('')
    setLoading(true)
    const data = await searchProgram(trimmed)
    setResults(data)
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!query.trim()) { setResults(null); setLoading(false) }
  }, [query])

  const handleKey = useCallback((key: string) => {
    if (key === '⌫') {
      setQuery(q => q.slice(0, -1))
    } else if (key === 'clear') {
      setQuery('')
      setResults(null)
    } else if (key === 'space') {
      setQuery(q => q + ' ')
    } else if (key === 'ok') {
      setQuery(q => { doSearch(q); return q })
    } else {
      setQuery(q => q + key)
    }
  }, [doSearch])

  const handleSelect = useCallback(async (item: SearchItem, type: 'channel' | 'movie' | 'show') => {
    if (type === 'channel') {
      const launched = await playNative(item.channelURL ?? '', item.channelName, undefined, true)
      if (!launched && !shouldUseNativePlayer()) {
        navigate('player', {
          id: `livetv-${item.channelId}`,
          title: item.channelName,
          description: '',
          thumbnailUrl: item.channelLogo,
          backdropUrl: item.channelLogo,
          streamUrl: item.channelURL ?? '',
          duration: 0,
          genre: [],
          year: new Date().getFullYear(),
          rating: '',
          type: 'episode',
        })
      }
    } else if (type === 'movie') {
      navigateToMovieDetail(item.channelId)
    } else {
      navigateToTvShowDetail(item.channelId)
    }
  }, [navigate, navigateToMovieDetail, navigateToTvShowDetail])

  const buildSections = useCallback((): SearchSection[] => {
    if (!results) return []
    const raw: Array<{ title: string; items: SearchItem[]; type: 'channel' | 'movie' | 'show' }> = [
      { title: 'Channels', items: results.channelList, type: 'channel' },
      { title: 'Movies', items: results.movieList, type: 'movie' },
      { title: 'TV Shows', items: results.showList, type: 'show' },
    ]
    return raw.filter(s => s.items.length > 0).map((s, i) => ({ ...s, sectionIdx: i }))
  }, [results])

  const sections = buildSections()
  sectionsRef.current = sections
  const totalResults = sections.reduce((acc, s) => acc + s.items.length, 0)

  const kbArrow = useCallback((ri: number, ci: number) => (dir: string): boolean => {
    const row = KB_ROWS[ri]
    if (dir === 'up') {
      if (ri === 0) { setFocus('nav-search'); return false }
      const prevRow = KB_ROWS[ri - 1]
      setFocus(`kb-${ri - 1}-${Math.min(ci, prevRow.length - 1)}`)
      return false
    }
    if (dir === 'down') {
      if (ri < KB_ROWS.length - 1) {
        const nextRow = KB_ROWS[ri + 1]
        setFocus(`kb-${ri + 1}-${Math.min(ci, nextRow.length - 1)}`)
      }
      return false
    }
    if (dir === 'left') {
      if (ci > 0) { setFocus(`kb-${ri}-${ci - 1}`); return false }
      if (sectionsRef.current.length > 0) { setFocus('search-card-0-0'); return false }
      return false
    }
    if (dir === 'right') {
      if (ci < row.length - 1) { setFocus(`kb-${ri}-${ci + 1}`); return false }
      return false
    }
    return false
  }, [setFocus])

  return (
    <FocusContext.Provider value={focusKey}>
      <div ref={ref} style={{ height: '100%', display: 'flex', overflow: 'hidden' }}>

        <div style={{
          flex: 1,
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
          paddingLeft: '5vw',
          paddingTop: 'clamp(14px, 2.5vh, 28px)',
          paddingBottom: 32,
        }}>
          <h1 style={{ color: '#fff', fontWeight: 800, fontSize: 'clamp(20px, 2.8vw, 36px)', margin: '0 0 12px', flexShrink: 0 }}>
            Search
          </h1>

          <div style={{
            position: 'relative',
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '13px 44px 13px 50px',
            borderRadius: 14,
            border: '2px solid rgba(255,255,255,0.15)',
            background: 'rgba(255,255,255,0.06)',
            marginBottom: 16,
            marginRight: '4vw',
            flexShrink: 0,
            minHeight: 50,
          }}>
            <svg viewBox="0 0 24 24" style={{
              position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)',
              width: 20, height: 20, fill: 'none', stroke: 'rgba(255,255,255,0.4)', strokeWidth: 2.5, pointerEvents: 'none',
            }}>
              <circle cx="11" cy="11" r="7" />
              <line x1="16.5" y1="16.5" x2="22" y2="22" />
            </svg>
            <span style={{
              color: query ? '#fff' : 'rgba(255,255,255,0.3)',
              fontSize: 'clamp(13px, 1.4vw, 17px)',
              flex: 1,
              overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
            }}>
              {query || 'Search channels, movies, shows...'}
              {query.length > 0 && (
                <span style={{
                  display: 'inline-block', width: 2, height: '1em',
                  background: cursorOn ? '#e50914' : 'transparent',
                  marginLeft: 2, verticalAlign: 'middle',
                }} />
              )}
            </span>
            {query.length > 0 && (
              <button
                onClick={() => setQuery('')}
                style={{
                  position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)',
                  fontSize: 18, cursor: 'pointer', padding: 4,
                }}
              >
                ✕
              </button>
            )}
          </div>

          <div style={{ flex: 1, overflowY: 'auto', overflowX: 'clip', paddingLeft: 8, paddingRight: '4vw', paddingTop: 4, paddingBottom: 8 }} className="scrollbar-hide">
            {loading && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: 60, color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>
                Searching…
              </div>
            )}

            {!loading && query.trim() && results && totalResults === 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 60, gap: 10 }}>
                <span style={{ fontSize: 48, opacity: 0.2 }}>⌕</span>
                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>No results for <span style={{ color: '#fff' }}>"{query}"</span></p>
              </div>
            )}

            {!loading && !query.trim() && !minLengthMsg && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 60, gap: 10, textAlign: 'center' }}>
                <svg viewBox="0 0 24 24" style={{ width: 64, height: 64, fill: 'none', stroke: 'rgba(255,255,255,0.12)', strokeWidth: 1.5 }}>
                  <circle cx="11" cy="11" r="7" />
                  <line x1="16.5" y1="16.5" x2="22" y2="22" />
                </svg>
                <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 14, margin: 0 }}>Start typing to search</p>
              </div>
            )}

            {minLengthMsg && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 60, gap: 10, textAlign: 'center' }}>
                <span style={{ fontSize: 40, opacity: 0.3 }}>⚠</span>
                <p style={{ color: '#ffb347', fontSize: 14, fontWeight: 600, margin: 0 }}>{minLengthMsg}</p>
              </div>
            )}

            {!loading && results && totalResults > 0 && (
              <div style={{ marginBottom: 8 }}>
                <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, margin: '0 0 16px' }}>
                  {totalResults} result{totalResults !== 1 ? 's' : ''} for <span style={{ color: '#fff', fontWeight: 600 }}>"{query}"</span>
                </p>
                {sections.map((section) => (
                  <ResultSection
                    key={section.type}
                    section={section}
                    sections={sections}
                    setFocus={setFocus}
                    onSelect={handleSelect}
                    onCardFocused={() => { _searchFocused = true }}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        <div style={{
          width: 'clamp(280px, 34vw, 440px)',
          flexShrink: 0,
          display: 'flex', flexDirection: 'column', justifyContent: 'center',
          padding: '24px 20px 24px 14px',
          borderLeft: '1px solid rgba(255,255,255,0.07)',
          background: 'rgba(0,0,0,0.25)',
        }}>
          <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10, fontWeight: 700, letterSpacing: 2, margin: '0 0 12px', textTransform: 'uppercase' }}>
            Keyboard
          </p>
          {KB_ROWS.map((row, ri) => (
            <div key={ri} style={{ display: 'flex', gap: 5, marginBottom: 5 }}>
              {row.map((key, ci) => (
                <KbKey
                  key={key}
                  label={key}
                  focusKey={`kb-${ri}-${ci}`}
                  onPress={() => handleKey(key)}
                  onArrow={kbArrow(ri, ci)}
                />
              ))}
            </div>
          ))}
        </div>

      </div>
    </FocusContext.Provider>
  )
}
