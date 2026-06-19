import { useEffect, useState } from 'react'
import { fetchMenuItems } from '../api/menuApi'
import { useAppStore } from '../store/appStore'
import { tvStorage } from '../platform/storage'

interface Props {
  onDone: () => void
}

export function SplashScreen({ onDone }: Props) {
  const [phase, setPhase] = useState<'enter' | 'hold' | 'exit'>('enter')
  const setMenuItems = useAppStore((s) => s.setMenuItems)

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('hold'), 600)

    const token = tvStorage.getItem('tv_access_token')
    if (token) {
      fetchMenuItems().then((items) => {
        setMenuItems(items)
      })
    }

    const t2 = setTimeout(() => setPhase('exit'), 2800)
    const t3 = setTimeout(() => onDone(), 3400)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [])

  const containerStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0, left: 0, right: 0, bottom: 0,
    background: '#0a0a0a',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    opacity: phase === 'exit' ? 0 : 1,
    transition: phase === 'exit' ? 'opacity 0.6s ease' : 'none',
  }

  const logoWrapStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    opacity: phase === 'enter' ? 0 : 1,
    transform: phase === 'enter' ? 'scale(0.8)' : 'scale(1)',
    transition: 'opacity 0.6s ease, transform 0.6s ease',
  }

  const iconStyle: React.CSSProperties = {
    width: '96px',
    height: '96px',
    background: '#E8232A',
    borderRadius: '22px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '20px',
    boxShadow: '0 0 60px rgba(232,35,42,0.4)',
  }

  const titleStyle: React.CSSProperties = {
    fontFamily: "'Bebas Neue', cursive",
    fontSize: '52px',
    letterSpacing: '6px',
    color: '#fff',
    lineHeight: 1,
  }

  const taglineStyle: React.CSSProperties = {
    fontFamily: "'DM Sans', sans-serif",
    fontSize: '13px',
    letterSpacing: '4px',
    color: 'rgba(255,255,255,0.4)',
    textTransform: 'uppercase',
    marginTop: '8px',
  }

  const dotsStyle: React.CSSProperties = {
    display: 'flex',
    gap: '8px',
    marginTop: '48px',
    opacity: phase === 'hold' ? 1 : 0,
    transition: 'opacity 0.4s ease',
  }

  return (
    <div style={containerStyle}>
      <div style={logoWrapStyle}>
        <div style={iconStyle}>
          <svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" style={{ width: '54px', height: '54px', fill: '#fff' }}>
            <rect x="2" y="5" width="28" height="20" rx="3" />
            <rect x="11" y="26" width="10" height="2" rx="1" />
            <polygon points="13,10 13,22 23,16" fill="#E8232A" />
          </svg>
        </div>
        <div style={titleStyle}>
          SAALAI <span style={{ color: '#E8232A' }}>TV</span>
        </div>
        <div style={taglineStyle}>Stream · Discover · Enjoy</div>
        <div style={dotsStyle}>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: '#E8232A',
                animation: `splashDot 1.2s ease-in-out ${i * 0.2}s infinite`,
              }}
            />
          ))}
        </div>
      </div>
      <style>{`
        @keyframes splashDot {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.3; }
          40% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  )
}
