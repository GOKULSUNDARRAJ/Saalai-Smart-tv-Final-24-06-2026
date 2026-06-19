import { useEffect, useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useFocusable, FocusContext } from '@noriginmedia/norigin-spatial-navigation'
import ApkUpdater from '../../plugins/ApkUpdater'

interface UpdateModalProps {
  title: string
  version: string
  apkUrl: string
  onClose: () => void
}

export function UpdateModal({ title, version, apkUrl, onClose }: UpdateModalProps) {
  const [isDownloading, setIsDownloading] = useState(false)
  const [downloadProgress, setDownloadProgress] = useState<number>(0)

  const { ref: containerRef, setFocus, focusKey } = useFocusable({
    focusKey: 'update-modal',
    trackChildren: true,
    isFocusBoundary: true,
  })

  const handleUpdate = async () => {
    if (isDownloading) return
    try {
      const { granted } = await ApkUpdater.checkInstallPermission().catch(() => ({ granted: true }))
      if (!granted) {
        localStorage.setItem('pending_update_install', 'true')
      }
      
      setIsDownloading(true)
      setDownloadProgress(0)
      
      const listener = await ApkUpdater.addListener('onProgress', (info: any) => {
        setDownloadProgress(info.progress)
      })

      await ApkUpdater.downloadAndInstall({ url: apkUrl, version: version })
      
      // When it succeeds (e.g. file already existed or finished downloading)
      setDownloadProgress(100)
      
      if (!granted) {
        // If they didn't have permission, they were likely just sent to Settings.
        // Setup a one-time resume when they come back.
        const handleVis = async () => {
          if (document.visibilityState === 'visible') {
            document.removeEventListener('visibilitychange', handleVis)
            const check = await ApkUpdater.checkInstallPermission().catch(() => ({ granted: false }))
            if (check.granted) {
              // They granted it! Re-trigger installation.
              setTimeout(() => {
                handleUpdate()
              }, 500)
            }
          }
        }
        document.addEventListener('visibilitychange', handleVis)
        // Clean up if the modal closes before they return
        setTimeout(() => document.removeEventListener('visibilitychange', handleVis), 60000)
      }

      setTimeout(() => {
        setIsDownloading(false)
        listener.remove()
      }, 1500)
      
    } catch (e) {
      console.error('Update failed:', e)
      setIsDownloading(false)
    }
  }

  useEffect(() => {
    // If the OS killed the app when the user granted permission, we can check localStorage
    // to auto-resume the installation on boot.
    if (localStorage.getItem('pending_update_install') === 'true') {
      localStorage.removeItem('pending_update_install')
      ApkUpdater.checkInstallPermission().then(check => {
        if (check.granted) {
          // Auto-resume since they just granted permission and came back
          setTimeout(() => {
            handleUpdate()
          }, 800)
        }
      }).catch(() => {})
    }
  }, [])

  const { ref: updateRef, focused: updateFocused } = useFocusable({
    focusKey: 'update-btn',
    onEnterPress: handleUpdate,
    onArrowPress: (dir) => {
      if (isDownloading) return false
      if (dir === 'down') { setFocus('close-btn'); return false; }
      if (dir === 'up') return false;
      if (dir === 'left') return false;
      if (dir === 'right') return false;
      return true;
    }
  })

  const { ref: closeRef, focused: closeFocused } = useFocusable({
    focusKey: 'close-btn',
    onEnterPress: () => {
      if (!isDownloading) onClose()
    },
    onArrowPress: (dir) => {
      if (isDownloading) return false
      if (dir === 'up') { setFocus('update-btn'); return false; }
      if (dir === 'down') return false;
      if (dir === 'left') return false;
      if (dir === 'right') return false;
      return true;
    }
  })

  useEffect(() => {
    const t1 = setTimeout(() => setFocus('update-btn'), 100)
    const t2 = setTimeout(() => setFocus('update-btn'), 300)
    const t3 = setTimeout(() => setFocus('update-btn'), 600)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [setFocus])
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const k = e.keyCode
      if (k === 27 || k === 4 || k === 10009 || k === 461) {
        if (!isDownloading) {
          e.preventDefault()
          e.stopImmediatePropagation()
          onCloseRef.current()
        }
      }
    }
    window.addEventListener('keydown', handler, true)
    return () => window.removeEventListener('keydown', handler, true)
  }, [isDownloading])

  if (typeof document === 'undefined' || !document.body) return null

  return createPortal(
    <FocusContext.Provider value={focusKey}>
      <div
        style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.85)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
        }}
      >
        <div
          ref={containerRef}
        style={{
          background: '#1a1a1a',
          padding: 40,
          borderRadius: 16,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          boxShadow: '0 12px 48px rgba(0,0,0,0.8)',
          maxWidth: 400,
          textAlign: 'center',
        }}
      >
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 'bold' }}>Update Available</h1>
        <p style={{ marginTop: 12, marginBottom: 32, fontSize: 16, color: '#aaa' }}>
          {title} {version} is available. Would you like to update now?
        </p>

        <button
          ref={updateRef}
          onClick={handleUpdate}
          style={{
            background: updateFocused ? '#fff' : '#333',
            color: updateFocused ? '#000' : '#fff',
            border: 'none',
            padding: '12px 32px',
            borderRadius: 8,
            fontSize: 16,
            fontWeight: 'bold',
            marginBottom: 12,
            width: '100%',
            transform: updateFocused ? 'scale(1.05)' : 'scale(1)',
            transition: 'all 0.2s',
          }}
        >
          {isDownloading ? `Downloading... ${downloadProgress}%` : 'Update Now'}
        </button>

        <button
          ref={closeRef}
          style={{
            background: closeFocused ? '#E50914' : 'transparent',
            color: '#fff',
            border: closeFocused ? '2px solid transparent' : '2px solid #555',
            padding: '10px 32px',
            borderRadius: 8,
            fontSize: 16,
            fontWeight: 'bold',
            width: '100%',
            transform: closeFocused ? 'scale(1.05)' : 'scale(1)',
            transition: 'all 0.2s',
          }}
        >
          Later
        </button>
      </div>
    </div>
    </FocusContext.Provider>,
    document.body
  )
}
