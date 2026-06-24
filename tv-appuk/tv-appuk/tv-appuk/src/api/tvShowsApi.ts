import { BASE_URL } from '../api/apiUtils';
import { tvStorage } from '../platform/storage'
import { checkAccessDenied } from './apiUtils'

export interface TvShowCategory {
  id: number
  name: string
}

export interface TvShowItem {
  id: number
  name: string
  logo: string
}

export interface TvShowDashboard {
  categories: TvShowCategory[]
}

export async function fetchTvShowDashboard(): Promise<TvShowDashboard> {
  const token = tvStorage.getItem('tv_access_token') ?? ''
  const empty: TvShowDashboard = { categories: [] }
  if (!token || !token.includes('.')) return empty
  try {
    const res = await fetch(BASE_URL + '/secure/getTvShowDashboadList', {
      method: 'POST',
      headers: { Authorization: token },
    })
    if (!res.ok) return empty
    const text = await res.text()
    const data = typeof text === 'string' ? JSON.parse(text) : text
    if (checkAccessDenied(data)) return empty
    if (!data.status) return empty

    const list: Array<{ categoryId: number; categoryName: string }> = data.response ?? []
    const nonBanner = list.filter((c) => c.categoryId !== 0)
    const categories: TvShowCategory[] = nonBanner.map((c) => ({ id: c.categoryId, name: c.categoryName }))

    return { categories }
  } catch {
    return empty
  }
}

export async function fetchTvShowList(categoryId: number, offset = 0, count = 100): Promise<TvShowItem[]> {
  const token = tvStorage.getItem('tv_access_token') ?? ''
  if (!token || !token.includes('.')) return []
  try {
    const body = new URLSearchParams({
      categoryId: String(categoryId),
      offset: String(offset),
      count: String(count),
    })
    const res = await fetch(BASE_URL + '/secure/getTvShowList', {
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
    if (checkAccessDenied(data)) return []
    if (!data.status) return []
    const list: Array<{ channelId: number; channelName: string; channelLogo: string }> =
      data.response?.tvShowList ?? []
    return list.map((ch) => ({ id: ch.channelId, name: ch.channelName, logo: ch.channelLogo }))
  } catch {
    return []
  }
}

export interface EpisodeDetail {
  episodeId: number
  episodeName: string
  episodeType: string
  episodeURL: string
  episodeNo: string
  episodeDescription: string
  episodeLogo: string
}

export interface EpisodeItem {
  episodeId: number
  episodeName: string
  episodeLogo: string
  episodeDate: string
  channelId: string
  episodeURL?: string
}

export interface TvShowEpisodeData {
  episodeDetails: EpisodeDetail | null
  episodes: EpisodeItem[]
}

export async function fetchTvShowEpisodeList(
  channelId: number,
  episodeId = 0,
  offset = 0,
  count = 25,
): Promise<TvShowEpisodeData> {
  const token = tvStorage.getItem('tv_access_token') ?? ''
  const empty: TvShowEpisodeData = { episodeDetails: null, episodes: [] }
  if (!token || !token.includes('.')) return empty
  try {
    const body = new URLSearchParams({
      channelId: String(channelId),
      episodeId: String(episodeId),
      offset: String(offset),
      count: String(count),
    })
    const res = await fetch(BASE_URL + '/secure/getTvShowEpisodeList', {
      method: 'POST',
      headers: {
        Authorization: token,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    })
    if (!res.ok) return empty
    const text = await res.text()
    const data = typeof text === 'string' ? JSON.parse(text) : text
    if (checkAccessDenied(data)) return empty
    if (!data.status) return empty
    const r = data.response ?? {}
    const ed = r.episodeDetails ?? null
    const list: EpisodeItem[] = (r.tvShowEpisodeList ?? []).map((e: {
      episodeId: number; episodeName: string; episodeLogo: string; episodeDate: string; channelId: string; episodeURL?: string
    }) => ({
      episodeId: e.episodeId,
      episodeName: e.episodeName,
      episodeLogo: e.episodeLogo,
      episodeDate: e.episodeDate,
      channelId: e.channelId,
      episodeURL: e.episodeURL,
    }))
    return { episodeDetails: ed, episodes: list }
  } catch {
    return empty
  }
}
