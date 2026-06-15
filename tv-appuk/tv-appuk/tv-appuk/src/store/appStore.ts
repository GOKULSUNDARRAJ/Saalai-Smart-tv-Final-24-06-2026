import { create } from 'zustand'
import type { ContentItem, Screen, PlaylistItem } from '../types/content'
import { tvStorage } from '../platform/storage'
import { getCachedMenu } from '../api/menuApi'
import type { MenuItem } from '../api/menuApi'

export type { PlaylistItem }

export interface TizenPlayerOptions {
  url: string
  title: string
  movieId: number
  startPositionMs: number
  forceFromBeginning: boolean
  isLive?: boolean
  disableResumeSave?: boolean
  playlist?: PlaylistItem[]
  playlistIndex?: number
}

const ACTIVATION_KEY = 'tv_activated'
const VALID_PIN = '123456'

function isActivated(): boolean {
  if (tvStorage.getItem(ACTIVATION_KEY) !== '1') return false
  const token = tvStorage.getItem('tv_access_token') ?? ''
  return token.length > 10 && token.includes('.')
}

export interface PendingAndroidResume {
  movieId: number
  url: string
  title: string
  startMs: number
  relatedJson?: string
}

interface HistoryEntry {
  screen: Screen
  selectedContent: ContentItem | null
  selectedMovieId: number | null
  selectedTvShowId: number | null
  selectedCatchupChannelId: number | null
  selectedRadioChannelId: number | null
  androidResumeOnRestore?: PendingAndroidResume
  tizenPlayerOptionsOnRestore?: TizenPlayerOptions
}

interface AppState {
  currentScreen: Screen
  selectedContent: ContentItem | null
  selectedMovieId: number | null
  selectedTvShowId: number | null
  selectedCatchupChannelId: number | null
  selectedRadioChannelId: number | null
  tizenPlayerOptions: TizenPlayerOptions | null
  pendingAndroidResume: PendingAndroidResume | null
  isExitDialogOpen: boolean
  menuItems: MenuItem[]
  homeScrolled: boolean
  setHomeScrolled: (v: boolean) => void

  navigate: (screen: Screen, content?: ContentItem) => void
  navigateToMovieDetail: (movieId: number) => void
  navigateToMovieDetailFromPlayer: (movieId: number, posMs: number) => void
  navigateToMovieDetailFromTizenPlayer: (movieId: number, posMs: number) => void
  navigateToMovieDetailWithAndroidResume: (toMovieId: number, resume: PendingAndroidResume) => void
  navigateToTvShowDetail: (channelId: number) => void
  navigateToCatchupDetail: (channelId: number) => void
  navigateToRadioPlayer: (channelId: number) => void
  navigateToTizenPlayer: (opts: TizenPlayerOptions) => void
  goBack: () => void
  clearPendingAndroidResume: () => void
  getPreviousScreen: () => Screen
  openExitDialog: () => void
  closeExitDialog: () => void
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
    tizenPlayerOptions: null,
    pendingAndroidResume: null,
    isExitDialogOpen: false,
    menuItems: getCachedMenu(),
    homeScrolled: false,
    setHomeScrolled: (v) => setState({ homeScrolled: v }),

    navigate: (screen, content) => {
      SCREEN_HISTORY.push(snapshotState(getState()))
      setState({ currentScreen: screen, selectedContent: content ?? null })
    },

    navigateToMovieDetail: (movieId) => {
      SCREEN_HISTORY.push(snapshotState(getState()))
      setState({ currentScreen: 'moviedetail', selectedMovieId: movieId, pendingAndroidResume: null })
    },

    navigateToMovieDetailFromPlayer: (movieId, posMs) => {
      const state = getState()
      const updatedContent = state.selectedContent
        ? { ...state.selectedContent, startPositionMs: posMs }
        : state.selectedContent
      const entry: HistoryEntry = { ...snapshotState(state), selectedContent: updatedContent }
      SCREEN_HISTORY.push(entry)
      setState({ currentScreen: 'moviedetail', selectedMovieId: movieId, pendingAndroidResume: null })
    },

    navigateToMovieDetailFromTizenPlayer: (movieId, posMs) => {
      const state = getState()
      const opts = state.tizenPlayerOptions
      const entry: HistoryEntry = {
        ...snapshotState(state),
        tizenPlayerOptionsOnRestore: opts ? { ...opts, startPositionMs: posMs } : undefined,
      }
      SCREEN_HISTORY.push(entry)
      setState({
        currentScreen: 'moviedetail',
        selectedMovieId: movieId,
        pendingAndroidResume: null,
        tizenPlayerOptions: opts ? { ...opts, startPositionMs: posMs } : null,
      })
    },

    navigateToMovieDetailWithAndroidResume: (toMovieId, resume) => {
      const entry: HistoryEntry = { ...snapshotState(getState()), androidResumeOnRestore: resume }
      SCREEN_HISTORY.push(entry)
      setState({ currentScreen: 'moviedetail', selectedMovieId: toMovieId, pendingAndroidResume: null })
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

    navigateToTizenPlayer: (opts) => {
      SCREEN_HISTORY.push(snapshotState(getState()))
      setState({ currentScreen: 'tizenplayer', tizenPlayerOptions: opts })
    },

    goBack: () => {
      const cur = getState().currentScreen
      if (cur === 'home' || cur === 'activation') {
        setState({ isExitDialogOpen: true })
        return
      }
      const prev = SCREEN_HISTORY.pop()
      if (!prev) {
        const cur = getState().currentScreen
        const DETAIL_PARENTS: Partial<Record<Screen, Screen>> = {
          moviedetail: 'movies',
          tvshowdetail: 'tvshows',
          catchupdetail: 'catchup',
          detail: 'browse',
          radioplayer: 'radio',
          player: 'home',
          tizenplayer: 'home',
        }
        setState({ currentScreen: DETAIL_PARENTS[cur] ?? 'home' })
        return
      }
      setState({
        currentScreen: prev.screen,
        selectedContent: prev.selectedContent,
        selectedMovieId: prev.selectedMovieId,
        selectedTvShowId: prev.selectedTvShowId,
        selectedCatchupChannelId: prev.selectedCatchupChannelId,
        selectedRadioChannelId: prev.selectedRadioChannelId,
        pendingAndroidResume: prev.androidResumeOnRestore ?? null,
        ...(prev.tizenPlayerOptionsOnRestore !== undefined && { tizenPlayerOptions: prev.tizenPlayerOptionsOnRestore }),
      })
    },

    clearPendingAndroidResume: () => setState({ pendingAndroidResume: null }),

    getPreviousScreen: () => SCREEN_HISTORY[SCREEN_HISTORY.length - 1]?.screen ?? 'home',

    openExitDialog: () => setState({ isExitDialogOpen: true }),
    closeExitDialog: () => setState({ isExitDialogOpen: false }),

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
      tvStorage.removeItem('tv_access_token')
      SCREEN_HISTORY.length = 0
      setState({ currentScreen: 'activation' })
    },

    setMenuItems: (items: MenuItem[]) => setState({ menuItems: items }),
  }
})
