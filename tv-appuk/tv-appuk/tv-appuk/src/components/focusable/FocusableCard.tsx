import { useState, useCallback } from 'react'
import { useFocusable } from '@noriginmedia/norigin-spatial-navigation'
import type { ContentItem } from '../../types/content'

interface FocusableCardProps {
  item: ContentItem
  onSelect?: (item: ContentItem) => void
  onFocused?: (el: HTMLElement | null) => void
  onItemFocused?: (item: ContentItem) => void
  onArrowPress?: (dir: string) => boolean
  focusKey?: string
  prevFocusKey?: string | null
  nextFocusKey?: string | null
  width?: number
  height?: number
  portrait?: boolean
  showLiveBadge?: boolean
  hideTextOverlay?: boolean
}

const GRADIENT_COLORS = [
  'from-red-900 to-red-700',
  'from-blue-900 to-blue-700',
  'from-purple-900 to-purple-700',
  'from-green-900 to-green-700',
  'from-yellow-900 to-yellow-700',
  'from-pink-900 to-pink-700',
  'from-indigo-900 to-indigo-700',
  'from-teal-900 to-teal-700',
]

function getGradient(id: string): string {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash)
  return GRADIENT_COLORS[Math.abs(hash) % GRADIENT_COLORS.length]
}

export function FocusableCard({
  item,
  onSelect,
  onFocused,
  onItemFocused,
  onArrowPress,
  focusKey,
  prevFocusKey,
  nextFocusKey,
  width = 320,
  height = 180,
  portrait = false,
  showLiveBadge = false,
  hideTextOverlay = false,
}: FocusableCardProps) {
  const [imgError, setImgError] = useState(false)

  const { ref, focused, setFocus } = useFocusable({
    focusKey,
    onEnterPress: () => onSelect?.(item),
    onFocus: () => { onFocused?.(ref.current); onItemFocused?.(item) },
    onArrowPress: (dir) => {
      if (dir === 'left') {
        if (prevFocusKey) { setFocus(prevFocusKey); return false }
        return false
      }
      if (dir === 'right') {
        if (nextFocusKey) { setFocus(nextFocusKey); return false }
        return false
      }
      if (onArrowPress) return onArrowPress(dir)
      return true
    },
  })

  const handleImgError = useCallback(() => setImgError(true), [])

  return (
    <div
      ref={ref}
      onClick={() => onSelect?.(item)}
      style={{
        width,
        height,
        flexShrink: 0,
        borderRadius: 10,
        overflow: 'hidden',
        outline: (window as any).isLegacyTv ? 'none' : (focused ? '3px solid #e50914' : '3px solid transparent'),
        boxShadow: (window as any).isLegacyTv && focused ? '0 0 0 3px #0a0a0a, 0 0 0 6px #e50914' : 'none',
        outlineOffset: '3px',
        transition: 'outline-color 0.1s',
        position: 'relative',
        background: '#1a1a2e',
      }}
    >
      {!imgError ? (
        <img
          src={item.thumbnailUrl}
          alt={item.title}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          loading="lazy"
          onError={handleImgError}
        />
      ) : (
        <div className={`w-full h-full bg-gradient-to-br ${getGradient(item.id)} flex items-end p-3`}>
          <span className="text-white/80 text-sm font-medium line-clamp-2">{item.title}</span>
        </div>
      )}

      <div style={{
        position: 'absolute', inset: 0,
        background: portrait
          ? 'linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.1) 50%, transparent 100%)'
          : 'linear-gradient(to top, rgba(0,0,0,0.88) 0%, transparent 55%)',
        display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
        padding: portrait ? '10px 8px' : 10,
        opacity: 0,
        visibility: 'hidden',
      }}>
        <p style={{
          color: '#fff',
          fontSize: portrait ? 11 : 13,
          fontWeight: 600,
          lineHeight: 1.3,
          overflow: 'hidden',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          textShadow: '0 1px 3px rgba(0,0,0,0.8)',
        }}>
          {item.title}
        </p>
        {!portrait && item.year > 0 && (
          <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11, marginTop: 3 }}>
            {item.year}
          </p>
        )}
      </div>
    </div>
  )
}
