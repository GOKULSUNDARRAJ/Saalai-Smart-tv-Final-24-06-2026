import { tvStorage } from '../platform/storage'
import type { ContentItem } from '../types/content'
import { checkAccessDenied } from './apiUtils'

interface ApiChannelItem {
  channelId: number
  channelName: string
  channelURL: string
  channelLogo: string
}

export interface LiveTvPage {
  items: ContentItem[]
  error: boolean
  total: number
}

function mapChannel(ch: ApiChannelItem): ContentItem {
  return {
    id: `livetv-${ch.channelId}`,
    title: ch.channelName,
    description: '',
    thumbnailUrl: ch.channelLogo,
    backdropUrl: ch.channelLogo,
    streamUrl: ch.channelURL ?? '',
    duration: 0,
    genre: [],
    year: new Date().getFullYear(),
    rating: '',
    type: 'episode' as const,
  }
}

export async function fetchLiveTvPage(offset: number, count: number): Promise<LiveTvPage> {
  const token = tvStorage.getItem('tv_access_token') ?? ''
  if (!token || !token.includes('.')) return { items: [], error: false, total: 0 }
  try {
    const body = new URLSearchParams({ offset: String(offset), count: String(count) })
    const res = await fetch('https://staging.saalai.tv/saalai_app/secure/getLiveTvList', {
      method: 'POST',
      headers: {
        Authorization: token,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    })
    if (!res.ok) return { items: [], error: true, total: 0 }
    const text = await res.text()
    const data = typeof text === 'string' ? JSON.parse(text) : text
    if (checkAccessDenied(data)) return { items: [], error: true, total: 0 }
    if (!data.status) return { items: [], error: true, total: 0 }
    const list: ApiChannelItem[] = data.response?.channelList ?? []
    const total: number = data.response?.totalCount ?? data.response?.total ?? list.length
    return { items: list.map(mapChannel), error: false, total }
  } catch {
    return { items: [], error: true, total: 0 }
  }
}

export async function fetchDashboardChannels(): Promise<ContentItem[]> {
  const token = tvStorage.getItem('tv_access_token') ?? ''
  if (!token || !token.includes('.')) return []
  try {
    const res = await fetch('https://staging.saalai.tv/saalai_app/secure/getDashboardList', {
      method: 'POST',
      headers: { Authorization: token },
    })
    if (!res.ok) return []
    const text = await res.text()
    const data = typeof text === 'string' ? JSON.parse(text) : text
    if (checkAccessDenied(data)) return []
    if (!data.status) return []
    const list: ApiChannelItem[] = data.response?.latestChannelList ?? []
    return list.map((ch) => ({ ...mapChannel(ch), id: `dash-${ch.channelId}` }))
  } catch {
    return []
  }
}
