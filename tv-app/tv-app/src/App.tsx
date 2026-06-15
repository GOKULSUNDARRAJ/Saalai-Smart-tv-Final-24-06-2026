import { useCallback, useEffect, useRef, useState } from 'react'
import { init, setKeyMap, useFocusable, FocusContext } from '@noriginmedia/norigin-spatial-navigation'
import { SplashScreen } from './screens/SplashScreen'
import { Sidebar } from './components/ui/Sidebar'
import { ExitDialog } from './components/ui/ExitDialog'
import { SubscribePopup } from './components/ui/SubscribePopup'
import { HomeScreen } from './screens/HomeScreen'
import { BrowseScreen } from './screens/BrowseScreen'
import { DetailScreen } from './screens/DetailScreen'
import { SearchScreen } from './screens/SearchScreen'
import { PlayerScreen } from './screens/PlayerScreen'
import { ActivationScreen } from './screens/ActivationScreen'
import { LiveTvScreen } from './screens/LiveTvScreen'
import { MoviesScreen } from './screens/MoviesScreen'
import { MovieDetailScreen } from './screens/MovieDetailScreen'
import { TvShowsScreen } from './screens/TvShowsScreen'
import { TvShowDetailScreen } from './screens/TvShowDetailScreen'
import { CatchupScreen } from './screens/CatchupScreen'
import { CatchupDetailScreen } from './screens/CatchupDetailScreen'
import { RadioScreen } from './screens/RadioScreen'
import { RadioPlayerScreen } from './screens/RadioPlayerScreen'
import { SettingsScreen } from './screens/SettingsScreen'
import { ContactUsScreen } from './screens/ContactUsScreen'
import { useAppStore } from './store/appStore'
import { mapKeyEvent, TVKey } from './platform/keys'

init({
  debug: false,
  visualDebug: false,
  shouldFocusDOMNode: true,
  useGetBoundingClientRect: true,
  throttle: 100,
  throttleKeypresses: true,
})

setKeyMap({
  left: [37, 21],
  up: [38, 19],
  right: [39, 22],
  down: [40, 20],
  enter: [13, 23, 66],
})

export function App() {
  const [showSplash, setShowSplash] = useState(true)
  const handleSplashDone = useCallback(() => setShowSplash(false), [])
  const { currentScreen, goBack, getPreviousScreen, homeScrolled } = useAppStore()
  const { ref, focusKey, setFocus } = useFocusable({
    focusKey: 'app-root',
    trackChildren: true,
  })

  const prevScreenRef = useRef(currentScreen)

  useEffect(() => {
    setFocus('nav-home')
  }, [setFocus])

  useEffect(() => {
    const prev = prevScreenRef.current
    prevScreenRef.current = currentScreen
    if (prev === 'activation' && currentScreen !== 'activation') {
      setTimeout(() => setFocus('nav-home'), 150)
      setTimeout(() => setFocus('nav-home'), 400)
      setTimeout(() => setFocus('nav-home'), 700)
    }
  }, [currentScreen, setFocus])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const key = mapKeyEvent(event)
      if (key === TVKey.BACK && currentScreen !== 'player') {
        event.preventDefault()
        event.stopPropagation()
        const prev = getPreviousScreen()
        goBack()
        const NAV_SCREENS = ['home', 'livetv', 'movies', 'tvshows', 'catchup', 'radio', 'browse', 'search']
        const focusTarget = prev === 'settings' || prev === 'contactus' ? 'nav-profile' : NAV_SCREENS.includes(prev) ? `nav-${prev}` : 'nav-home'
        setTimeout(() => setFocus(focusTarget), 150)
        setTimeout(() => setFocus(focusTarget), 400)
        setTimeout(() => setFocus(focusTarget), 700)
      }
    }
    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [currentScreen, goBack, setFocus, getPreviousScreen])

  const isPlayerOpen = currentScreen === 'player'
  const isActivation = currentScreen === 'activation'

  return (
    <FocusContext.Provider value={focusKey}>
      <div ref={ref} className="w-screen h-screen bg-tv-bg" style={{ position: 'relative' }}>
        {showSplash && <SplashScreen onDone={handleSplashDone} />}
        {isActivation ? (
          <ActivationScreen />
        ) : isPlayerOpen ? (
          <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 50 }}>
            <PlayerScreen />
          </div>
        ) : (
          <div style={{ position: 'relative', width: '100%', height: '100%' }}>
            {currentScreen !== 'radioplayer' && currentScreen !== 'home' && (
              <div style={{
                position: 'absolute', top: 0, left: 0, right: 0,
                height: 'clamp(160px, 25vh, 260px)',
                background: 'linear-gradient(180deg, rgba(229,9,20,0.30) 0%, rgba(229,9,20,0.08) 50%, rgba(10,10,10,0) 100%)',
                zIndex: 5, pointerEvents: 'none',
              }} />
            )}
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20,
              transition: 'opacity 0.4s, transform 0.4s',
              opacity: (currentScreen === 'home' && homeScrolled) ? 0 : 1,
              transform: (currentScreen === 'home' && homeScrolled) ? 'translateY(-100%)' : 'translateY(0)',
              pointerEvents: (currentScreen === 'home' && homeScrolled) ? 'none' : 'auto',
            }}>
              <Sidebar />
            </div>
            <main style={{
              position: 'absolute',
              left: 0, right: 0, bottom: 0,
              top: (currentScreen === 'home' || currentScreen === 'radioplayer') ? 0 : 'clamp(60px, 7.5vh, 80px)',
              overflow: 'hidden',
            }}>
              {currentScreen === 'home' && <HomeScreen />}
              {currentScreen === 'livetv' && <LiveTvScreen />}
              {currentScreen === 'movies' && <MoviesScreen />}
              {currentScreen === 'moviedetail' && <MovieDetailScreen />}
              {currentScreen === 'tvshows' && <TvShowsScreen />}
              {currentScreen === 'tvshowdetail' && <TvShowDetailScreen />}
              {currentScreen === 'catchup' && <CatchupScreen />}
              {currentScreen === 'catchupdetail' && <CatchupDetailScreen />}
              {currentScreen === 'radio' && <RadioScreen />}
              {currentScreen === 'radioplayer' && <RadioPlayerScreen />}
              {currentScreen === 'browse' && <BrowseScreen />}
              {currentScreen === 'detail' && <DetailScreen />}
              {currentScreen === 'search' && <SearchScreen />}
              {currentScreen === 'settings' && <SettingsScreen />}
              {currentScreen === 'contactus' && <ContactUsScreen />}
            </main>
          </div>
        )}

        <ExitDialog />
        <SubscribePopup />
      </div>
    </FocusContext.Provider>
  )
}
