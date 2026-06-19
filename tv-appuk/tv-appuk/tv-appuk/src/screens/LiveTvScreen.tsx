import { useState, useEffect, useCallback, useRef } from 'react'
import { useFocusable, FocusContext } from '@noriginmedia/norigin-spatial-navigation'
import { fetchLiveTvPage } from '../api/liveTvApi'
import type { ContentItem } from '../types/content'
import { useAppStore } from '../store/appStore'
import { playNative, shouldUseNativePlayer } from '../platform/nativeVideoPlayer'

const COLS = 5
const PAGE_COUNT = 40

let _liveTvSetFocusFn: ((key: string) => void) | null = null
let _liveTvCardFocused = false

export function tryLiveTvBack(): boolean {
  if (_liveTvSetFocusFn && _liveTvCardFocused) {
    _liveTvCardFocused = false
    _liveTvSetFocusFn('nav-livetv')
    return true
  }
  return false
}

function ChannelCard({
  item, focusKey, onArrow, onSelect, onFocused,
}: {
  item: ContentItem; focusKey: string; onArrow: (dir: string) => boolean; onSelect: () => void; onFocused: () => void
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
    <div style={{ flex: 1, position: 'relative', aspectRatio: '16/9' }}>
      {/* Universal Focus Ring */}
      <div style={{
        position: 'absolute',
        top: -6, left: -6, right: -6, bottom: -6,
        borderRadius: 18,
        border: focused ? '3px solid #e50914' : '3px solid transparent',
        pointerEvents: 'none',
        zIndex: 10,
        transition: 'border-color 0.12s',
      }} />

      {/* The actual card */}
      <div
        ref={mergedRef}
        onClick={onSelect}
        style={{
          width: '100%',
          height: '100%',
          borderRadius: 12,
          overflow: 'hidden',
          position: 'relative',
          transform: focused ? 'scale(1.06)' : 'scale(1)',
          transition: 'transform 0.15s',
          zIndex: focused ? 10 : 1,
          background: '#1a1a1a',
          cursor: 'pointer',
        }}
      >
        {!imgError ? (
          <img
            src={item.thumbnailUrl}
            alt={item.title}
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
              {item.title}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

export function LiveTvScreen() {
  const [channels, setChannels] = useState<ContentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const pageRef = useRef(0)
  const scrollRef = useRef<HTMLDivElement>(null)
  const { navigate } = useAppStore()
  const { ref, focusKey, setFocus } = useFocusable({ focusKey: 'livetv-screen', trackChildren: true })

  const loadPage = useCallback(async (reset: boolean) => {
    const page = reset ? 0 : pageRef.current
    if (reset) {
      setLoading(true)
      setChannels([])
      setHasMore(true)
      pageRef.current = 0
    } else {
      setLoadingMore(true)
    }
    const result = await fetchLiveTvPage(page, PAGE_COUNT)
    if (reset) {
      setChannels(result.items)
      setLoading(false)
    } else {
      setChannels((prev) => [...prev, ...result.items])
      setLoadingMore(false)
    }
    pageRef.current = page + 1
    if (result.items.length < PAGE_COUNT) setHasMore(false)
  }, [])

  useEffect(() => {
    _liveTvSetFocusFn = setFocus
    return () => { _liveTvSetFocusFn = null }
  }, [setFocus])

  useEffect(() => {
    loadPage(true).then(() => {
      setTimeout(() => setFocus('livetv-card-0-0'), 100)
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

  const rows = Math.ceil(channels.length / COLS)

  const cardArrow = useCallback((row: number, col: number) => (dir: string): boolean => {
    if (dir === 'up') {
      if (row === 0) { setFocus('nav-livetv'); return false }
      setFocus(`livetv-card-${row - 1}-${col}`); return false
    }
    if (dir === 'down') {
      if (row + 1 < rows) {
        const nextRowLen = channels.slice((row + 1) * COLS, (row + 2) * COLS).length
        setFocus(`livetv-card-${row + 1}-${Math.min(col, nextRowLen - 1)}`); return false
      }
      return false
    }
    if (dir === 'left') {
      if (col > 0) { setFocus(`livetv-card-${row}-${col - 1}`); return false }
      return false
    }
    if (dir === 'right') {
      const rowLen = channels.slice(row * COLS, (row + 1) * COLS).length
      if (col < rowLen - 1) { setFocus(`livetv-card-${row}-${col + 1}`); return false }
      return false
    }
    return true
  }, [rows, channels, setFocus])

  const handleSelect = useCallback(async (item: ContentItem) => {
    if (!item.streamUrl) return
    const launched = await playNative(item.streamUrl, item.title, undefined, true)
    if (!launched && !shouldUseNativePlayer()) navigate('player', item)
  }, [navigate])

  return (
    <FocusContext.Provider value={focusKey}>
      <div ref={ref} style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{
          background: 'transparent',
          paddingLeft: '5vw', paddingRight: '5vw',
          paddingTop: 'clamp(14px, 2.5vh, 28px)', paddingBottom: 'clamp(8px, 1.5vh, 12px)',
          flexShrink: 0,
        }}>
          <h1 className="text-tv-3xl font-bold text-white leading-tight">Live TV</h1>
          <p className="text-white/50 text-tv-sm mt-1 mb-2">
            {loading ? 'Loading…' : `${channels.length} channels`}
          </p>
        </div>

        <div
          ref={scrollRef}
          style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}
          className="scrollbar-hide"
        >
          <div style={{ paddingLeft: '5vw', paddingRight: '5vw', paddingTop: 16, paddingBottom: 32 }}>
            {loading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '30vh', color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>
                Loading…
              </div>
            ) : channels.length === 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '30vh', color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>
                No channels available
              </div>
            ) : (
              <>
                {Array.from({ length: rows }).map((_, rowIdx) => {
                  const rowItems = channels.slice(rowIdx * COLS, (rowIdx + 1) * COLS)
                  return (
                    <div key={rowIdx} style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
                      {rowItems.map((item, colIdx) => (
                        <ChannelCard
                          key={item.id}
                          item={item}
                          focusKey={`livetv-card-${rowIdx}-${colIdx}`}
                          onArrow={cardArrow(rowIdx, colIdx)}
                          onSelect={() => handleSelect(item)}
                          onFocused={() => { _liveTvCardFocused = true }}
                        />
                      ))}
                      {rowItems.length < COLS && Array.from({ length: COLS - rowItems.length }).map((_, i) => (
                        <div key={`spacer-${i}`} style={{ flex: 1, aspectRatio: '16/9' }} />
                      ))}
                    </div>
                  )
                })}
                {loadingMore && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 60, color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>
                    Loading more…
                  </div>
                )}
                {!hasMore && channels.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 40, color: 'rgba(255,255,255,0.2)', fontSize: 12 }}>
                    — end —
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </FocusContext.Provider>
  )
}
