import { useEffect, useRef, useState } from 'react'
import { useAppStore } from '../store/appStore'
import { mapKeyEvent, TVKey } from '../platform/keys'
import { callActivationApi } from '../api/activationApi'
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
  const [focusRow, setFocusRow] = useState(0)
  const [focusCol, setFocusCol] = useState(1)
  const [shake, setShake] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const shakeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

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
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        width: '340px',
      }}>

        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{
            width: '40px', height: '40px', background: '#E8232A', borderRadius: '10px',
            display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: '10px', flexShrink: 0,
          }}>
            <svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" style={{ width: '24px', height: '24px', fill: '#fff' }}>
              <rect x="2" y="5" width="28" height="20" rx="3"/>
              <rect x="11" y="26" width="10" height="2" rx="1"/>
              <polygon points="13,10 13,22 23,16" fill="#E8232A"/>
            </svg>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
            <span style={{ fontFamily: "'Bebas Neue', cursive", fontSize: '26px', letterSpacing: '2px', color: '#fff' }}>
              SAALAI <span style={{ color: '#E8232A' }}>TV</span>
            </span>
            <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '9px', fontWeight: 500, letterSpacing: '1.5px', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', marginTop: '2px' }}>
              Stream · Discover · Enjoy
            </span>
          </div>
        </div>

        <div style={{
          color: '#e50914',
          fontSize: '22px',
          fontWeight: 'bold',
          letterSpacing: '3px',
          marginBottom: '6px',
        }}>ACTIVATE YOUR DEVICE</div>

        <div style={{
          color: '#666',
          fontSize: '13px',
          marginBottom: '24px',
        }}>Enter your 6-digit activation PIN</div>

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
                      width: isAction ? '96px' : '76px',
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
    </div>
  )
}
