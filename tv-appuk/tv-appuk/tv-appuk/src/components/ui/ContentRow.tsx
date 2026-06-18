import { useRef, useCallback } from 'react'
import { useFocusable, FocusContext } from '@noriginmedia/norigin-spatial-navigation'
import { FocusableCard } from '../focusable/FocusableCard'
import type { ContentRow as ContentRowType, ContentItem } from '../../types/content'

interface ContentRowProps {
  row: ContentRowType
  onSelect?: (item: ContentItem) => void
  onItemFocused?: (item: ContentItem) => void
  focusKey: string
  onUp?: () => void
  onDown?: () => void
  cardAspect?: 'portrait' | 'landscape'
  showLiveBadge?: boolean
  hideTextOverlay?: boolean
  onViewMore?: () => void
  isFirstRow?: boolean
}

function ViewMoreCard({ focusKey, width, height, onSelect, onUp, onDown }: {
  focusKey: string
  width: number
  height: number
  onSelect: () => void
  onUp?: () => void
  onDown?: () => void
}) {
  const { ref, focused } = useFocusable({
    focusKey,
    onEnterPress: onSelect,
    onArrowPress: (dir) => {
      if (dir === 'up' && onUp) { onUp(); return false }
      if (dir === 'down' && onDown) { onDown(); return false }
      if (dir === 'right') return false
      return true
    },
  })
  return (
    <button
      ref={ref}
      onClick={onSelect}
      style={{
        width, height, flexShrink: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        borderRadius: 8,
        border: `2px solid ${focused ? '#e50914' : 'rgba(255,255,255,0.18)'}`,
        background: focused ? 'rgba(229,9,20,0.15)' : 'rgba(255,255,255,0.05)',
        color: focused ? '#fff' : 'rgba(255,255,255,0.55)',
        cursor: 'pointer', outline: 'none',
        transform: focused ? 'scale(1.05)' : 'scale(1)',
        transition: 'all 0.12s',
        gap: 10,
      }}
    >
      <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
        <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase' }}>View More</span>
    </button>
  )
}

const BASE_W = Math.round(Math.max(140, Math.min(window.innerWidth * 0.17, 280)))
const LANDSCAPE_W = BASE_W
const LANDSCAPE_H = Math.round(BASE_W * 9 / 16)
const PORTRAIT_W = Math.round(Math.max(110, Math.min(window.innerWidth * 0.115, 190)))
const PORTRAIT_H = Math.round(PORTRAIT_W * 3 / 2)

export function ContentRow({ row, onSelect, onItemFocused, focusKey, onUp, onDown, cardAspect = 'landscape', showLiveBadge = false, hideTextOverlay = false, onViewMore, isFirstRow = false }: ContentRowProps) {
  const rowWrapperRef = useRef<HTMLDivElement>(null)
  const horizontalScrollRef = useRef<HTMLDivElement>(null)

  const cardW = cardAspect === 'portrait' ? PORTRAIT_W : LANDSCAPE_W
  const cardH = cardAspect === 'portrait' ? PORTRAIT_H : LANDSCAPE_H

  const onFocus = useCallback(() => {
    if (!isFirstRow) {
      rowWrapperRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
        inline: 'nearest',
      })
    }
  }, [isFirstRow])

  const { ref, focusKey: currentFocusKey, focused, hasFocusedChild } = useFocusable({
    focusKey,
    trackChildren: true,
    onFocus,
  })

  const isRowFocused = focused || hasFocusedChild

  const handleCardFocus = useCallback((cardEl: HTMLElement | null) => {
    if (!cardEl || !horizontalScrollRef.current) return
    const container = horizontalScrollRef.current
    const containerRect = container.getBoundingClientRect()
    const cardRect = cardEl.getBoundingClientRect()
    const cardLeft = container.scrollLeft + (cardRect.left - containerRect.left)
    const leftPadding = window.innerWidth * 0.05
    if (cardRect.right > containerRect.right) {
      container.scrollTo({ left: Math.max(0, cardLeft - leftPadding), behavior: 'smooth' })
    } else if (cardRect.left < containerRect.left) {
      container.scrollTo({ left: Math.max(0, cardLeft - leftPadding), behavior: 'smooth' })
    }
  }, [])

  return (
    <FocusContext.Provider value={currentFocusKey}>
      <div ref={rowWrapperRef} style={{ marginBottom: 14 }}>
        <div ref={ref}>
          <h2 style={{
            fontSize: isRowFocused ? 24 : 15,
            fontWeight: isRowFocused ? 800 : 600,
            letterSpacing: 0.3,
            marginBottom: 10,
            paddingLeft: '5vw',
            paddingRight: '5vw',
            transition: 'all 0.2s ease-in-out',
            color: isRowFocused ? '#fff' : 'rgba(255,255,255,0.45)',
          }}>
            {row.title}
          </h2>
          <div
            ref={horizontalScrollRef}
            className="scrollbar-hide"
            style={{
              display: 'flex',
              paddingLeft: '5vw', paddingRight: '5vw',
              paddingTop: 8, paddingBottom: 12,
              overflowX: 'auto',
            }}
          >
            {row.items.map((item, index) => {
              const cardKey = `card-${focusKey}-${index}`
              const prevKey = index > 0 ? `card-${focusKey}-${index - 1}` : null
              const isLast = index === row.items.length - 1
              const nextKey = isLast
                ? (onViewMore ? `card-${focusKey}-viewmore` : null)
                : `card-${focusKey}-${index + 1}`
              return (
                <div key={item.id} style={{ marginRight: 14, flexShrink: 0 }}>
                <FocusableCard
                  item={item}
                  onSelect={onSelect}
                  onFocused={handleCardFocus}
                  onItemFocused={onItemFocused}
                  focusKey={cardKey}
                  prevFocusKey={prevKey}
                  nextFocusKey={nextKey}
                  width={cardW}
                  height={cardH}
                  portrait={cardAspect === 'portrait'}
                  showLiveBadge={showLiveBadge}
                  hideTextOverlay={hideTextOverlay}
                  onArrowPress={(dir) => {
                    if (dir === 'up' && onUp) { onUp(); return false }
                    if (dir === 'down' && onDown) { onDown(); return false }
                    return true
                  }}
                />
                </div>
              )
            })}
            {onViewMore && (
              <div style={{ marginRight: 14, flexShrink: 0 }}>
                <ViewMoreCard
                  focusKey={`card-${focusKey}-viewmore`}
                  width={cardW}
                  height={cardH}
                  onSelect={onViewMore}
                  onUp={onUp}
                  onDown={onDown}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </FocusContext.Provider>
  )
}
