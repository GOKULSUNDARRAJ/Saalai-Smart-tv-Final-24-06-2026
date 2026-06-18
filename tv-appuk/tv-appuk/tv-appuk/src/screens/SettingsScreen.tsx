import { useState, useEffect, useRef, useCallback } from 'react'
import { useFocusable, FocusContext } from '@noriginmedia/norigin-spatial-navigation'
import { useAppStore } from '../store/appStore'
import type { Screen } from '../types/content'

const SECTIONS = [
  {
    title: 'Account',
    items: [
      { id: 'account-plan',   label: 'Subscription Plan',  value: 'Premium',    icon: '★', navigate: 'contactus' as Screen },
      { id: 'account-device', label: 'Device Name',        value: 'My TV',      icon: '📺' },
      { id: 'account-logout', label: 'Sign Out',           value: '',           icon: '⎋', action: true },
    ],
  },
  {
    title: 'About',
    items: [
      { id: 'about-version',  label: 'App Version',        value: '1.0.0',      icon: 'ℹ' },
      { id: 'about-device',   label: 'Platform',           value: 'Android TV', icon: '⊞' },
      { id: 'about-reset',    label: 'Reset Activation',   value: '',           icon: '↺', action: true },
    ],
  },
]

const ALL_ITEMS = SECTIONS.flatMap(s => s.items)

let _settingsSetFocusFn: ((key: string) => void) | null = null
let _settingsRowFocused = false

export function trySettingsBack(): boolean {
  if (_settingsSetFocusFn && _settingsRowFocused) {
    _settingsRowFocused = false
    _settingsSetFocusFn('nav-profile')
    return true
  }
  return false
}

function getFocusKey(id: string) {
  return `settings-row-${id}`
}

interface RowProps {
  id: string
  icon: string
  label: string
  value: string
  action?: boolean
  prevId: string | null
  nextId: string | null
  onActivate: () => void
  onFocused: () => void
}

function SettingRow({ id, icon, label, value, action, prevId, nextId, onActivate, onFocused }: RowProps) {
  const domRef = useRef<HTMLDivElement | null>(null)
  const { ref: focusRef, focused, setFocus } = useFocusable({
    focusKey: getFocusKey(id),
    onEnterPress: onActivate,
    onFocus: onFocused,
    onArrowPress: (dir) => {
      if (dir === 'up' && prevId) {
        setFocus(getFocusKey(prevId))
        return false
      }
      if (dir === 'down' && nextId) {
        setFocus(getFocusKey(nextId))
        return false
      }
      if (dir === 'up' && !prevId) {
        setFocus('nav-profile')
        return false
      }
      return false
    },
  })

  useEffect(() => {
    if (!focused || !domRef.current) return
    if (id === ALL_ITEMS[0].id) {
      let parent = domRef.current.parentElement
      while (parent) {
        const ov = getComputedStyle(parent).overflowY
        if (ov === 'auto' || ov === 'scroll') { parent.scrollTop = 0; return }
        parent = parent.parentElement
      }
      return
    }
    const el = domRef.current
    let parent = el.parentElement
    while (parent) {
      const ov = getComputedStyle(parent).overflowY
      if (ov === 'auto' || ov === 'scroll') break
      parent = parent.parentElement
    }
    if (!parent) return
    const pRect = parent.getBoundingClientRect()
    const eRect = el.getBoundingClientRect()
    const safeBottom = pRect.bottom - 64
    const safeTop = pRect.top + 8
    if (eRect.top < safeTop) {
      parent.scrollTop -= safeTop - eRect.top + 8
    } else if (eRect.bottom > safeBottom) {
      parent.scrollTop += eRect.bottom - safeBottom + 8
    }
  }, [focused])

  const mergedRef = (el: HTMLDivElement | null) => {
    domRef.current = el
    const r = focusRef as unknown
    if (typeof r === 'function') {
      (r as (e: HTMLDivElement | null) => void)(el)
    } else if (r && typeof r === 'object') {
      (r as { current: HTMLDivElement | null }).current = el
    }
  }

  return (
    <div
      ref={mergedRef}
      onClick={onActivate}
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '14px 20px',
        borderRadius: '10px',
        marginBottom: '6px',
        background: focused ? 'rgba(229,9,20,0.18)' : 'rgba(255,255,255,0.04)',
        border: focused ? '1px solid rgba(229,9,20,0.5)' : '1px solid transparent',
        cursor: 'pointer',
        transition: 'background 0.15s, border-color 0.15s',
      }}
    >
      {icon ? (
        <span style={{ fontSize: '18px', marginRight: '14px', width: '24px', textAlign: 'center' }}>{icon}</span>
      ) : null}
      <span style={{
        flex: 1,
        color: action ? (focused ? '#ff6b6b' : '#e05050') : '#fff',
        fontSize: '15px',
        fontWeight: 500,
      }}>
        {label}
      </span>
      {value ? (
        <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: '14px', marginLeft: '12px' }}>{value}</span>
      ) : null}
      {focused && !action && (
        <span style={{ color: '#e50914', fontSize: '14px', marginLeft: '12px' }}>›</span>
      )}
    </div>
  )
}

