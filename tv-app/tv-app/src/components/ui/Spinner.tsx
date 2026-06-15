interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const SIZE_MAP = {
  sm: 'w-8 h-8 border-4',
  md: 'w-16 h-16 border-4',
  lg: 'w-24 h-24 border-8',
}

export function Spinner({ size = 'md', className = '' }: SpinnerProps) {
  return (
    <div className={`flex items-center justify-center ${className}`}>
      <div
        className={`
          ${SIZE_MAP[size]}
          border-white/20 border-t-white rounded-full animate-spin
        `}
      />
    </div>
  )
}

export function FullScreenSpinner() {
  return (
    <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, left: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0a0a0a' }}>
      <Spinner size="lg" />
    </div>
  )
}

interface SkeletonCardProps {
  width?: number
  height?: number
}

export function SkeletonCard({ width = 280, height = 157 }: SkeletonCardProps) {
  return (
    <div
      style={{ width, height, flexShrink: 0 }}
      className="rounded-lg bg-tv-card animate-pulse"
    />
  )
}
