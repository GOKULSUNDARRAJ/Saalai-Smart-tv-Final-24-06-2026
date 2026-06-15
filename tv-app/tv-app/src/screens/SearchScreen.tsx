import { useState, useRef, useCallback, useEffect } from 'react'
import { useFocusable, FocusContext } from '@noriginmedia/norigin-spatial-navigation'
import { searchProgram } from '../api/searchApi'
import type { SearchItem } from '../api/searchApi'
import { useAppStore } from '../store/appStore'
import { playNative } from '../platform/nativeVideoPlayer'

const COLS = 4

interface SearchSection {
  title: string
  items: SearchItem[]
  type: 'channel' | 'movie' | 'show'
  sectionIdx: number
}

function SearchCard({
  item, focusKey, onEnter, onArrow,
}: {
  item: SearchItem
  focusKey: string
  onEnter: () => void
  onArrow: (dir: string) => boolean
}) {
  const [imgError, setImgError] = useState(false)
  const domRef = useRef<HTMLDivElement | null>(null)
  const onEnterRef = useRef(onEnter)
  onEnterRef.current = onEnter

  const { ref, focused } = useFocusable({
    focusKey,
    onEnterPress: () => onEnterRef.current(),
    onArrowPress: onArrow,
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
        aspectRatio: '16/9',
        borderRadius: 10,
        overflow: 'hidden',
        position: 'relative',
        cursor: 'pointer',
        outline: focused ? '3px solid #e50914' : '3px solid transparent',
        outlineOffset: 3,
        transform: focused ? 'scale(1.05)' : 'scale(1)',
        transition: 'transform 0.15s, outline-color 0.12s',
        zIndex: focused ? 10 : 1,
        background: '#1a1a2e',
        flexShrink: 0,
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
          background: 'linear-gradient(135deg, #1a1a2e, #16213e)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 8,
        }}>
          <span style={{ color: '#fff', fontSize: 12, fontWeight: 600, textAlign: 'center', lineHeight: 1.4 }}>
            {item.channelName}
          </span>
        </div>
      )}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        background: 'linear-gradient(to top, rgba(0,0,0,0.88) 0%, transparent 100%)',
        padding: '20px 8px 8px',
      }}>
        <p style={{ color: '#fff', fontSize: 11, fontWeight: 600, textAlign: 'center', margin: 0, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
          {item.channelName}
        </p>
      </div>
    </div>
  )
}

