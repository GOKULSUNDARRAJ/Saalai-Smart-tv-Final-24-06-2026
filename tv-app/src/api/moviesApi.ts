import { tvStorage } from '../platform/storage'

export interface MovieCategory {
  id: number
  name: string
}

export interface MovieDashboard {
  banners: string[]
  categories: MovieCategory[]
  channelsByCategory: Record<number, MovieItem[]>
}

export interface MovieItem {
  id: number
  name: string
  logo: string
}

export interface MovieDetail {
  id: number
  name: string
  logo: string
  streamUrl: string
  releaseYear: string
  cast: string
  music: string
  director: string
  category: string
  description: string
  duration: string
  playedTime: string
  related: MovieItem[]
}


export async function fetchMovieDashboard(): Promise<MovieDashboard> {
  const token = tvStorage.getItem('tv_access_token') ?? ''
  const empty: MovieDashboard = { banners: [], categories: [], channelsByCategory: {} }
  if (!token || !token.includes('.')) return empty
  try {
    const res = await fetch('https://staging.saalai.tv/saalai_app/secure/getMovieDashboadList', {
      method: 'POST',
      headers: { Authorization: token },
    })
    if (!res.ok) return empty
    const text = await res.text()
    const data = typeof text === 'string' ? JSON.parse(text) : text
    if (!data.status) return empty

    const list: Array<{ categoryId: number; categoryName: string; channels: Array<{ channelLogo: string }> }> =
      data.response ?? []

    const bannerCategory = list.find((c) => c.categoryId === 0)
    const banners = bannerCategory?.channels.map((ch) => ch.channelLogo) ?? []

    const nonBanner = list.filter((c) => c.categoryId !== 0)
    const categories: MovieCategory[] = nonBanner.map((c) => ({ id: c.categoryId, name: c.categoryName }))
    const channelsByCategory: Record<number, MovieItem[]> = {}
    for (const c of nonBanner) {
      channelsByCategory[c.categoryId] = c.channels.map((ch) => ({
        id: (ch as { channelId: number; channelName: string; channelLogo: string }).channelId,
        name: (ch as { channelId: number; channelName: string; channelLogo: string }).channelName,
        logo: ch.channelLogo,
      }))
    }

    return { banners, categories, channelsByCategory }
  } catch {
    return empty
  }
}

export async function fetchCategoryMovies(categoryId: number, page: number, count: number): Promise<MovieItem[]> {
  const token = tvStorage.getItem('tv_access_token') ?? ''
  if (!token || !token.includes('.')) return []
  try {
    const body = new URLSearchParams({
      categoryId: String(categoryId),
      offset: String(page),
      count: String(count),
    })
    const res = await fetch('https://staging.saalai.tv/saalai_app/secure/getCategoryMovieList', {
      method: 'POST',
      headers: {
        Authorization: token,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    })
    if (!res.ok) return []
    const text = await res.text()
    const data = typeof text === 'string' ? JSON.parse(text) : text
    if (!data.status) return []
    const list: Array<{ channelId: number; channelName: string; channelLogo: string }> =
      data.response?.movieList ?? []
    return list.map((m) => ({ id: m.channelId, name: m.channelName, logo: m.channelLogo }))
  } catch {
    return []
  }
}

export async function fetchMovieDetails(channelId: number): Promise<MovieDetail | null> {
  const token = tvStorage.getItem('tv_access_token') ?? ''
  if (!token || !token.includes('.')) return null
  try {
    const body = new URLSearchParams({ channelId: String(channelId) })
    const res = await fetch('https://staging.saalai.tv/saalai_app/secure/getMovieDetails', {
      method: 'POST',
      headers: {
        Authorization: token,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    })
    if (!res.ok) return null
    const text = await res.text()
    const d = typeof text === 'string' ? JSON.parse(text) : text
    if (!d.status) return null
    const related: MovieItem[] = (d.channelList ?? []).map((ch: { channelId: number; channelName: string; channelLogo: string }) => ({
      id: ch.channelId, name: ch.channelName, logo: ch.channelLogo,
    }))
    return {
      id: d.channelId,
      name: d.channelName,
      logo: d.channelLogoPath,
      streamUrl: d.channelUrl ?? '',
      releaseYear: d.channelReleaseYear ?? '',
      cast: d.channelCast ?? '',
      music: d.channelMusic ?? '',
      director: d.channelDirector ?? '',
      category: d.channelCategory ?? '',
      description: d.channelDescription ?? '',
      duration: d.channelDuration ?? '',
      playedTime: d.channelPlayedTime ?? '',
      related,
    }
  } catch {
    return null
  }
}

export function msToHHMMSS(ms: number): string {
  const totalSec = Math.floor(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function hhmmssToMs(time: string): number {
  if (!time) return 0
  const parts = time.split(':').map(Number)
  if (parts.length === 3) return ((parts[0] * 3600) + (parts[1] * 60) + parts[2]) * 1000
  if (parts.length === 2) return ((parts[0] * 60) + parts[1]) * 1000
  return 0
}

export async function updateStreamTime(channelId: number, type: number, positionMs: number): Promise<void> {
  const token = tvStorage.getItem('tv_access_token') ?? ''
  if (!token || !token.includes('.') || positionMs <= 0) return
  const time = msToHHMMSS(positionMs)
  try {
    await fetch('https://staging.saalai.tv/saalai_app/secure/updateStreamTime', {
      method: 'POST',
      headers: {
        authorization: token,
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: `channelId=${channelId}&type=${type}&time=${time}`,
    })
  } catch {
  }
}
