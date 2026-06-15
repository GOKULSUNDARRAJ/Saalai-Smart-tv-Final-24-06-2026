import { tvStorage } from '../platform/storage'
import type { ContentItem, ContentRow } from '../types/content'

interface ApiBannerItem {
  banner: string
}

interface ApiChannelItem {
  channelId: number
  channelName: string
  channelURL: string
  channelLogo: string
}

export interface DashboardData {
  banners: string[]
  rows: ContentRow[]
}

function toContentItem(ch: ApiChannelItem, prefix: string): ContentItem {
  const type: ContentItem['type'] =
    prefix === 'mv' ? 'movie' :
    prefix === 'tv' ? 'series' :
    'episode'
  return {
    id: `${prefix}-${ch.channelId}`,
    title: ch.channelName,
    description: '',
    thumbnailUrl: ch.channelLogo,
    backdropUrl: ch.channelLogo,
    streamUrl: ch.channelURL ?? '',
    duration: 0,
    genre: [],
    year: new Date().getFullYear(),
    rating: '',
    type,
  }
}

function buildRow(items: ApiChannelItem[], id: string, title: string, prefix: string): ContentRow | null {
  const mapped = (items ?? []).map((ch) => toContentItem(ch, prefix))
  if (mapped.length === 0) return null
  return { id, title, items: mapped }
}

export async function fetchDashboard(): Promise<DashboardData | null> {
  const token = tvStorage.getItem('tv_access_token') ?? ''
  if (!token || !token.includes('.')) return null
  try {
    const res = await fetch('https://staging.saalai.tv/saalai_app/secure/getDashboardList', {
      method: 'POST',
      headers: { Authorization: token },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const text = await res.text()
    const data = typeof text === 'string' ? JSON.parse(text) : text
    if (!data.status) throw new Error('status false')
    const r = data.response

    const banners: string[] = (r.bannerList ?? []).map((b: ApiBannerItem) => b.banner).filter(Boolean)

    const rowDefs: [ApiChannelItem[], string, string, string][] = [
      [r.latestChannelList, 'home-channels', 'Latest Channels', 'ch'],
      [r.latestMovieList,   'home-movies',   'Latest Movies',   'mv'],
      [r.latestTVShowList,  'home-tvshows',  'Latest TV Shows', 'tv'],
      [r.latestRadioList,   'home-radio',    'Latest Radio',    'radio'],
    ]

    const rows: ContentRow[] = rowDefs
      .map(([items, id, title, prefix]) => buildRow(items, id, title, prefix))
      .filter((row): row is ContentRow => row !== null)

    return { banners, rows }
  } catch {
    return null
  }
}