function ResultSection({
  section, sections, setFocus, onSelect,
}: {
  section: SearchSection
  sections: SearchSection[]
  setFocus: (key: string) => void
  onSelect: (item: SearchItem, type: 'channel' | 'movie' | 'show') => void
}) {
  const { items, sectionIdx, title, type } = section
  if (items.length === 0) return null

  const getSectionFirstKey = (si: number, col: number) => {
    const s = sections[si]
    if (!s || s.items.length === 0) return null
    return `search-card-${si}-${Math.min(col, s.items.length - 1)}`
  }

  const getSectionLastRowKey = (si: number, col: number) => {
    const s = sections[si]
    if (!s || s.items.length === 0) return null
    const lastIdx = s.items.length - 1
    const lastRowStart = Math.floor(lastIdx / COLS) * COLS
    return `search-card-${si}-${Math.min(lastRowStart + col, lastIdx)}`
  }

  return (
    <div style={{ marginBottom: 24 }}>
      <h2 style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, fontWeight: 700, letterSpacing: 2, margin: '0 0 10px' }}>
        {title.toUpperCase()}
      </h2>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${COLS}, 1fr)`, gap: 10 }}>
        {items.map((item, idx) => {
          const row = Math.floor(idx / COLS)
          const col = idx % COLS
          const totalRows = Math.ceil(items.length / COLS)
          const isFirstRow = row === 0
          const isLastRow = row === totalRows - 1

          return (
            <SearchCard
              key={item.channelId}
              item={item}
              focusKey={`search-card-${sectionIdx}-${idx}`}
              onEnter={() => onSelect(item, type)}
              onArrow={(dir) => {
                if (dir === 'up') {
                  if (isFirstRow) {
                    if (sectionIdx === 0) {
                      setFocus('search-input')
                    } else {
                      const key = getSectionLastRowKey(sectionIdx - 1, col)
                      if (key) setFocus(key)
                      else setFocus('search-input')
                    }
                    return false
                  }
                  setFocus(`search-card-${sectionIdx}-${idx - COLS}`)
                  return false
                }
                if (dir === 'down') {
                  if (!isLastRow && idx + COLS < items.length) {
                    setFocus(`search-card-${sectionIdx}-${idx + COLS}`)
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
                  if (col === COLS - 1 || idx + 1 >= items.length) return false
                  setFocus(`search-card-${sectionIdx}-${idx + 1}`)
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

export function SearchScreen() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<{ channelList: SearchItem[]; movieList: SearchItem[]; showList: SearchItem[] } | null>(null)
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { navigate, navigateToMovieDetail, navigateToTvShowDetail } = useAppStore()

  const { ref, focusKey, setFocus } = useFocusable({ focusKey: 'search-screen', trackChildren: true })

  useEffect(() => {
    const t = setTimeout(() => setFocus('search-input'), 80)
    return () => clearTimeout(t)
  }, [setFocus])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!query.trim()) { setResults(null); setLoading(false); return }
    setLoading(true)
    debounceRef.current = setTimeout(async () => {
      const data = await searchProgram(query)
      setResults(data)
      setLoading(false)
    }, 500)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query])

  const { ref: inputFocusRef, focused: inputFocused } = useFocusable({
    focusKey: 'search-input',
    onEnterPress: () => inputRef.current?.focus(),
    onArrowPress: (dir) => {
      if (dir === 'up') { setFocus('nav-search'); return false }
      if (dir === 'down') {
        const sections = buildSections()
        const first = sections[0]
        if (first) { setFocus(`search-card-0-0`); return false }
        return false
      }
      return false
    },
  })

  useEffect(() => {
    if (inputFocused) inputRef.current?.focus()
  }, [inputFocused])

  const setInputRef = useCallback((el: HTMLDivElement | null) => {
    (inputFocusRef as React.MutableRefObject<HTMLDivElement | null>).current = el
  }, [inputFocusRef])

  const handleSelect = useCallback(async (item: SearchItem, type: 'channel' | 'movie' | 'show') => {
    if (type === 'channel') {
      const launched = await playNative(item.channelURL ?? '', item.channelName)
      if (!launched) {
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
  const totalResults = sections.reduce((acc, s) => acc + s.items.length, 0)

  return (
    <FocusContext.Provider value={focusKey}>
      <div ref={ref} style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{
          background: 'transparent',
          paddingLeft: '5vw', paddingRight: '5vw',
          paddingTop: 'clamp(14px, 2.5vh, 28px)',
          paddingBottom: 'clamp(8px, 1.2vh, 14px)',
          flexShrink: 0,
        }}>
          <h1 style={{ color: '#fff', fontWeight: 800, fontSize: 'clamp(20px, 2.8vw, 36px)', margin: '0 0 12px' }}>Search</h1>
          <div
            ref={setInputRef}
            style={{ position: 'relative', maxWidth: '60vw' }}
          >
            <svg viewBox="0 0 24 24" style={{
              position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)',
              width: 20, height: 20, fill: 'none', stroke: 'rgba(255,255,255,0.4)', strokeWidth: 2.5, pointerEvents: 'none',
            }}>
              <circle cx="11" cy="11" r="7" />
              <line x1="16.5" y1="16.5" x2="22" y2="22" />
            </svg>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search channels, movies, shows..."
              style={{
                width: '100%',
                padding: '14px 44px 14px 50px',
                borderRadius: 14,
                border: inputFocused ? '2px solid #e50914' : '2px solid rgba(255,255,255,0.15)',
                background: inputFocused ? 'rgba(229,9,20,0.08)' : 'rgba(255,255,255,0.06)',
                color: '#fff',
                fontSize: 'clamp(13px, 1.4vw, 17px)',
                outline: 'none',
                transition: 'border-color 0.15s, background 0.15s',
              }}
              onKeyDown={(e) => {
                if (e.key === 'ArrowUp') { e.preventDefault(); setFocus('nav-search') }
                if (e.key === 'ArrowDown') {
                  e.preventDefault()
                  if (sections.length > 0) setFocus('search-card-0-0')
                }
              }}
            />
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
        </div>

        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', paddingLeft: '5vw', paddingRight: '5vw', paddingTop: 16, paddingBottom: 32 }} className="scrollbar-hide">
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
                />
              ))}
            </div>
          )}

          {!loading && !query.trim() && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 60, gap: 10, textAlign: 'center' }}>
              <svg viewBox="0 0 24 24" style={{ width: 64, height: 64, fill: 'none', stroke: 'rgba(255,255,255,0.12)', strokeWidth: 1.5 }}>
                <circle cx="11" cy="11" r="7" />
                <line x1="16.5" y1="16.5" x2="22" y2="22" />
              </svg>
              <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 14, margin: 0 }}>Start typing to search</p>
              <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: 12, margin: 0 }}>Press OK / Enter to activate keyboard</p>
            </div>
          )}
        </div>
      </div>
    </FocusContext.Provider>
  )
}
