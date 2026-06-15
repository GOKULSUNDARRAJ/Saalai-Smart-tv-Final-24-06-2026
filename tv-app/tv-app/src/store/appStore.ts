import { create } from 'zustand'
import type { ContentItem, Screen } from '../types/content'
import { tvStorage } from '../platform/storage'
import { getCachedMenu } from '../api/menuApi'
import type { MenuItem } from '../api/menuApi'

const ACTIVATION_KEY = 'tv_activated'
const VALID_PIN = '123456'

function isActivated(): boolean {
  if (tvStorage.getItem(ACTIVATION_KEY) !== '1') return false
  const token = tvStorage.getItem('tv_access_token') ?? ''
  return token.length > 10 && token.includes('.')
}

interface HistoryEntry {
  screen: Screen
  selectedContent: ContentItem | null
  selectedMovieId: number | null
  selectedTvShowId: number | null
  selectedCatchupChannelId: number | null
  selectedRadioChannelId: number | null
}

interface AppState {
  currentScreen: Screen
  selectedContent: ContentItem | null
  selectedMovieId: number | null
  selectedTvShowId: number | null
  selectedCatchupChannelId: number | null
  selectedRadioChannelId: number | null
  isExitDialogOpen: boolean
  isSubscribePopupOpen: boolean
  menuItems: MenuItem[]
  homeScrolled: boolean
  setHomeScrolled: (v: boolean) => void

  navigate: (screen: Screen, content?: ContentItem) => void
  navigateToMovieDetail: (movieId: number) => void
  navigateToTvShowDetail: (channelId: number) => void
  navigateToCatchupDetail: (channelId: number) => void
  navigateToRadioPlayer: (channelId: number) => void
  goBack: () => void
  getPreviousScreen: () => Screen
  openExitDialog: () => void
  closeExitDialog: () => void
  openSubscribePopup: () => void
  closeSubscribePopup: () => void
  activateWithPin: (pin: string) => boolean
  setActivated: () => void
  logout: () => void
  setMenuItems: (items: MenuItem[]) => void
}

const SCREEN_HISTORY: HistoryEntry[] = []

function snapshotState(state: ReturnType<typeof get>): HistoryEntry {
  return {
    screen: state.currentScreen,
    selectedContent: state.selectedContent,
    selectedMovieId: state.selectedMovieId,
    selectedTvShowId: state.selectedTvShowId,
    selectedCatchupChannelId: state.selectedCatchupChannelId,
    selectedRadioChannelId: state.selectedRadioChannelId,
  }
}

let get: () => AppState = () => { throw new Error('store not ready') }

export { VALID_PIN }

export const useAppStore = create<AppState>((setState, getState) => {
  get = getState
  return {
    currentScreen: isActivated() ? 'home' : 'activation',
    selectedContent: null,
    selectedMovieId: null,
    selectedTvShowId: null,
    selectedCatchupChannelId: null,
    selectedRadioChannelId: null,
    isExitDialogOpen: false,
    isSubscribePopupOpen: false,
    menuItems: getCachedMenu(),
    homeScrolled: false,
    setHomeScrolled: (v) => setState({ homeScrolled: v }),

    navigate: (screen, content) => {
      SCREEN_HISTORY.push(snapshotState(getState()))
      setState({ currentScreen: screen, selectedContent: content ?? null })
    },

    navigateToMovieDetail: (movieId) => {
      SCREEN_HISTORY.push(snapshotState(getState()))
      setState({ currentScreen: 'moviedetail', selectedMovieId: movieId })
    },

    navigateToTvShowDetail: (channelId) => {
      SCREEN_HISTORY.push(snapshotState(getState()))
      setState({ currentScreen: 'tvshowdetail', selectedTvShowId: channelId })
    },

    navigateToCatchupDetail: (channelId) => {
      SCREEN_HISTORY.push(snapshotState(getState()))
      setState({ currentScreen: 'catchupdetail', selectedCatchupChannelId: channelId })
    },

    navigateToRadioPlayer: (channelId) => {
      SCREEN_HISTORY.push(snapshotState(getState()))
      setState({ currentScreen: 'radioplayer', selectedRadioChannelId: channelId })
    },

    goBack: () => {
      if (getState().currentScreen === 'home') {
        setState({ isExitDialogOpen: true })
        return
      }
      const prev = SCREEN_HISTORY.pop()
      if (!prev) {
        setState({ currentScreen: 'home' })
        return
      }
      setState({
        currentScreen: prev.screen,
        selectedContent: prev.selectedContent,
        selectedMovieId: prev.selectedMovieId,
        selectedTvShowId: prev.selectedTvShowId,
        selectedCatchupChannelId: prev.selectedCatchupChannelId,
        selectedRadioChannelId: prev.selectedRadioChannelId,
      })
    },

    getPreviousScreen: () => SCREEN_HISTORY[SCREEN_HISTORY.length - 1]?.screen ?? 'home',

    openExitDialog: () => setState({ isExitDialogOpen: true }),
    closeExitDialog: () => setState({ isExitDialogOpen: false }),
    openSubscribePopup: () => setState({ isSubscribePopupOpen: true }),
    closeSubscribePopup: () => setState({ isSubscribePopupOpen: false }),

    activateWithPin: (pin: string) => {
      if (pin === VALID_PIN) {
        tvStorage.setItem(ACTIVATION_KEY, '1')
        setState({ currentScreen: 'home' })
        return true
      }
      return false
    },

    setActivated: () => {
      const token = tvStorage.getItem('tv_access_token') ?? ''
      if (!token || !token.includes('.')) return
      tvStorage.setItem(ACTIVATION_KEY, '1')
      setState({ currentScreen: 'home' })
    },

    logout: () => {
      tvStorage.removeItem(ACTIVATION_KEY)
      setState({ currentScreen: 'activation' })
    },

    setMenuItems: (items: MenuItem[]) => setState({ menuItems: items }),
  }
})
