import { useState, useRef, useCallback, useEffect } from 'react'
import { useFocusable, FocusContext } from '@noriginmedia/norigin-spatial-navigation'
import { fetchRadioList } from '../api/radioApi'
import type { RadioStation } from '../api/radioApi'
import { useAppStore } from '../store/appStore'

const COLS = 4
const PAGE_COUNT = 40

let _radioSetFocusFn: ((key: string) => void) | null = null
let _radioCardFocused = false

export function tryRadioBack(): boolean {
  if (_radioSetFocusFn && _radioCardFocused) {
    _radioCardFocused = false
    _radioSetFocusFn('nav-radio')
    return true
  }
  return false
}

function RadioCard({
  item, focusKey, onArrow, onSelect, onFocused, style
}: {
  item: RadioStation; focusKey: string; onArrow: (dir: string) => boolean; onSelect: () => void; onFocused: () => void;
  style?: React.CSSProperties
}) {
  const [imgError, setImgError] = useState(false)
  const domRef = useRef<HTMLDivElement | null>(null)
  const { ref, focused } = useFocusable({
    focusKey,
    onEnterPress: onSelect,
    onArrowPress: onArrow,
    onFocus: onFocused,
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
    if (eRect.top < pRect.top) parent.scrollTop -= pRect.top - eRect.top + 16
    else if (eRect.bottom > pRect.bottom) parent.scrollTop += eRect.bottom - pRect.bottom + 16
  }, [focused])

  return (
    <div
      ref={mergedRef}
      onClick={onSelect}
      style={{
        flex: 1,
        aspectRatio: '16/9',
        borderRadius: 12,
        overflow: 'hidden',
        position: 'relative',
        outline: (window as any).isLegacyTv ? 'none' : (focused ? '3px solid #e50914' : '3px solid transparent'),
        boxShadow: (window as any).isLegacyTv && focused ? '0 0 0 3px #0a0a0a, 0 0 0 6px #e50914' : 'none',
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
          <span style={{ color: '#fff', fontSize: 11, fontWeight: 600, textAlign: 'center', lineHeight: 1.4 }}>
            {item.channelName}
          </span>
        </div>
      )}

    </div>
  )
}

export function RadioScreen() {
  const [stations, setStations] = useState<RadioStation[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const pageRef = useRef(0)
  const scrollRef = useRef<HTMLDivElement>(null)

  const { navigateToRadioPlayer } = useAppStore()
  const { ref, focusKey, setFocus } = useFocusable({ focusKey: 'radio-screen', trackChildren: true })

  const loadPage = useCallback(async (reset: boolean) => {
    const offset = reset ? 0 : pageRef.current * PAGE_COUNT
    if (reset) {
      setLoading(true)
      setStations([])
      setHasMore(true)
      pageRef.current = 0
    } else {
      setLoadingMore(true)
    }
    const result = await fetchRadioList(offset, PAGE_COUNT)
    if (reset) {
      setStations(result.items)
      setLoading(false)
    } else {
      setStations((prev) => [...prev, ...result.items])
      setLoadingMore(false)
    }
    pageRef.current = pageRef.current + 1
    if (result.items.length < PAGE_COUNT) setHasMore(false)
  }, [])

  useEffect(() => {
    _radioSetFocusFn = setFocus
    return () => { _radioSetFocusFn = null }
  }, [setFocus])

  useEffect(() => {
    loadPage(true).then(() => {
      setTimeout(() => setFocus('radio-card-0-0'), 100)
    })
  }, [loadPage, setFocus])

  const handleScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el || loadingMore || !hasMore) return
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 300) {
      loadPage(false)
    }
  }, [loadingMore, hasMore, loadPage])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.addEventListener('scroll', handleScroll)
    return () => el.removeEventListener('scroll', handleScroll)
  }, [handleScroll])

  const rows = Math.ceil(stations.length / COLS)

  const cardArrow = useCallback((row: number, col: number) => (dir: string): boolean => {
    if (dir === 'up') {
      if (row === 0) { setFocus('nav-radio'); return false }
      setFocus(`radio-card-${row - 1}-${col}`); return false
    }
    if (dir === 'down') {
      if (row + 1 < rows) {
        const nextRowLen = stations.slice((row + 1) * COLS, (row + 2) * COLS).length
        setFocus(`radio-card-${row + 1}-${Math.min(col, nextRowLen - 1)}`); return false
      }
      return false
    }
    if (dir === 'left') {
      if (col > 0) { setFocus(`radio-card-${row}-${col - 1}`); return false }
      return false
    }
    if (dir === 'right') {
      const rowLen = stations.slice(row * COLS, (row + 1) * COLS).length
      if (col < rowLen - 1) { setFocus(`radio-card-${row}-${col + 1}`); return false }
      return false
    }
    return true
  }, [rows, stations, setFocus])

  const handleSelect = useCallback((station: RadioStation) => {
    navigateToRadioPlayer(station.channelId)
  }, [navigateToRadioPlayer])

  return (
    <FocusContext.Provider value={focusKey}>
      <div ref={ref} style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{
          background: 'transparent',
          paddingLeft: '5vw', paddingRight: '5vw',
          paddingTop: 'clamp(14px, 2.5vh, 28px)', paddingBottom: 'clamp(8px, 1.5vh, 12px)',
          flexShrink: 0,
        }}>
          <h1 className="text-tv-3xl font-bold text-white leading-tight">Radio</h1>
          <p className="text-white/50 text-tv-sm mt-1 mb-2">
            {loading ? 'Loading…' : `${stations.length} stations`}
          </p>
        </div>

        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, color: 'rgba(255,255,255,0.4)', fontSize: 16 }}>
            Loading…
          </div>
        ) : stations.length === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>
            No stations available
          </div>
        ) : (
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', paddingLeft: '5vw', paddingRight: '5vw', paddingTop: 20, paddingBottom: 32 }}
            className="scrollbar-hide"
          >
            {Array.from({ length: rows }).map((_, rowIdx) => {
              const rowItems = stations.slice(rowIdx * COLS, (rowIdx + 1) * COLS)
              return (
                <div key={rowIdx} style={{ display: 'flex', gap: 16, marginBottom: 8, overflow: 'visible' }}>
                  {rowItems.map((item, colIdx) => (
                    <RadioCard
                      key={item.channelId}
                      item={item}
                      style={{ marginRight: colIdx < COLS - 1 ? 16 : 0 }}
                      focusKey={`radio-card-${rowIdx}-${colIdx}`}
                      onArrow={cardArrow(rowIdx, colIdx)}
                      onSelect={() => handleSelect(item)}
                      onFocused={() => { _radioCardFocused = true }}
                    />
                  ))}
                  {rowItems.length < COLS && Array.from({ length: COLS - rowItems.length }).map((_, i) => (
                    <div key={`spacer-${i}`} style={{ flex: 1 }} />
                  ))}
                </div>
              )
            })}
            {loadingMore && (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '16px 0', color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>
                Loading more…
              </div>
            )}
            {!hasMore && stations.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 40, color: 'rgba(255,255,255,0.2)', fontSize: 12 }}>
                — end —
              </div>
            )}
          </div>
        )}
      </div>
    </FocusContext.Provider>
  )
}
