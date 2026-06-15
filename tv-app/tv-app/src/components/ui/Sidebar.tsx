import { useRef } from 'react'
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
  radioplayer: 'radioplayer-playpause',
  browse:      'browse-cat-0',
  search:      'search-input',
  settings:    'settings-row-account-plan',
  detail:      'detail-play',
  player:      'player-screen',
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
      if (dir === 'left' && index === 0) return false
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
        padding: '6px clamp(10px, 1.2vw, 18px)',
        transition: 'background-color 0.15s, color 0.15s',
        flexShrink: 0,
        gap: 5,
        outline: 'none',
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
      if (dir === 'right') { setFocus('nav-search'); return false }
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
        gap: 6,
        borderRadius: 999,
        border: 'none',
        cursor: 'pointer',
        backgroundColor: focused
          ? '#e50914'
          : isActive
          ? 'rgba(229,9,20,0.25)'
          : 'transparent',
        color: focused ? '#fff' : isActive ? '#fff' : 'rgba(255,255,255,0.75)',
        padding: '6px clamp(10px, 1.2vw, 18px)',
        transition: 'background-color 0.15s, color 0.15s',
        flexShrink: 0,
        outline: 'none',
      }}
    >
      <svg viewBox="0 0 24 24" style={{ width: 15, height: 15, fill: 'none', stroke: '#fff', strokeWidth: 2 }}>
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
      if (dir === 'left') { setFocus('nav-profile'); return false }
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
        gap: 6,
        borderRadius: 999,
        border: 'none',
        cursor: 'pointer',
        backgroundColor: focused
          ? '#e50914'
          : isActive
          ? 'rgba(229,9,20,0.25)'
          : 'transparent',
        color: focused ? '#fff' : isActive ? '#fff' : 'rgba(255,255,255,0.75)',
        padding: '6px clamp(10px, 1.2vw, 18px)',
        transition: 'background-color 0.15s, color 0.15s',
        flexShrink: 0,
        outline: 'none',
      }}
    >
      <svg
        viewBox="0 0 24 24"
        style={{ width: 15, height: 15, fill: 'none', stroke: '#fff', strokeWidth: 2.5 }}
      >
        <circle cx="11" cy="11" r="7" />
        <line x1="16.5" y1="16.5" x2="22" y2="22" />
      </svg>
      <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: 0.2 }}>Search</span>
    </button>
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
    setTimeout(() => {
      setFocus(SCREEN_FIRST_FOCUS[screen] ?? 'hero-play')
    }, 50)
  }

  const navItems = menuItems.filter(item => item.screen !== 'settings')

  return (
    <FocusContext.Provider value={focusKey}>
      <header
        style={{
          height: 'clamp(60px, 7.5vh, 80px)',
          display: 'flex',
          alignItems: 'center',
          paddingLeft: '3vw',
          paddingRight: '3vw',
          paddingTop: 20,
          flexShrink: 0,
          gap: 16,
          background: 'transparent',
          position: 'relative',
          zIndex: 10,
        }}
      >
        <div style={{
          width: 36, height: 36, background: '#E8232A', borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" style={{ width: 18, height: 18, fill: '#fff' }}>
            <rect x="2" y="5" width="28" height="20" rx="3"/>
            <rect x="11" y="26" width="10" height="2" rx="1"/>
            <polygon points="13,10 13,22 23,16" fill="#E8232A"/>
          </svg>
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
            gap: 2,
            overflow: 'hidden',
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

        <div style={{
          display: 'flex',
          alignItems: 'center',
          background: 'rgba(255,255,255,0.12)',
          backdropFilter: 'blur(12px)',
          borderRadius: 999,
          padding: '4px 6px',
          gap: 2,
        }}>
          <ProfileNavItem
            onSelect={() => handleSelect('settings')}
            isActive={currentScreen === 'settings'}
          />
          <SearchNavItem
            onSelect={() => handleSelect('search')}
            isActive={currentScreen === 'search'}
          />
        </div>
      </header>
    </FocusContext.Provider>
  )
}
