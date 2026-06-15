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
}

const BASE_W = Math.round(Math.max(140, Math.min(window.innerWidth * 0.17, 280)))
const LANDSCAPE_W = BASE_W
const LANDSCAPE_H = Math.round(BASE_W * 9 / 16)
const PORTRAIT_W = Math.round(Math.max(110, Math.min(window.innerWidth * 0.115, 190)))
const PORTRAIT_H = Math.round(PORTRAIT_W * 3 / 2)

export function ContentRow({ row, onSelect, onItemFocused, focusKey, onUp, onDown, cardAspect = 'landscape' }: ContentRowProps) {
  const rowWrapperRef = useRef<HTMLDivElement>(null)
  const horizontalScrollRef = useRef<HTMLDivElement>(null)

  const cardW = cardAspect === 'portrait' ? PORTRAIT_W : LANDSCAPE_W
  const cardH = cardAspect === 'portrait' ? PORTRAIT_H : LANDSCAPE_H

  const onFocus = useCallback(() => {
    rowWrapperRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
    })
  }, [])

  const { ref, focusKey: currentFocusKey } = useFocusable({
    focusKey,
    trackChildren: true,
    onFocus,
  })

  const handleCardFocus = useCallback((cardEl: HTMLElement | null) => {
    if (!cardEl || !horizontalScrollRef.current) return
    const container = horizontalScrollRef.current
    const cardLeft = cardEl.offsetLeft
    const cardRight = cardLeft + cardEl.offsetWidth
    const containerLeft = container.scrollLeft
    const containerRight = containerLeft + container.offsetWidth

    if (cardLeft < containerLeft + 60) {
      container.scrollTo({ left: cardLeft - 60, behavior: 'smooth' })
    } else if (cardRight > containerRight - 60) {
      container.scrollTo({ left: cardRight - container.offsetWidth + 60, behavior: 'smooth' })
    }
  }, [])

  return (
    <FocusContext.Provider value={currentFocusKey}>
      <div ref={rowWrapperRef} style={{ marginBottom: 14 }}>
        <div ref={ref}>
          <h2 style={{
            color: '#fff', fontSize: 15, fontWeight: 600, letterSpacing: 0.3,
            marginBottom: 10, paddingLeft: '5vw', paddingRight: '5vw',
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
              gap: 14,
            }}
          >
            {row.items.map((item, index) => {
              const cardKey = `card-${focusKey}-${index}`
              const prevKey = index > 0 ? `card-${focusKey}-${index - 1}` : null
              const nextKey = index < row.items.length - 1 ? `card-${focusKey}-${index + 1}` : null
              return (
                <FocusableCard
                  key={item.id}
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
                  onArrowPress={(dir) => {
                    if (dir === 'up' && onUp) { onUp(); return false }
                    if (dir === 'down' && onDown) { onDown(); return false }
                    return true
                  }}
                />
              )
            })}
          </div>
        </div>
      </div>
    </FocusContext.Provider>
  )
}
