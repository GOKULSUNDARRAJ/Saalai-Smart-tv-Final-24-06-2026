import { BASE_URL } from '../api/apiUtils';
import { useEffect, useRef, useState } from 'react'
import { useAppStore } from '../store/appStore'
import { mapKeyEvent, TVKey } from '../platform/keys'
import { callActivationApi, getOrCreateDeviceId } from '../api/activationApi'
import { fetchMenuItems } from '../api/menuApi'

const PAD_KEYS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['DEL', '0', 'OK'],
]

const PIN_LENGTH = 6

export function ActivationScreen() {
  const { setActivated, setMenuItems } = useAppStore()
  const [pin, setPin] = useState<string[]>([])
  const deviceId = getOrCreateDeviceId()
  const [focusRow, setFocusRow] = useState(0)
  const [focusCol, setFocusCol] = useState(1)
  const [shake, setShake] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [qrUrl, setQrUrl] = useState('')
  const shakeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let stopped = false

    async function pollQR() {
      while (!stopped) {
        try {
          const formData = new FormData()
          formData.append('token', deviceId)
          const res = await fetch(BASE_URL + '/QRCode', {
            method: 'POST',
            body: formData,
          })
          const data = await res.json()
          console.log('QRCODE_POLL:', JSON.stringify(data))

          if (data.result === 'true' || data.result === true) {
            const targetUrl = data.response?.qrCodeURL ?? ''
            // Set QR image on first successful response
            if (targetUrl && !qrUrl) {
              setQrUrl(`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(targetUrl)}&bgcolor=ffffff&color=000000&margin=4`)
            }

            const status = data.response?.status
            const code = data.response?.activationCode
            // status=1 means QR was scanned and activation code is ready
            if ((status === 1 || status === '1') && code) {
              console.log('QR_ACTIVATION_CODE:', code)
              stopped = true
              // Auto-activate with the returned activation code
              setLoading(true)
              const result = await callActivationApi(code)
              setLoading(false)
              if (result.success) {
                setSuccess(true)
                const items = await fetchMenuItems()
                setMenuItems(items)
                setActivated()
              } else {
                setError(result.message)
              }
              return
            }
          }
        } catch (err) {
          console.error('QRCode poll error:', err)
        }
        // Wait 2 seconds before next poll
        await new Promise(r => setTimeout(r, 2000))
      }
    }

    pollQR()
    return () => { stopped = true }
  }, [deviceId])

  async function submitPin(code: string) {
    setLoading(true)
    setError('')
    const result = await callActivationApi(code)
    setLoading(false)
    if (result.success) {
      setSuccess(true)
      const items = await fetchMenuItems()
      setMenuItems(items)
      setActivated()
    } else {
      setPin([])
      triggerShake(result.message)
    }
  }

  function pressKey(key: string) {
    if (loading) return
    setError('')
    if (key === 'DEL') {
      setPin(prev => prev.slice(0, -1))
      return
    }
    if (key === 'OK') {
      if (pin.length < PIN_LENGTH) {
        triggerShake('Please enter all 6 digits')
        return
      }
      void submitPin(pin.join(''))
      return
    }
    if (pin.length >= PIN_LENGTH) return
    setPin(prev => [...prev, key])
  }

  function triggerShake(msg: string) {
    setError(msg)
    setShake(true)
    if (shakeTimer.current) clearTimeout(shakeTimer.current)
    shakeTimer.current = setTimeout(() => setShake(false), 500)
  }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tv = mapKeyEvent(e)
      if (tv === TVKey.UP) {
        e.preventDefault()
        setFocusRow(r => Math.max(0, r - 1))
      } else if (tv === TVKey.DOWN) {
        e.preventDefault()
        setFocusRow(r => Math.min(PAD_KEYS.length - 1, r + 1))
      } else if (tv === TVKey.LEFT) {
        e.preventDefault()
        setFocusCol(c => Math.max(0, c - 1))
      } else if (tv === TVKey.RIGHT) {
        e.preventDefault()
        setFocusCol(c => Math.min(2, c + 1))
      } else if (tv === TVKey.OK) {
        e.preventDefault()
        pressKey(PAD_KEYS[focusRow][focusCol])
      } else if (tv === TVKey.BACK) {
        e.preventDefault()
        setPin(prev => prev.slice(0, -1))
        setError('')
      } else if (/^[0-9]$/.test(e.key)) {
        e.preventDefault()
        pressKey(e.key)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [focusRow, focusCol, pin])

  useEffect(() => () => {
    if (shakeTimer.current) clearTimeout(shakeTimer.current)
  }, [])

  return (
    <div style={{
      position: 'fixed',
      top: 0, right: 0, bottom: 0, left: 0,
      background: 'linear-gradient(135deg, #0a0a0a 0%, #1a0808 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <div style={{ display: 'flex', alignItems: 'stretch', gap: '40px' }}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          width: '340px',
          background: 'rgba(255,255,255,0.03)',
          border: '1px dashed rgba(255,255,255,0.15)',
          borderRadius: '16px',
          padding: '32px 24px',
          textAlign: 'center',
        }}>

          <div style={{
            color: 'rgba(255,255,255,0.5)',
            fontSize: '14px',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '2px',
            marginBottom: '20px'
          }}>
            Enter Activation PIN
          </div>

        <div style={{
          display: 'flex',
          marginBottom: '8px',
          animation: shake ? 'tv-shake 0.5s ease' : 'none',
        }}>
          {Array.from({ length: PIN_LENGTH }).map((_, i) => (
            <div key={i} style={{
              width: '44px',
              height: '54px',
              borderRadius: '8px',
              border: i < pin.length ? '2px solid #e50914' : '2px solid #333',
              background: i < pin.length ? '#1f0505' : '#111',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '26px',
              color: '#fff',
              transition: 'border-color 0.15s',
              marginRight: i < PIN_LENGTH - 1 ? '10px' : '0',
            }}>
              {i < pin.length ? '●' : ''}
            </div>
          ))}
        </div>

        <div style={{
          height: '20px',
          marginBottom: '18px',
          color: '#e50914',
          fontSize: '13px',
          textAlign: 'center',
        }}>
          {error}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {PAD_KEYS.map((row, ri) => (
            <div key={ri} style={{ display: 'flex', marginBottom: ri < PAD_KEYS.length - 1 ? '12px' : '0' }}>
              {row.map((key, ci) => {
                const isFocused = focusRow === ri && focusCol === ci
                const isAction = key === 'DEL' || key === 'OK'
                const isOk = key === 'OK'
                return (
                  <button
                    key={key}
                    onClick={() => pressKey(key)}
                    style={{
                      width: '76px',
                      height: '54px',
                      borderRadius: '8px',
                      border: 'none',
                      background: isFocused
                        ? (isOk ? '#e50914' : '#d8d8d8')
                        : (isAction ? '#252525' : '#1c1c1c'),
                      color: isFocused
                        ? (isOk ? '#fff' : '#111')
                        : (isAction ? '#999' : '#fff'),
                      fontSize: isAction ? '13px' : '22px',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      outline: 'none',
                      transform: isFocused ? 'scale(1.07)' : 'scale(1)',
                      transition: 'transform 0.1s, background 0.1s, color 0.1s',
                      boxShadow: isFocused
                        ? '0 0 0 3px rgba(229,9,20,0.5)'
                        : 'none',
                      marginRight: ci < row.length - 1 ? '12px' : '0',
                    }}
                  >
                    {key === 'DEL' ? '⌫ DEL' : key}
                  </button>
                )
              })}
            </div>
          ))}
        </div>

        {loading && (
          <div style={{
            marginTop: '16px',
            color: '#e5b200',
            fontSize: '14px',
            fontWeight: 'bold',
          }}>Verifying…</div>
        )}

        {success && !loading && (
          <div style={{
            marginTop: '16px',
            color: '#4caf50',
            fontSize: '15px',
            fontWeight: 'bold',
          }}>✓ Activated! Loading…</div>
        )}
        </div>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'rgba(255,255,255,0.4)',
          fontSize: '18px',
          fontWeight: 'bold',
          letterSpacing: '2px',
        }}>
          OR
        </div>

        {/* QR Code Display */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          width: '340px',
          background: 'rgba(255,255,255,0.03)',
          border: '1px dashed rgba(255,255,255,0.15)',
          borderRadius: '16px',
          padding: '32px 24px',
          textAlign: 'center'
        }}>
          <div style={{
            color: 'rgba(255,255,255,0.5)',
            fontSize: '14px',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '2px',
            marginBottom: '20px'
          }}>
            Scan to Activate
          </div>
          <div style={{
            background: '#fff',
            borderRadius: '12px',
            padding: '10px',
            display: 'inline-flex',
          }}>
            {qrUrl ? (
              <img
                src={qrUrl}
                alt="Device QR Code"
                width={200}
                height={200}
                style={{ display: 'block', borderRadius: '4px' }}
                onError={(e) => {
                  const img = e.currentTarget
                  if (!img.dataset.fallback) {
                    img.dataset.fallback = '1'
                    img.src = `https://chart.googleapis.com/chart?chs=200x200&cht=qr&chl=${encodeURIComponent(deviceId)}&choe=UTF-8`
                  }
                }}
              />
            ) : (
              <div style={{ width: 200, height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999', fontSize: 13 }}>Loading QR…</div>
            )}
          </div>
          <div style={{
            color: 'rgba(255,255,255,0.3)',
            fontSize: '12px',
            marginTop: '20px',
            lineHeight: 1.5
          }}>
            Scan this QR code to identify your device or share with support.
          </div>
        </div>
      </div>

        <style>{`
          @keyframes tv-shake {
            0%,100% { transform: translateX(0); }
            20%      { transform: translateX(-8px); }
            40%      { transform: translateX(8px); }
            60%      { transform: translateX(-5px); }
            80%      { transform: translateX(5px); }
          }
        `}</style>
    </div>
  )
}
