import { useEffect } from 'react'
import { useFocusable, FocusContext } from '@noriginmedia/norigin-spatial-navigation'
import { FocusableButton } from '../components/focusable/FocusableButton'
import { useAppStore } from '../store/appStore'
import { playNative } from '../platform/nativeVideoPlayer'

export function DetailScreen() {
  const { selectedContent, navigate, goBack, getPreviousScreen } = useAppStore()
  const { ref, focusKey, setFocus } = useFocusable({
    focusKey: 'detail-screen',
    trackChildren: true,
  })

  useEffect(() => {
    setFocus('detail-play')
  }, [setFocus])

  if (!selectedContent) {
    navigate('home')
    return null
  }

  const item = selectedContent

  const handleBack = () => {
    const prev = getPreviousScreen()
    goBack()
    setTimeout(() => {
      const NAV_SCREENS = ['home', 'browse', 'search']
      setFocus(NAV_SCREENS.includes(prev) ? `nav-${prev}` : 'nav-home')
    }, 50)
  }

  const handleUp = () => { setFocus('nav-home'); return false as const }

  return (
    <FocusContext.Provider value={focusKey}>
      <div ref={ref} className="h-full overflow-y-auto scrollbar-hide">
        <div className="relative min-h-full">
          <img
            src={item.backdropUrl}
            alt=""
            style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.25 }}
          />
          <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, background: 'linear-gradient(to right, #0a0a0a 0%, rgba(10,10,10,0.9) 60%, rgba(10,10,10,0.6) 100%)' }} />
          <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, background: 'linear-gradient(to bottom, transparent 0%, transparent 60%, #0a0a0a 100%)' }} />

          <div className="relative z-10 px-safe" style={{ paddingTop: 48, paddingBottom: 80, display: 'flex', flexDirection: 'column', maxWidth: 768 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', marginBottom: 24 }}>
              {item.genre.map((g) => (
                <span key={g} style={{ backgroundColor: 'rgba(229,9,20,0.8)', color: '#fff', fontSize: '0.875rem', padding: '2px 12px', borderRadius: 4, marginRight: 8, marginBottom: 6 }}>
                  {g}
                </span>
              ))}
            </div>

            <h1 className="text-tv-3xl font-bold text-white leading-tight" style={{ marginBottom: 24 }}>
              {item.title}
            </h1>

            <div style={{ display: 'flex', color: 'rgba(255,255,255,0.6)', fontSize: 'clamp(13px,1.4vh,18px)', marginBottom: 24 }}>
              <span>{item.year}</span>
              <span style={{ marginLeft: 8, marginRight: 8 }}>·</span>
              <span>{item.rating}</span>
              <span style={{ marginLeft: 8, marginRight: 8 }}>·</span>
              <span>{Math.floor(item.duration / 60)}h {item.duration % 60}m</span>
            </div>

            <p className="text-tv-base text-white/80 leading-relaxed max-w-2xl" style={{ marginBottom: 24 }}>
              {item.description}
            </p>

            <div style={{ display: 'flex', marginTop: 16 }}>
              <FocusableButton
                focusKey="detail-play"
                variant="primary"
                style={{ marginRight: 16 }}
                onEnterPress={async () => {
                  const launched = await playNative(item.streamUrl, item.title)
                  if (!launched) navigate('player', item)
                }}
                onArrowPress={(dir) => {
                  if (dir === 'up') return handleUp()
                  if (dir === 'down') return false
                  if (dir === 'left') return false
                  if (dir === 'right') { setFocus('detail-back'); return false }
                  return false
                }}
              >
                ▶ Play
              </FocusableButton>
              <FocusableButton
                focusKey="detail-back"
                variant="ghost"
                onEnterPress={handleBack}
                onArrowPress={(dir) => {
                  if (dir === 'up') return handleUp()
                  if (dir === 'down') return false
                  if (dir === 'right') return false
                  if (dir === 'left') { setFocus('detail-play'); return false }
                  return false
                }}
              >
                « Back
              </FocusableButton>
            </div>
          </div>
        </div>
      </div>
    </FocusContext.Provider>
  )
}
