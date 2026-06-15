interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function CircularProgress() {
  const r = 38
  const stroke = 9
  const size = (r + stroke) * 2
  const circumference = 2 * Math.PI * r
  const arcLength = circumference * 0.82
  return (
    <div style={{ position: 'relative', width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg
        width={size} height={size}
        style={{ position: 'absolute', top: 0, left: 0, animation: 'spin 1.1s linear infinite' }}
      >
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(50,50,50,0.7)" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none"
          stroke="#e50914"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${arcLength} ${circumference - arcLength}`}
        />
      </svg>
      <span style={{ color: '#fff', fontSize: 8, fontWeight: 700, letterSpacing: 1, zIndex: 1 }}>LOADING</span>
    </div>
  )
}

const SIZE_MAP = {
  sm: 'w-8 h-8 border-4',
  md: 'w-16 h-16 border-4',
  lg: 'w-24 h-24 border-8',
}

export function Spinner({ size = 'md', className = '' }: SpinnerProps) {
  if (size === 'lg') {
    return (
      <div className={`flex items-center justify-center ${className}`}>
        <div style={{
          width: 72, height: 72, borderRadius: '50%',
          border: '8px solid rgba(80,80,80,0.5)',
          borderTopColor: '#e50914',
          animation: 'spin 0.9s linear infinite',
        }} />
      </div>
    )
  }
  return (
    <div className={`flex items-center justify-center ${className}`}>
      <div
        className={`
          ${SIZE_MAP[size]}
          border-red-900/40 border-t-red-600 rounded-full animate-spin
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
