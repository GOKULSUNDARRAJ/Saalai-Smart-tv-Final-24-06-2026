import { useState, useEffect, useRef, useCallback } from 'react'
import { useFocusable, FocusContext } from '@noriginmedia/norigin-spatial-navigation'
import { useAppStore } from '../store/appStore'
import packageJson from '../../package.json'
import { UpdateModal } from '../components/ui/UpdateModal'
import type { Screen } from '../types/content'
import { getMyProfile, getTVVersion, type ProfileResponse, type VersionResponse } from '../api/authApi'

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
  isFirst: boolean
  upId: string | null
  downId: string | null
  leftId: string | null
  rightId: string | null
  onActivate: () => void
  onFocused: () => void
}

function SettingRow({ id, icon, label, value, action, isFirst, upId, downId, leftId, rightId, onActivate, onFocused }: RowProps) {
  const domRef = useRef<HTMLDivElement | null>(null)
  const { ref: focusRef, focused, setFocus } = useFocusable({
    focusKey: getFocusKey(id),
    onEnterPress: onActivate,
    onFocus: onFocused,
    onArrowPress: (dir) => {
      if (dir === 'up') {
        if (upId === 'nav-profile') { setFocus('nav-profile'); return false }
        if (upId) { setFocus(getFocusKey(upId)); return false }
        return false 
      }
      if (dir === 'down') {
        if (downId) { setFocus(getFocusKey(downId)); return false }
        return false 
      }
      if (dir === 'left') {
        if (leftId) { setFocus(getFocusKey(leftId)); return false }
        return false 
      }
      if (dir === 'right') {
        if (rightId) { setFocus(getFocusKey(rightId)); return false }
        return false
      }
      return true
    },
  })

  useEffect(() => {
    if (!focused || !domRef.current) return
    if (isFirst) {
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
  showCancel?: boolean
}

function ConfirmDialog({ title, message, confirmLabel, onConfirm, onCancel, showCancel = true }: ConfirmDialogProps) {
  const [active, setActive] = useState<'cancel' | 'confirm'>(showCancel ? 'cancel' : 'confirm')
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
        if (showCancel) setActive('cancel')
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
  }, [showCancel])

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
        top: 0, left: 0, right: 0, bottom: 0,
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
        <div style={{ fontSize: '36px', marginBottom: '14px' }}>{showCancel ? '⚠' : 'ℹ'}</div>
        <h2 style={{ color: '#fff', fontSize: '18px', fontWeight: 700, margin: '0 0 10px' }}>{title}</h2>
        <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '14px', margin: '0 0 28px', lineHeight: 1.6 }}>{message}</p>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
          {showCancel && (
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
          )}
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
  const [profile, setProfile] = useState<ProfileResponse['response'] | null>(null)
  const [dialog, setDialog] = useState<{ type: 'logout' | 'reset' | 'update' | 'checking' | 'uptodate' | 'error' } | null>(null)
  const dialogTypeRef = useRef<'logout' | 'reset' | 'update' | 'checking' | 'uptodate' | 'error' | null>(null)
  const [updateInfo, setUpdateInfo] = useState<VersionResponse | null>(null)
  const { ref, focusKey, setFocus } = useFocusable({ focusKey: 'settings-screen', trackChildren: true })

  useEffect(() => {
    _settingsSetFocusFn = setFocus
    return () => { _settingsSetFocusFn = null }
  }, [setFocus])

  useEffect(() => {
    getMyProfile().then(res => {
      if (res && res.status && res.response) {
        setProfile(res.response)
      }
    })
  }, [])

  useEffect(() => {
    const t = setTimeout(() => setFocus('settings-row-account-profile'), 80)
    return () => clearTimeout(t)
  }, [setFocus])

  const sections = [
    {
      title: 'Account',
      items: [
        { id: 'account-profile', label: 'Profile Name',      value: profile?.userName || 'Loading...', icon: '👤' },
        { id: 'account-device',  label: 'Device Box ID',     value: profile?.boxId ? String(profile.boxId) : '-', icon: '📺' },
        { id: 'account-mobile',  label: 'Mobile',            value: profile?.userMobile || '-', icon: '📱' },
        { id: 'account-activate',label: 'Activation Date',   value: profile?.activationDate || '-', icon: '📅' },
        { id: 'account-email',   label: 'Email',             value: profile?.userEmail || '-', icon: '✉' },
        { id: 'account-expire',  label: 'Subscription Ends', value: profile?.expireDate || '-', icon: '★' },
        { id: 'account-logout',  label: 'Sign Out',          value: '',           icon: '⎋', action: true },
        { id: 'account-contactus', label: 'Contact Support', value: '',           icon: '📞', action: true },
      ],
    },
    {
      title: 'About',
      items: [
        { id: 'about-version',  label: 'App Version',        value: packageJson.version,      icon: 'ℹ' },
        { id: 'about-device',   label: 'Platform',           value: 'Android TV', icon: '⊞' },
        { id: 'about-update',   label: 'Update Version',     value: '', icon: '🔄', action: true },
      ],
    },
  ]
  const allItems = sections.flatMap(s => s.items)

  const handleActivate = useCallback((id: string) => {
    if (id === 'account-contactus') {
      navigate('contactus')
      return
    }
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
    if (id === 'about-update') {
      dialogTypeRef.current = 'checking'
      setDialog({ type: 'checking' })
      getTVVersion().then(res => {
        if (res && res.result === 'true' && res.response) {
          const appVer = packageJson.version
          const apiVer = res.response.version
          
          const v1 = apiVer.split('.').map(Number)
          const v2 = appVer.split('.').map(Number)
          let isNewer = false
          for (let i = 0; i < Math.max(v1.length, v2.length); i++) {
            const num1 = v1[i] || 0
            const num2 = v2[i] || 0
            if (num1 > num2) { isNewer = true; break }
            if (num1 < num2) { break }
          }

          if (isNewer) {
            setUpdateInfo(res)
            dialogTypeRef.current = 'update'
            setDialog({ type: 'update' })
          } else {
            dialogTypeRef.current = 'uptodate'
            setDialog({ type: 'uptodate' })
          }
        } else {
          dialogTypeRef.current = 'error'
          setDialog({ type: 'error' })
        }
      }).catch(() => {
        dialogTypeRef.current = 'error'
        setDialog({ type: 'error' })
      })
      return
    }
  }, [navigate, logout])

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
      else if (type === 'update') setFocus('settings-row-about-update')
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
          <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '20px', marginTop: '4px', marginBottom: '12px' }}>
            App preferences and account
          </p>
        </div>
        <div style={{ paddingLeft: '5vw', paddingRight: '5vw', paddingBottom: '64px' }}>
          {sections.map((section, si) => {
            const sectionStartIdx = sections.slice(0, si).reduce((n, s) => n + s.items.length, 0)
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
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: '12px',
                }}>
                  {section.items.map((item, ii) => {
                    const globalIdx = sectionStartIdx + ii
                    
                    let upId = null
                    if (ii >= 2) upId = section.items[ii - 2].id
                    else if (si > 0) upId = sections[si - 1].items[sections[si - 1].items.length - 1].id
                    else upId = 'nav-profile'

                    let downId = null
                    if (ii + 2 < section.items.length) downId = section.items[ii + 2].id
                    else if (ii < section.items.length - 1) downId = section.items[section.items.length - 1].id
                    else if (si < sections.length - 1) downId = sections[si + 1].items[0].id

                    let leftId = null
                    if (ii % 2 === 1) leftId = section.items[ii - 1].id

                    let rightId = null
                    if (ii % 2 === 0 && ii + 1 < section.items.length) rightId = section.items[ii + 1].id

                    return (
                      <SettingRow
                        key={item.id}
                        id={item.id}
                        icon={item.icon}
                        label={item.label}
                        value={item.value}
                        action={'action' in item && item.action}
                        isFirst={globalIdx === 0}
                        upId={upId}
                        downId={downId}
                        leftId={leftId}
                        rightId={rightId}
                        onActivate={() => handleActivate(item.id)}
                        onFocused={() => { _settingsRowFocused = true }}
                      />
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {dialog && dialog.type === 'update' && updateInfo && (
        <UpdateModal
          title={updateInfo.response.title || 'App Update'}
          version={updateInfo.response.version}
          apkUrl={updateInfo.response.apk_url}
          onClose={handleCancel}
        />
      )}
      {dialog && dialog.type !== 'update' && (
        <ConfirmDialog
          title={
            dialog.type === 'logout' ? 'Sign Out' :
            dialog.type === 'reset' ? 'Reset Activation' :
            dialog.type === 'checking' ? 'Checking Update' :
            dialog.type === 'uptodate' ? 'Up to Date' : 'Update Check Failed'
          }
          message={
            dialog.type === 'logout'
              ? 'Are you sure you want to sign out? You will need to re-enter your credentials.'
              : dialog.type === 'reset'
              ? 'Are you sure you want to reset activation? You will need to enter the activation code again.'
              : dialog.type === 'checking'
              ? 'Please wait while we check for the latest updates...'
              : dialog.type === 'uptodate'
              ? 'You are already using the latest version of the app.'
              : 'Could not check for updates. Please check your connection and try again.'
          }
          confirmLabel={
            dialog.type === 'logout' ? 'Sign Out' :
            dialog.type === 'reset' ? 'Reset' : 'OK'
          }
          showCancel={dialog.type === 'logout' || dialog.type === 'reset'}
          onConfirm={
            dialog.type === 'logout' || dialog.type === 'reset' ? handleConfirm : handleCancel
          }
          onCancel={handleCancel}
        />
      )}
    </FocusContext.Provider>
  )
}