interface ConfirmDialogProps {
  title: string
  message: string
  confirmLabel: string
  onConfirm: () => void
  onCancel: () => void
}

function ConfirmDialog({ title, message, confirmLabel, onConfirm, onCancel }: ConfirmDialogProps) {
  const [active, setActive] = useState<'cancel' | 'confirm'>('cancel')
  const activeRef = useRef(active)
  activeRef.current = active
  const onCancelRef = useRef(onCancel)
  onCancelRef.current = onCancel
  const onConfirmRef = useRef(onConfirm)
  onConfirmRef.current = onConfirm

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const k = e.keyCode
      if (k === 27 || k === 4 || k === 10009 || k === 461) {
        e.preventDefault()
        e.stopImmediatePropagation()
        onCancelRef.current()
        return
      }
      if (k === 37) {
        e.preventDefault()
        e.stopImmediatePropagation()
        setActive('cancel')
        return
      }
      if (k === 39) {
        e.preventDefault()
        e.stopImmediatePropagation()
        setActive('confirm')
        return
      }
      if (k === 13) {
        e.preventDefault()
        e.stopImmediatePropagation()
        if (activeRef.current === 'cancel') onCancelRef.current()
        else onConfirmRef.current()
        return
      }
      if (k === 38 || k === 40) {
        e.preventDefault()
        e.stopImmediatePropagation()
      }
    }
    window.addEventListener('keydown', handler, true)
    return () => window.removeEventListener('keydown', handler, true)
  }, [])

  const btnBase: React.CSSProperties = {
    padding: '11px 28px',
    borderRadius: '8px',
    fontSize: '15px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.12s',
    minWidth: '110px',
  }

  return (
    <div
      onClick={onCancel}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'rgba(0,0,0,0.82)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#1c1c1c',
          borderRadius: '16px',
          padding: '36px 40px',
          minWidth: '360px',
          maxWidth: '480px',
          border: '1px solid rgba(255,255,255,0.1)',
          boxShadow: '0 24px 72px rgba(0,0,0,0.85)',
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: '36px', marginBottom: '14px' }}>⚠</div>
        <h2 style={{ color: '#fff', fontSize: '18px', fontWeight: 700, margin: '0 0 10px' }}>{title}</h2>
        <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '14px', margin: '0 0 28px', lineHeight: 1.6 }}>{message}</p>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
          <button
            onClick={onCancel}
            style={{
              ...btnBase,
              border: active === 'cancel' ? '2px solid rgba(255,255,255,0.6)' : '2px solid rgba(255,255,255,0.2)',
              background: active === 'cancel' ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.06)',
              color: '#fff',
              transform: active === 'cancel' ? 'scale(1.06)' : 'scale(1)',
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            style={{
              ...btnBase,
              border: 'none',
              background: active === 'confirm' ? '#e50914' : 'rgba(229,9,20,0.55)',
              color: '#fff',
              fontWeight: 700,
              transform: active === 'confirm' ? 'scale(1.06)' : 'scale(1)',
              boxShadow: active === 'confirm' ? '0 0 0 2px rgba(229,9,20,0.45)' : 'none',
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

export function SettingsScreen() {
  const { navigate, logout } = useAppStore()
  const [dialog, setDialog] = useState<{ type: 'logout' | 'reset' } | null>(null)
  const dialogTypeRef = useRef<'logout' | 'reset' | null>(null)
  const { ref, focusKey, setFocus } = useFocusable({ focusKey: 'settings-screen', trackChildren: true })

  useEffect(() => {
    _settingsSetFocusFn = setFocus
    return () => { _settingsSetFocusFn = null }
  }, [setFocus])

  useEffect(() => {
    const t = setTimeout(() => setFocus('settings-row-account-plan'), 80)
    return () => clearTimeout(t)
  }, [setFocus])

  const handleActivate = useCallback((id: string) => {
    if (id === 'account-logout') {
      dialogTypeRef.current = 'logout'
      setDialog({ type: 'logout' })
      return
    }
    if (id === 'about-reset') {
      dialogTypeRef.current = 'reset'
      setDialog({ type: 'reset' })
      return
    }
    const allItems = SECTIONS.flatMap(s => s.items)
    const item = allItems.find(i => i.id === id)
    if (item && 'navigate' in item && item.navigate) {
      navigate(item.navigate)
    }
  }, [navigate])

  const handleConfirm = useCallback(() => {
    setDialog(null)
    dialogTypeRef.current = null
    logout()
  }, [logout])

  const handleCancel = useCallback(() => {
    const type = dialogTypeRef.current
    setDialog(null)
    dialogTypeRef.current = null
    setTimeout(() => {
      if (type === 'logout') setFocus('settings-row-account-logout')
      else setFocus('settings-row-about-reset')
    }, 50)
  }, [setFocus])

  return (
    <FocusContext.Provider value={focusKey}>
      <div ref={ref} className="h-full overflow-y-auto overflow-x-hidden scrollbar-hide">
        <div style={{
          background: 'transparent',
          paddingLeft: '5vw', paddingRight: '5vw',
          paddingTop: 'clamp(14px, 2.5vh, 28px)',
          paddingBottom: 'clamp(8px, 1.5vh, 12px)',
        }}>
          <h1 className="text-tv-3xl font-bold text-white leading-tight">⚙ Settings</h1>
          <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '13px', marginTop: '4px', marginBottom: '12px' }}>
            App preferences and account
          </p>

          {/* Expiration Warning Alert Banner (Mock UI) */}
          <div style={{
            marginTop: 16,
            marginBottom: 8,
            padding: '12px 20px',
            borderRadius: 12,
            background: 'linear-gradient(90deg, rgba(229,9,20,0.15) 0%, rgba(229,9,20,0.05) 100%)',
            border: '1px solid rgba(229,9,20,0.4)',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{ color: '#e50914', flexShrink: 0 }}>
              <path d="M12 9V14M12 17.01L12.01 16.998M12 3L2 21H22L12 3Z" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <div style={{ color: '#fff', fontSize: 13, fontWeight: 500 }}>
              Your subscription package will expire in <span style={{ color: '#e50914', fontWeight: 700 }}>5 days</span>. Please renew to continue uninterrupted streaming.
            </div>
          </div>
        </div>

        <div style={{ paddingLeft: '5vw', paddingRight: '5vw', paddingBottom: '64px' }}>
          {SECTIONS.map((section, si) => {
            const sectionStartIdx = SECTIONS.slice(0, si).reduce((n, s) => n + s.items.length, 0)
            return (
              <div key={section.title} style={{ marginBottom: '28px' }}>
                <div style={{
                  color: '#e50914',
                  fontSize: '11px',
                  fontWeight: 700,
                  letterSpacing: '2px',
                  textTransform: 'uppercase',
                  marginBottom: '10px',
                  paddingLeft: '4px',
                }}>
                  {section.title}
                </div>
                {section.items.map((item, ii) => {
                  const globalIdx = sectionStartIdx + ii
                  const prevItem = ALL_ITEMS[globalIdx - 1] ?? null
                  const nextItem = ALL_ITEMS[globalIdx + 1] ?? null
                  return (
                    <SettingRow
                      key={item.id}
                      id={item.id}
                      icon={item.icon}
                      label={item.label}
                      value={item.value}
                      action={item.action}
                      prevId={prevItem?.id ?? null}
                      nextId={nextItem?.id ?? null}
                      onActivate={() => handleActivate(item.id)}
                      onFocused={() => { _settingsRowFocused = true }}
                    />
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>

      {dialog && (
        <ConfirmDialog
          title={dialog.type === 'logout' ? 'Sign Out' : 'Reset Activation'}
          message={
            dialog.type === 'logout'
              ? 'Are you sure you want to sign out? You will need to re-enter your credentials.'
              : 'Are you sure you want to reset activation? You will need to enter the activation code again.'
          }
          confirmLabel={dialog.type === 'logout' ? 'Sign Out' : 'Reset'}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      )}
    </FocusContext.Provider>
  )
}
