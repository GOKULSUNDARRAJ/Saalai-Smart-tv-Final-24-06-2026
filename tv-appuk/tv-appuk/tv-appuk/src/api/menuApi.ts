import type { Screen } from '../types/content'
import { tvStorage } from '../platform/storage'
import { checkAccessDenied } from './apiUtils'

export interface MenuItem {
  id: number
  name: string
  activeIcon: string
  inactiveIcon: string
  screen: Screen
}

const MENU_CACHE_KEY = 'tv_menu_items_v5'

const SCREEN_MAP: Record<string, Screen> = {
  'All':      'home',
  'Live Tv':  'livetv',
  'Movies':   'movies',
  'Tv Shows': 'tvshows',
  'Catch Up': 'catchup',
  'Radio':    'radio',
  'Profile':  'settings',
  'Thirai':   'home',
}

const FALLBACK_MENU: MenuItem[] = [
  { id: 1,  name: 'All',      activeIcon: 'https://staging.saalai.tv/saalai_app/icon/all_white.png',        inactiveIcon: 'https://staging.saalai.tv/saalai_app/icon/all.png',             screen: 'home' },
  { id: 2,  name: 'Live Tv',  activeIcon: 'https://staging.saalai.tv/saalai_app/icon/livetv_active.png',    inactiveIcon: 'https://staging.saalai.tv/saalai_app/icon/livetv.png',          screen: 'livetv' },
  { id: 3,  name: 'Movies',   activeIcon: 'https://staging.saalai.tv/saalai_app/icon/movies_selected.png',  inactiveIcon: 'https://staging.saalai.tv/saalai_app/icon/movies_unselected.png',screen: 'movies' },
  { id: 4,  name: 'Tv Shows', activeIcon: 'https://staging.saalai.tv/saalai_app/icon/tv_shows_active.png',  inactiveIcon: 'https://staging.saalai.tv/saalai_app/icon/tv_shows.png',        screen: 'tvshows' },
  { id: 5,  name: 'Catch Up', activeIcon: 'https://staging.saalai.tv/saalai_app/icon/catchup_active.png',   inactiveIcon: 'https://staging.saalai.tv/saalai_app/icon/catchup.png',         screen: 'catchup' },
  { id: 102, name: 'Radio',   activeIcon: 'https://staging.saalai.tv/saalai_app/icon/radio_selected.png',   inactiveIcon: 'https://staging.saalai.tv/saalai_app/icon/radio_unselected.png',screen: 'radio' },
  { id: 103, name: 'Profile', activeIcon: 'https://staging.saalai.tv/saalai_app/icon/profileSelected.png',  inactiveIcon: 'https://staging.saalai.tv/saalai_app/icon/profileInActive.png', screen: 'settings' },
]

function clearBadToken(): void {
  const stored = tvStorage.getItem('tv_access_token') ?? ''
  if (!stored || !stored.includes('.')) {
    tvStorage.removeItem('tv_access_token')
    tvStorage.removeItem('tv_activated')
  }
}

export async function fetchMenuItems(): Promise<MenuItem[]> {
  clearBadToken()
  const token = tvStorage.getItem('tv_access_token') ?? ''
  if (!token) return getCachedMenu()
  try {
    const res = await fetch('https://staging.saalai.tv/saalai_app/secure/tvMenuList', {
      method: 'POST',
      headers: { Authorization: token },
    })
    if (res.status === 401) {
      tvStorage.removeItem('tv_access_token')
      tvStorage.removeItem('tv_activated')
      throw new Error('401')
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    if (checkAccessDenied(data)) throw new Error('access_denied')
    if (!data.status) throw new Error('API returned status false')

    const topItems: MenuItem[] = (data.topMenu ?? []).map((m: {
      topmenuId: number
      topmenuName: string
      topmenuActiveIcon: string
      topmenuInActiveIcon: string
    }) => ({
      id: m.topmenuId,
      name: m.topmenuName,
      activeIcon: m.topmenuActiveIcon,
      inactiveIcon: m.topmenuInActiveIcon,
      screen: SCREEN_MAP[m.topmenuName] ?? 'home',
    }))

    const bottomItems: MenuItem[] = (data.bottomMenu ?? [])
      .filter((m: { bottommenuName: string }) => m.bottommenuName !== 'Thirai')
      .map((m: {
        bottommenuId: number
        bottommenuName: string
        bottommenuActiveIcon: string
        bottommenuInActiveIcon: string
      }) => ({
        id: 100 + m.bottommenuId,
        name: m.bottommenuName,
        activeIcon: m.bottommenuActiveIcon,
        inactiveIcon: m.bottommenuInActiveIcon,
        screen: SCREEN_MAP[m.bottommenuName] ?? 'home',
      }))

    const items = [...topItems, ...bottomItems]
    if (items.length > 0) {
      tvStorage.setJSON(MENU_CACHE_KEY, items)
      return items
    }
    throw new Error('Empty menu')
  } catch {
    const cached = tvStorage.getJSON<MenuItem[]>(MENU_CACHE_KEY)
    return cached && cached.length > 0 ? cached : FALLBACK_MENU
  }
}

export function getCachedMenu(): MenuItem[] {
  const cached = tvStorage.getJSON<MenuItem[]>(MENU_CACHE_KEY)
  return cached && cached.length > 0 ? cached : FALLBACK_MENU
}
