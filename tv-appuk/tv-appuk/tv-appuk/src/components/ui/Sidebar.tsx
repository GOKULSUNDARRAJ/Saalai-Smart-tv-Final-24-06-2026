import { useRef, useState, useEffect } from 'react'
import { useFocusable, FocusContext } from '@noriginmedia/norigin-spatial-navigation'
import type { Screen } from '../../types/content'
import { useAppStore } from '../../store/appStore'
import type { MenuItem } from '../../api/menuApi'
import { clearHomeCache } from '../../screens/HomeScreen'

const SCREEN_FIRST_FOCUS: Record<Screen, string> = {
  home:        'card-row-home-channels-0',
  livetv:      'livetv-card-0-0',
  movies:      'movies-cat-0',
  moviedetail: 'moviedetail-play',
  tvshows:     'tvshow-cat-0',
  tvshowdetail: 'tvshowdetail-play',
  catchup:     'catchup-card-0-0',
  catchupdetail: 'catchupdetail-day-0',
  radio:       'radio-card-0-0',
  radioplayer: 'radioplayer-station-0',
  browse:      'browse-cat-0',
  search:      'kb-0-0',
  settings:    'settings-row-account-plan',
  detail:      'detail-play',
  player:      'player-screen',
  tizenplayer: 'player-screen',
  activation:  'nav-home',
  contactus:   'contactus-back',
}

interface NavItemProps {
  item: MenuItem
  index: number
  total: number
  isActive: boolean
  onSelect: () => void
}

function TopNavItem({ item, index, total, isActive, onSelect }: NavItemProps) {
  const currentScreen = useAppStore((s) => s.currentScreen)
  const { ref, focused, setFocus } = useFocusable({
    focusKey: `nav-${item.screen}`,
    onEnterPress: onSelect,
    onArrowPress: (dir) => {
      if (dir === 'up') return false
      if (dir === 'down') {
        setFocus(SCREEN_FIRST_FOCUS[currentScreen] ?? 'hero-play')
        return false
      }
      if (dir === 'left' && index === 0) { setFocus('nav-search'); return false }
      if (dir === 'right' && index === total - 1) { setFocus('nav-profile'); return false }
      return true
    },
  })

  const iconUrl = isActive || focused ? item.activeIcon : item.inactiveIcon

  return (
    <button
      ref={ref}
      onClick={onSelect}
      style={{
        display: 'flex',
        alignItems: 'center',
        whiteSpace: 'nowrap',
        borderRadius: 999,
        border: 'none',
        cursor: 'pointer',
        backgroundColor: focused
          ? '#e50914'
          : isActive
          ? 'rgba(229,9,20,0.25)'
          : 'transparent',
        color: focused ? '#fff' : isActive ? '#fff' : 'rgba(255,255,255,0.75)',
        padding: '6px 12px',
        transition: 'background-color 0.15s, color 0.15s',
        flexShrink: 0,
        outline: 'none',
        marginRight: 2,
      }}
    >
      {iconUrl ? (
        <img
          src={iconUrl}
          alt={item.name}
          style={{
            width: 15,
            height: 15,
            objectFit: 'contain',
            filter: 'none',
            marginRight: 5,
          }}
        />
      ) : null}
      <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: 0.2 }}>{item.name}</span>
    </button>
  )
}

function ProfileNavItem({ onSelect, isActive }: { onSelect: () => void; isActive: boolean }) {
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect
  const currentScreen = useAppStore((s) => s.currentScreen)
  const { ref, focused, setFocus } = useFocusable({
    focusKey: 'nav-profile',
    onEnterPress: () => onSelectRef.current(),
    onArrowPress: (dir) => {
      if (dir === 'up') return false
      if (dir === 'down') { setFocus(SCREEN_FIRST_FOCUS[currentScreen] ?? 'hero-play'); return false }
      if (dir === 'left') return true
      if (dir === 'right') return false
      return true
    },
  })

  return (
    <button
      ref={ref}
      onClick={() => onSelectRef.current()}
      style={{
        display: 'flex',
        alignItems: 'center',
        borderRadius: 999,
        border: 'none',
        cursor: 'pointer',
        backgroundColor: focused
          ? '#e50914'
          : isActive
          ? 'rgba(229,9,20,0.25)'
          : 'transparent',
        color: focused ? '#fff' : isActive ? '#fff' : 'rgba(255,255,255,0.75)',
        padding: '6px 12px',
        transition: 'background-color 0.15s, color 0.15s',
        flexShrink: 0,
        outline: 'none',
        marginRight: 2,
      }}
    >
      <svg viewBox="0 0 24 24" style={{ width: 15, height: 15, fill: 'none', stroke: '#fff', strokeWidth: 2, marginRight: 6 }}>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
      </svg>
      <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: 0.2 }}>Profile</span>
    </button>
  )
}

