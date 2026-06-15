import { useEffect } from 'react'
import { FocusContext, useFocusable } from '@noriginmedia/norigin-spatial-navigation'
import { FocusableButton } from '../focusable/FocusableButton'
import { useAppStore } from '../../store/appStore'

export function SubscribePopup() {
  const { isSubscribePopupOpen, closeSubscribePopup } = useAppStore()
  const { focusKey, ref, setFocus } = useFocusable({ focusKey: 'subscribe-popup', isFocusBoundary: true, trackChildren: true })

  useEffect(() => {
    if (isSubscribePopupOpen) {
      const t = setTimeout(() => setFocus('subscribe-ok'), 80)
      return () => clearTimeout(t)
    }
  }, [isSubscribePopupOpen, setFocus])

  useEffect(() => {
    if (!isSubscribePopupOpen) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.keyCode === 4 || e.keyCode === 8 || e.keyCode === 27) {
        e.preventDefault()
        closeSubscribePopup()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [isSubscribePopupOpen, closeSubscribePopup])

  if (!isSubscribePopupOpen) return null

  return (
    <FocusContext.Provider value={focusKey}>
      <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, left: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, backgroundColor: 'rgba(0,0,0,0.8)' }}>
        <div
          ref={ref}
          style={{ backgroundColor: '#1a1a1a', borderRadius: 16, padding: 48, display: 'flex', flexDirection: 'column', alignItems: 'center', maxWidth: 560, width: '100%', margin: '0 32px', border: '1px solid rgba(229,9,20,0.3)' }}
        >
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(229,9,20,0.15)', border: '2px solid #e50914', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#e50914" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          <h2 style={{ fontSize: 'clamp(20px,2.5vw,28px)', fontWeight: 700, color: '#fff', marginBottom: 12, textAlign: 'center' }}>
            Subscription Required
          </h2>
          <p style={{ fontSize: 'clamp(13px,1.6vw,16px)', color: 'rgba(255,255,255,0.65)', marginBottom: 32, textAlign: 'center', lineHeight: 1.6, maxWidth: 400 }}>
            This content is not available on your current plan. Please subscribe to access all channels and movies.
          </p>
          <FocusableButton
            focusKey="subscribe-ok"
            variant="primary"
            onEnterPress={closeSubscribePopup}
            onArrowPress={() => false}
          >
            OK
          </FocusableButton>
        </div>
      </div>
    </FocusContext.Provider>
  )
}
