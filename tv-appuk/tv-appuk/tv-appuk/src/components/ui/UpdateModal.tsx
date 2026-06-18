import { useEffect, useState } from 'react'
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

  const { ref: updateRef, focused: updateFocused } = useFocusable({
    focusKey: 'update-btn',
    onEnterPress: async () => {
      if (isDownloading) return
      try {
        setIsDownloading(true)
        setDownloadProgress(0)
        
        const listener = await ApkUpdater.addListener('onProgress', (info: any) => {
          setDownloadProgress(info.progress)
        })

        await ApkUpdater.downloadAndInstall({ url: apkUrl, version: version })
        
        // When it succeeds (e.g. file already existed or finished downloading)
        setDownloadProgress(100)
        setTimeout(() => {
          setIsDownloading(false)
          listener.remove()
        }, 1500)
        
      } catch (e) {
        console.error('Update failed:', e)
        setIsDownloading(false)
      }
    },
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