function SearchNavItem({ onSelect, isActive }: { onSelect: () => void; isActive: boolean }) {
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect
  const currentScreen = useAppStore((s) => s.currentScreen)
  const { ref, focused, setFocus } = useFocusable({
    focusKey: 'nav-search',
    onEnterPress: () => onSelectRef.current(),
    onArrowPress: (dir) => {
      if (dir === 'up') return false
      if (dir === 'down') { setFocus(SCREEN_FIRST_FOCUS[currentScreen] ?? 'hero-play'); return false }
      if (dir === 'left') return false
      if (dir === 'right') return true
      return true
    },
  })

  return (
    <button
      ref={ref}
      onClick={() => onSelectRef.current()}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 36,
        height: 36,
        borderRadius: '50%',
        border: 'none',
        cursor: 'pointer',
        backgroundColor: focused
          ? '#e50914'
          : isActive
          ? 'rgba(229,9,20,0.25)'
          : 'rgba(255,255,255,0.15)',
        color: '#fff',
        padding: 0,
        transition: 'background-color 0.15s',
        flexShrink: 0,
        outline: 'none',
      }}
    >
      <svg
        viewBox="0 0 24 24"
        style={{ width: 16, height: 16, fill: 'none', stroke: 'currentColor', strokeWidth: 2.5 }}
      >
        <circle cx="11" cy="11" r="7" />
        <line x1="16.5" y1="16.5" x2="22" y2="22" />
      </svg>
    </button>
  )
}

function DateTimeNetworkWidget() {
  const [time, setTime] = useState('')
  const [date, setDate] = useState('')
  const [isOnline, setIsOnline] = useState(navigator.onLine)

  useEffect(() => {
    const updateDateTime = () => {
      const now = new Date()
      let hours = now.getHours()
      const minutes = now.getMinutes()
      const ampm = hours >= 12 ? 'PM' : 'AM'
      hours = hours % 12
      hours = hours ? hours : 12
      const strMinutes = minutes < 10 ? '0' + minutes : minutes
      setTime(`${hours}:${strMinutes} ${ampm}`)

      const options: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' }
      setDate(now.toLocaleDateString('en-US', options))
    }

    updateDateTime()
    const timer = setInterval(updateDateTime, 1000)

    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      clearInterval(timer)
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      marginRight: 0,
      color: 'rgba(255,255,255,0.7)',
      fontFamily: 'Inter, sans-serif',
    }}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ color: isOnline ? '#fff' : 'rgba(255,255,255,0.3)', transition: 'color 0.3s', marginRight: 4 }}>
        <path d="M12 20H12.01M17 15C14.2386 12.2386 9.76142 12.2386 7 15M20.5 11.5C15.8056 6.80558 8.19442 6.80558 3.5 11.5M23.5 8C17.1487 1.64873 6.85127 1.64873 0.5 8" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1.25 }}>
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', whiteSpace: 'nowrap' }}>{date}</span>
        <span style={{ color: '#fff', fontWeight: 700, fontSize: 15, whiteSpace: 'nowrap' }}>{time}</span>
      </div>
    </div>
  )
}

export function Sidebar() {
  const { currentScreen, navigate, menuItems, setHomeScrolled } = useAppStore()
  const { ref, focusKey, setFocus } = useFocusable({
    focusKey: 'sidebar',
    trackChildren: true,
  })

  const handleSelect = (screen: Screen) => {
    if (screen === 'home') {
      clearHomeCache()
      setHomeScrolled(false)
    }
    navigate(screen)
  }

  const navItems = menuItems.filter(item => item.screen !== 'settings')

  return (
    <FocusContext.Provider value={focusKey}>
      <header
        style={{
          height: 60,
          display: 'flex',
          alignItems: 'center',
          paddingLeft: '3vw',
          paddingRight: '3vw',
          paddingTop: 20,
          flexShrink: 0,
          background: 'transparent',
          position: 'relative',
          zIndex: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0, marginRight: 12 }}>
          <div style={{
            width: 36, height: 36, background: '#E8232A', borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            marginRight: 8,
          }}>
            <svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" style={{ width: 18, height: 18, fill: '#fff' }}>
              <rect x="2" y="5" width="28" height="20" rx="3"/>
              <rect x="11" y="26" width="10" height="2" rx="1"/>
              <polygon points="13,10 13,22 23,16" fill="#E8232A"/>
            </svg>
          </div>
          <SearchNavItem
            onSelect={() => handleSelect('search')}
            isActive={currentScreen === 'search'}
          />
        </div>

        <nav
          ref={ref}
          style={{
            display: 'flex',
            alignItems: 'center',
            background: 'rgba(255,255,255,0.12)',
            backdropFilter: 'blur(12px)',
            borderRadius: 999,
            padding: '4px 6px',
            overflow: 'hidden',
            marginRight: 16,
          }}
        >
          {navItems.map((item, idx) => (
            <TopNavItem
              key={`${item.id}-${item.screen}`}
              item={item}
              index={idx}
              total={navItems.length}
              isActive={currentScreen === item.screen}
              onSelect={() => handleSelect(item.screen)}
            />
          ))}
        </nav>

        <div style={{ flex: 1 }} />

        <DateTimeNetworkWidget />

        <div style={{ flex: 1 }} />

        <div style={{
          display: 'flex',
          alignItems: 'center',
          background: 'rgba(255,255,255,0.12)',
          backdropFilter: 'blur(12px)',
          borderRadius: 999,
          padding: '4px 6px',
        }}>
          <ProfileNavItem
            onSelect={() => handleSelect('settings')}
            isActive={currentScreen === 'settings'}
          />
        </div>
      </header>
    </FocusContext.Provider>
  )
}
