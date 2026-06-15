import { useEffect } from 'react'
import { FocusContext, useFocusable } from '@noriginmedia/norigin-spatial-navigation'
import { FocusableButton } from '../focusable/FocusableButton'
import { exitApp } from '../../platform/exit'
import { useAppStore } from '../../store/appStore'

export function ExitDialog() {
  const { isExitDialogOpen, closeExitDialog } = useAppStore()
  const { focusKey, ref, setFocus } = useFocusable({ focusKey: 'exit-dialog', isFocusBoundary: true, trackChildren: true })

  useEffect(() => {
    if (isExitDialogOpen) {
      const t = setTimeout(() => setFocus('exit-cancel'), 80)
      return () => clearTimeout(t)
    }
  }, [isExitDialogOpen, setFocus])

  useEffect(() => {
    if (!isExitDialogOpen) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.keyCode === 4 || e.keyCode === 8 || e.keyCode === 27) {
        e.preventDefault()
        closeExitDialog()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [isExitDialogOpen, closeExitDialog])

  if (!isExitDialogOpen) return null

  return (
    <FocusContext.Provider value={focusKey}>
      <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, left: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, backgroundColor: 'rgba(0,0,0,0.7)' }}>
        <div
          ref={ref}
          style={{ backgroundColor: '#1a1a1a', borderRadius: 16, padding: 48, display: 'flex', flexDirection: 'column', alignItems: 'center', maxWidth: 512, width: '100%', margin: '0 32px' }}
        >
          <h2 className="text-tv-xl font-bold text-white" style={{ marginBottom: 16 }}>Exit App?</h2>
          <p className="text-tv-base text-center" style={{ color: 'rgba(255,255,255,0.7)', marginBottom: 32 }}>
            Are you sure you want to exit?
          </p>
          <div style={{ display: 'flex' }}>
            <FocusableButton
              focusKey="exit-cancel"
              variant="ghost"
              style={{ marginRight: 24 }}
              onEnterPress={closeExitDialog}
              onArrowPress={(dir) => {
                if (dir === 'right') { setFocus('exit-confirm'); return false }
                if (dir === 'up' || dir === 'down' || dir === 'left') return false
                return false
              }}
            >
              Cancel
            </FocusableButton>
            <FocusableButton
              focusKey="exit-confirm"
              variant="primary"
              onEnterPress={exitApp}
              onArrowPress={(dir) => {
                if (dir === 'left') { setFocus('exit-cancel'); return false }
                if (dir === 'up' || dir === 'down' || dir === 'right') return false
                return false
              }}
            >
              Exit
            </FocusableButton>
          </div>
        </div>
      </div>
    </FocusContext.Provider>
  )
}
