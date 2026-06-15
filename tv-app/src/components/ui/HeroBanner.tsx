import { useState, useEffect, useCallback } from 'react'
import { useFocusable, FocusContext } from '@noriginmedia/norigin-spatial-navigation'
import { FocusableButton } from '../focusable/FocusableButton'
import type { ContentItem } from '../../types/content'

interface HeroBannerProps {
  items: ContentItem[]
  onPlay?: (item: ContentItem) => void
  onMoreInfo?: (item: ContentItem) => void
  focusKey: string
}

const SLIDE_INTERVAL = 5000

export function HeroBanner({ items, onPlay, onMoreInfo, focusKey }: HeroBannerProps) {
  const [activeIndex, setActiveIndex] = useState(0)

  const { ref, focusKey: currentFocusKey, setFocus, hasFocusedChild } = useFocusable({
    focusKey,
    trackChildren: true,
    onFocus: () => {
      ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    },
  })

  useEffect(() => {
    if (hasFocusedChild) return
    const timer = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % items.length)
    }, SLIDE_INTERVAL)
    return () => clearInterval(timer)
  }, [items.length, hasFocusedChild])

  const item = items[activeIndex]

  const handleUp = useCallback(() => { setFocus('nav-home'); return false as const }, [setFocus])
  const handleDown = useCallback(() => { setFocus('row-trending'); return false as const }, [setFocus])

  return (
    <FocusContext.Provider value={currentFocusKey}>
      <div
        ref={ref}
        className="relative w-full overflow-hidden"
        style={{ height: 'clamp(200px, 42vh, 520px)' }}
      >
        {items.map((it, idx) => (
          <div
            key={it.id}
            style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, opacity: idx === activeIndex ? 1 : 0, transition: 'opacity 0.7s', pointerEvents: 'none' }}
          >
            <img
              src={it.backdropUrl}
              alt={it.title}
              className="w-full h-full object-cover"
            />
          </div>
        ))}

        <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, background: 'linear-gradient(to right, #000 0%, rgba(0,0,0,0.5) 50%, transparent 100%)' }} />
        <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, background: 'linear-gradient(to top, #0a0a0a 0%, transparent 50%)' }} />

        <div className="absolute bottom-4 left-0 px-safe" style={{ maxWidth: 'min(680px, 55vw)' }}>
          <div style={{ display: 'flex', marginBottom: 8 }}>
            {item.genre.slice(0, 2).map((g) => (
              <span key={g} style={{ backgroundColor: 'rgba(229,9,20,0.8)', color: '#fff', fontSize: '0.875rem', padding: '2px 12px', borderRadius: 4, marginRight: 8 }}>
                {g}
              </span>
            ))}
          </div>

          <h1
            key={item.id}
            className="text-tv-2xl font-bold text-white leading-tight mb-2"
            style={{ transition: 'opacity 0.4s', opacity: 1 }}
          >
            {item.title}
          </h1>

          <p className="text-white/60 text-sm mb-4">
            {item.year} · {item.rating} · {Math.floor(item.duration / 60)}h {item.duration % 60}m
          </p>

          <div style={{ display: 'flex' }}>
            <FocusableButton
              focusKey="hero-play"
              variant="primary"
              style={{ marginRight: 16 }}
              onEnterPress={() => onPlay?.(item)}
              onArrowPress={(dir) => {
                if (dir === 'up') return handleUp()
                if (dir === 'down') return handleDown()
                if (dir === 'left') return false
                if (dir === 'right') { setFocus('hero-info'); return false }
                return false
              }}
            >
              ▶ Play
            </FocusableButton>
            <FocusableButton
              focusKey="hero-info"
              variant="secondary"
              onEnterPress={() => onMoreInfo?.(item)}
              onArrowPress={(dir) => {
                if (dir === 'up') return handleUp()
                if (dir === 'down') return handleDown()
                if (dir === 'right') return false
                if (dir === 'left') { setFocus('hero-play'); return false }
                return false
              }}
            >
              ⓘ More Info
            </FocusableButton>
          </div>
        </div>

        <div className="absolute bottom-7 right-[5vw] flex items-center">
          {items.map((_, idx) => (
            <div
              key={idx}
              style={{
                marginRight: 8,
                height: 6,
                borderRadius: 3,
                backgroundColor: idx === activeIndex ? '#e50914' : 'rgba(255,255,255,0.35)',
                transition: 'width 0.3s, background-color 0.3s',
                width: idx === activeIndex ? 28 : 8,
              }}
            />
          ))}
        </div>
      </div>
    </FocusContext.Provider>
  )
}
