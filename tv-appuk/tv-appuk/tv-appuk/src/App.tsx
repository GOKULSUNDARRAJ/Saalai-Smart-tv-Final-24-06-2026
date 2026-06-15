import { useCallback, useEffect, useRef, useState } from 'react'
import { init, setKeyMap, useFocusable, FocusContext } from '@noriginmedia/norigin-spatial-navigation'
import { SplashScreen } from './screens/SplashScreen'
import { Sidebar } from './components/ui/Sidebar'
import { ExitDialog } from './components/ui/ExitDialog'
import { HomeScreen } from './screens/HomeScreen'
import { BrowseScreen } from './screens/BrowseScreen'
import { DetailScreen } from './screens/DetailScreen'
import { SearchScreen, trySearchBack } from './screens/SearchScreen'
import { PlayerScreen } from './screens/PlayerScreen'
import { TizenPlayerScreen } from './screens/TizenPlayerScreen'
import { ActivationScreen } from './screens/ActivationScreen'
import { LiveTvScreen, tryLiveTvBack } from './screens/LiveTvScreen'
import { MoviesScreen, tryMoviesBack } from './screens/MoviesScreen'
import { MovieDetailScreen } from './screens/MovieDetailScreen'
import { TvShowsScreen, tryTvShowsBack } from './screens/TvShowsScreen'
import { TvShowDetailScreen } from './screens/TvShowDetailScreen'
import { CatchupScreen, tryCatchupBack } from './screens/CatchupScreen'
import { CatchupDetailScreen } from './screens/CatchupDetailScreen'
import { RadioScreen, tryRadioBack } from './screens/RadioScreen'
import { RadioPlayerScreen } from './screens/RadioPlayerScreen'
import { SettingsScreen, trySettingsBack } from './screens/SettingsScreen'
import { ContactUsScreen } from './screens/ContactUsScreen'
import { useAppStore } from './store/appStore'
import { mapKeyEvent, TVKey } from './platform/keys'
import { shouldUseNativePlayer, wasRecentNativePlayback } from './platform/nativeVideoPlayer'

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
  const { currentScreen, homeScrolled, openExitDialog, goBack } = useAppStore()
  const { ref, focusKey, setFocus } = useFocusable({
    focusKey: 'app-root',
    trackChildren: true,
  })

  const prevScreenRef = useRef(currentScreen)
  const lastBackPressRef = useRef(0)

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

  const DETAIL_SCREENS = ['moviedetail', 'tvshowdetail', 'catchupdetail', 'detail']
  const isDetailScreen = DETAIL_SCREENS.includes(currentScreen)

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const key = mapKeyEvent(event)
      if ((key === TVKey.BACK || key === TVKey.HOME) && currentScreen !== 'player' && currentScreen !== 'tizenplayer') {
        event.preventDefault()
        event.stopPropagation()
        if (key === TVKey.HOME || currentScreen === 'home') {
          if (key === TVKey.HOME) {
            openExitDialog()
          } else {
            const now = Date.now()
            if (now - lastBackPressRef.current < 2000) {
              lastBackPressRef.current = 0
              openExitDialog()
            } else {
              lastBackPressRef.current = now
            }
          }
        } else {
          const handled =
            (currentScreen === 'movies' && tryMoviesBack()) ||
            (currentScreen === 'tvshows' && tryTvShowsBack()) ||
            (currentScreen === 'radio' && tryRadioBack()) ||
            (currentScreen === 'livetv' && tryLiveTvBack()) ||
            (currentScreen === 'catchup' && tryCatchupBack()) ||
            (currentScreen === 'settings' && trySettingsBack()) ||
            (currentScreen === 'search' && trySearchBack())
          if (!handled && !wasRecentNativePlayback()) goBack()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [currentScreen, openExitDialog, goBack])

  const isPlayerOpen = currentScreen === 'player' && !shouldUseNativePlayer()
  const isTizenPlayerOpen = currentScreen === 'tizenplayer'
  const isActivation = currentScreen === 'activation'

  return (
    <FocusContext.Provider value={focusKey}>
      <div ref={ref} className="w-screen h-screen bg-tv-bg" style={{ position: 'relative', ...(isTizenPlayerOpen ? { background: 'transparent' } : {}) }}>
        {showSplash && <SplashScreen onDone={handleSplashDone} />}
        {isActivation ? (
          <ActivationScreen />
        ) : isPlayerOpen ? (
          <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 50 }}>
            <PlayerScreen />
          </div>
        ) : isTizenPlayerOpen ? (
          <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 50, background: 'transparent' }}>
            <TizenPlayerScreen />
          </div>
        ) : (
          <div style={{ position: 'relative', width: '100%', height: '100%' }}>
            {!isDetailScreen && currentScreen !== 'radioplayer' && currentScreen !== 'home' && (
              <div style={{
                position: 'absolute', top: 0, left: 0, right: 0,
                height: 160,
                background: 'linear-gradient(180deg, rgba(229,9,20,0.30) 0%, rgba(229,9,20,0.08) 50%, rgba(10,10,10,0) 100%)',
                zIndex: 5, pointerEvents: 'none',
              }} />
            )}
            {!isDetailScreen && (
              <div style={{
                position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20,
                transition: 'opacity 0.4s, transform 0.4s',
                opacity: (currentScreen === 'home' && homeScrolled) ? 0 : 1,
                transform: (currentScreen === 'home' && homeScrolled) ? 'translateY(-100%)' : 'translateY(0)',
                pointerEvents: (currentScreen === 'home' && homeScrolled) ? 'none' : 'auto',
              }}>
                <Sidebar />
              </div>
            )}

            <main style={{
              position: 'absolute',
              left: 0, right: 0, bottom: 0,
              top: (currentScreen === 'home' || currentScreen === 'radioplayer' || isDetailScreen) ? 0 : 60,
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
      </div>
    </FocusContext.Provider>
  )
}
