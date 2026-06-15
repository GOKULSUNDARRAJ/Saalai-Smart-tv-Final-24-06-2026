import { useEffect, useState, useCallback, useRef } from 'react'
import { useFocusable, FocusContext } from '@noriginmedia/norigin-spatial-navigation'
import { useAppStore } from '../store/appStore'
import { fetchContactUs } from '../api/contactUsApi'
import type { ContactUsData } from '../api/contactUsApi'

function scrollRowIntoView(el: HTMLDivElement | null) {
  if (!el) return
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
}

function PhoneRow({
  country,
  contactNo,
  focusKey,
  prevKey,
  nextKey,
}: {
  country: string
  contactNo: string
  focusKey: string
  prevKey: string | null
  nextKey: string | null
}) {
  const domRef = useRef<HTMLDivElement | null>(null)
  const { ref, focused, setFocus } = useFocusable({
    focusKey,
    onArrowPress: (dir) => {
      if (dir === 'up' && prevKey) { setFocus(prevKey); return false }
      if (dir === 'down' && nextKey) { setFocus(nextKey); return false }
      if (dir === 'up' && !prevKey) { setFocus('contactus-back'); return false }
      return false
    },
  })
  useEffect(() => {
    if (focused) scrollRowIntoView(domRef.current)
  }, [focused])
  const mergedRef = (el: HTMLDivElement | null) => {
    domRef.current = el
    const r = ref as unknown
    if (typeof r === 'function') (r as (e: HTMLDivElement | null) => void)(el)
    else if (r && typeof r === 'object') (r as { current: HTMLDivElement | null }).current = el
  }

  return (
    <div
      ref={mergedRef}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 20px',
        borderRadius: 10,
        marginBottom: 6,
        background: focused ? 'rgba(229,9,20,0.15)' : 'rgba(255,255,255,0.04)',
        border: focused ? '1px solid rgba(229,9,20,0.5)' : '1px solid rgba(255,255,255,0.07)',
        transition: 'background 0.15s, border-color 0.15s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <span style={{ fontSize: 18 }}>📞</span>
        <span style={{ color: focused ? '#fff' : 'rgba(255,255,255,0.85)', fontSize: 14, fontWeight: 500 }}>
          {country}
        </span>
      </div>
      <span style={{ color: focused ? '#ff6b6b' : 'rgba(255,255,255,0.5)', fontSize: 14, fontWeight: 600, letterSpacing: 0.5 }}>
        {contactNo}
      </span>
    </div>
  )
}

function SocialRow({
  type,
  contactNo,
  focusKey,
  prevKey,
  nextKey,
}: {
  type: string
  contactNo: string
  focusKey: string
  prevKey: string | null
  nextKey: string | null
}) {
  const domRef = useRef<HTMLDivElement | null>(null)
  const { ref, focused, setFocus } = useFocusable({
    focusKey,
    onArrowPress: (dir) => {
      if (dir === 'up' && prevKey) { setFocus(prevKey); return false }
      if (dir === 'down' && nextKey) { setFocus(nextKey); return false }
      if (dir === 'up' && !prevKey) { setFocus('contactus-back'); return false }
      return false
    },
  })
  useEffect(() => {
    if (focused) scrollRowIntoView(domRef.current)
  }, [focused])
  const mergedRef = (el: HTMLDivElement | null) => {
    domRef.current = el
    const r = ref as unknown
    if (typeof r === 'function') (r as (e: HTMLDivElement | null) => void)(el)
    else if (r && typeof r === 'object') (r as { current: HTMLDivElement | null }).current = el
  }

  const isWhatsApp = type.toLowerCase() === 'whatsapp'
  const icon = isWhatsApp ? '💬' : '📱'
  const label = isWhatsApp ? 'WhatsApp' : 'Viber'
  const color = isWhatsApp ? '#25D366' : '#665CAC'

  return (
    <div
      ref={mergedRef}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 20px',
        borderRadius: 10,
        marginBottom: 6,
        background: focused ? `${color}22` : 'rgba(255,255,255,0.04)',
        border: focused ? `1px solid ${color}88` : '1px solid rgba(255,255,255,0.07)',
        transition: 'background 0.15s, border-color 0.15s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <span style={{ fontSize: 18 }}>{icon}</span>
        <span style={{ color: focused ? '#fff' : 'rgba(255,255,255,0.85)', fontSize: 14, fontWeight: 500 }}>
          {label}
        </span>
      </div>
      <span style={{ color: focused ? color : 'rgba(255,255,255,0.5)', fontSize: 14, fontWeight: 600, letterSpacing: 0.5 }}>
        {contactNo}
      </span>
    </div>
  )
}

