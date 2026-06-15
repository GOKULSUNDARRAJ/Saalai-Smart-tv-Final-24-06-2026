import { useState, useEffect } from 'react'

interface BannerSliderProps {
  banners: string[]
}

const INTERVAL = 5000

export function BannerSlider({ banners }: BannerSliderProps) {
  const [activeIndex, setActiveIndex] = useState(0)

  useEffect(() => {
    if (banners.length < 2) return
    const t = setInterval(() => setActiveIndex(prev => (prev + 1) % banners.length), INTERVAL)
    return () => clearInterval(t)
  }, [banners.length])

  if (banners.length === 0) return null

  return (
    <div style={{ position: 'relative', width: '100%', height: 'clamp(160px, 35vh, 440px)', overflow: 'hidden', flexShrink: 0 }}>
      {banners.map((src, idx) => (
        <img
          key={src}
          src={src}
          alt=""
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            opacity: idx === activeIndex ? 1 : 0,
            transition: 'opacity 0.7s ease',
          }}
        />
      ))}
      <div style={{ position: 'absolute', bottom: 12, right: '5vw', display: 'flex', gap: 8 }}>
        {banners.map((_, idx) => (
          <div
            key={idx}
            style={{
              height: 6,
              borderRadius: 3,
              backgroundColor: idx === activeIndex ? '#e50914' : 'rgba(255,255,255,0.35)',
              width: idx === activeIndex ? 28 : 8,
              transition: 'width 0.3s, background-color 0.3s',
            }}
          />
        ))}
      </div>
    </div>
  )
}
