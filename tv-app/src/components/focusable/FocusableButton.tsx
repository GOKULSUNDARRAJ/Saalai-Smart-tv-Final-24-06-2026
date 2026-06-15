import { useFocusable } from '@noriginmedia/norigin-spatial-navigation'
import type { ReactNode } from 'react'

interface FocusableButtonProps {
  onEnterPress?: () => void
  onArrowPress?: (dir: string) => boolean
  children: ReactNode
  className?: string
  focusKey?: string
  variant?: 'primary' | 'secondary' | 'ghost'
  style?: React.CSSProperties
}

export function FocusableButton({
  onEnterPress,
  onArrowPress,
  children,
  focusKey,
  variant = 'ghost',
  style: extraStyle,
}: FocusableButtonProps) {
  const { ref, focused } = useFocusable({
    focusKey,
    onEnterPress,
    onArrowPress,
  })

  let bg: string
  let color: string
  let border: string

  if (variant === 'primary') {
    bg = focused ? '#ff1f2e' : '#e50914'
    color = '#ffffff'
    border = 'none'
  } else if (variant === 'secondary') {
    bg = focused ? '#ffffff' : 'rgba(255,255,255,0.85)'
    color = '#000000'
    border = 'none'
  } else {
    bg = focused ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.15)'
    color = '#ffffff'
    border = '1px solid rgba(255,255,255,0.4)'
  }

  return (
    <button
      ref={ref}
      onClick={onEnterPress}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: bg,
        color,
        border,
        borderRadius: 8,
        padding: 'clamp(8px, 1vh, 16px) clamp(16px, 2vw, 32px)',
        fontSize: 'clamp(13px, 1.5vh, 18px)',
        fontWeight: 600,
        cursor: 'pointer',
        transform: focused ? 'scale(1.06)' : 'scale(1)',
        transition: 'transform 0.15s, background-color 0.15s',
        outline: 'none',
        whiteSpace: 'nowrap',
        ...extraStyle,
      }}
    >
      {children}
    </button>
  )
}