export function ContactUsScreen() {
  const { goBack } = useAppStore()
  const [data, setData] = useState<ContactUsData | null>(null)
  const [loading, setLoading] = useState(true)
  const scrollContainerRef = useRef<HTMLDivElement | null>(null)

  const { ref, focusKey, setFocus } = useFocusable({ focusKey: 'contactus-screen', trackChildren: true })

  useEffect(() => {
    fetchContactUs().then((d) => {
      setData(d)
      setLoading(false)
      setTimeout(() => setFocus('contactus-back'), 100)
    })
  }, [setFocus])

  const handleBack = useCallback(() => {
    goBack()
  }, [goBack])

  const { ref: backRef, focused: backFocused } = useFocusable({
    focusKey: 'contactus-back',
    onEnterPress: handleBack,
    onArrowPress: (dir) => {
      if (dir === 'up') { setFocus('nav-profile'); return false }
      if (dir === 'down' && data) {
        const firstKey = data.list.length > 0 ? 'contactus-phone-0' : (data.socialList.length > 0 ? 'contactus-social-0' : null)
        if (firstKey) { setFocus(firstKey); return false }
      }
      return false
    },
  })

  useEffect(() => {
    if (backFocused && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0
    }
  }, [backFocused])

  const phoneKeys = (data?.list ?? []).map((_, i) => `contactus-phone-${i}`)
  const socialKeys = (data?.socialList ?? []).map((_, i) => `contactus-social-${i}`)
  const allKeys = [...phoneKeys, ...socialKeys]

  return (
    <FocusContext.Provider value={focusKey}>
      <div ref={(el) => { scrollContainerRef.current = el; const r = ref as unknown; if (typeof r === 'function') (r as (e: HTMLDivElement | null) => void)(el); else if (r && typeof r === 'object') (r as { current: HTMLDivElement | null }).current = el }} style={{ height: '100%', overflowY: 'auto', overflowX: 'hidden', paddingLeft: '5vw', paddingRight: '5vw', paddingBottom: 48 }} className="scrollbar-hide">
        <div style={{ paddingTop: 'clamp(14px, 2.5vh, 28px)', paddingBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 4 }}>
            <span style={{ fontSize: 28 }}>📞</span>
            <h1 style={{ color: '#fff', fontSize: 'clamp(22px, 3vw, 36px)', fontWeight: 700, margin: 0 }}>
              {data?.title ?? 'Contact Us'}
            </h1>
          </div>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, marginTop: 6, marginBottom: 0, paddingLeft: 44 }}>
            {data?.desc ?? 'Please Contact Our Support Team.'}
          </p>
        </div>

        <div style={{ marginBottom: 20 }}>
          <button
            ref={backRef}
            onClick={handleBack}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '9px 22px',
              borderRadius: 8,
              border: backFocused ? '1px solid rgba(229,9,20,0.6)' : '1px solid rgba(255,255,255,0.2)',
              background: backFocused ? 'rgba(229,9,20,0.18)' : 'rgba(255,255,255,0.06)',
              color: '#fff',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              outline: 'none',
              transition: 'all 0.15s',
              transform: backFocused ? 'scale(1.04)' : 'scale(1)',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}><path d="M15 5L8 12L15 19" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/></svg>
            Back to Settings
          </button>
        </div>

        {loading && (
          <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 14, marginTop: 32, textAlign: 'center' }}>
            Loading…
          </div>
        )}

        {!loading && data && (
          <>
            {data.list.length > 0 && (
              <div style={{ marginBottom: 28 }}>
                <div style={{ color: '#e50914', fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 10, paddingLeft: 4 }}>
                  Phone Support
                </div>
                {data.list.map((entry, i) => {
                  const key = phoneKeys[i]
                  const prev = allKeys[allKeys.indexOf(key) - 1] ?? null
                  const next = allKeys[allKeys.indexOf(key) + 1] ?? null
                  return (
                    <PhoneRow
                      key={i}
                      country={entry.country}
                      contactNo={entry.contactNo}
                      focusKey={key}
                      prevKey={prev}
                      nextKey={next}
                    />
                  )
                })}
              </div>
            )}

            {data.socialList.length > 0 && (
              <div>
                <div style={{ color: '#e50914', fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 10, paddingLeft: 4 }}>
                  Message Us
                </div>
                {data.socialList.map((entry, i) => {
                  const key = socialKeys[i]
                  const prev = allKeys[allKeys.indexOf(key) - 1] ?? null
                  const next = allKeys[allKeys.indexOf(key) + 1] ?? null
                  return (
                    <SocialRow
                      key={i}
                      type={entry.type}
                      contactNo={entry.contactNo}
                      focusKey={key}
                      prevKey={prev}
                      nextKey={next}
                    />
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>
    </FocusContext.Provider>
  )
}
