import { useEffect, useRef } from 'react'
import { useFocusable, FocusContext } from '@noriginmedia/norigin-spatial-navigation'
import { useAppStore } from '../store/appStore'
import { tvStorage } from '../platform/storage'
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
    title: 'Playback',
    items: [
      { id: 'play-quality',   label: 'Video Quality',      value: 'Auto',       icon: '◈' },
      { id: 'play-subtitle',  label: 'Subtitles',          value: 'Off',        icon: '⊡' },
      { id: 'play-autoplay',  label: 'Auto-play Next',     value: 'On',         icon: '▷' },
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
}

function SettingRow({ id, icon, label, value, action, prevId, nextId, onActivate }: RowProps) {
  const domRef = useRef<HTMLDivElement | null>(null)
  const { ref: focusRef, focused, setFocus } = useFocusable({
    focusKey: getFocusKey(id),
    onEnterPress: onActivate,
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
    if (eRect.top < pRect.top) {
      parent.scrollTop -= pRect.top - eRect.top + 8
    } else if (eRect.bottom > pRect.bottom) {
      parent.scrollTop += eRect.bottom - pRect.bottom + 8
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
      <span style={{ fontSize: '18px', marginRight: '14px', width: '24px', textAlign: 'center' }}>{icon}</span>
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

export function SettingsScreen() {
  const { navigate } = useAppStore()
  const { ref, focusKey, setFocus } = useFocusable({ focusKey: 'settings-screen', trackChildren: true })

  useEffect(() => {
    const t = setTimeout(() => setFocus('settings-row-account-plan'), 80)
    return () => clearTimeout(t)
  }, [setFocus])

  function handleActivate(id: string) {
    if (id === 'account-logout' || id === 'about-reset') {
      tvStorage.removeItem('tv_activated')
      navigate('activation')
      return
    }
    const allItems = SECTIONS.flatMap(s => s.items)
    const item = allItems.find(i => i.id === id)
    if (item && 'navigate' in item && item.navigate) {
      navigate(item.navigate)
    }
  }

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
                    />
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    </FocusContext.Provider>
  )
}
