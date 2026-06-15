import { tvStorage } from '../platform/storage'

export interface CatchupEpisode {
  showName: string
  showLogo: string
  showType: string
  showURL: string
}

export interface CatchupDay {
  Date: string
  Day: string
  episodeList: CatchupEpisode[]
}

export interface CatchupChannelDetail {
  channelId: number
  channelName: string
  channelDescription: string
  channelLogo: string
  showList: CatchupDay[]
}

export async function fetchCatchupChannelDetails(channelId: number): Promise<CatchupChannelDetail | null> {
  const token = tvStorage.getItem('tv_access_token') ?? ''
  if (!token || !token.includes('.')) return null
  try {
    const body = new URLSearchParams({ channelId: String(channelId) })
    const res = await fetch('https://staging.saalai.tv/saalai_app/secure/getCatchupChannelDetails', {
      method: 'POST',
      headers: {
        Authorization: token,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    })
    if (!res.ok) return null
    const text = await res.text()
    const data = typeof text === 'string' ? JSON.parse(text) : text
    if (data.channelId !== undefined) return data as CatchupChannelDetail
    if (!data.status) return null
    return data.response as CatchupChannelDetail
  } catch {
    return null
  }
}

export interface CatchupChannel {
  channelId: number
  channelName: string
  channelLogo: string
}

export interface CatchupChannelPage {
  items: CatchupChannel[]
  total: number
  error: boolean
}

export async function fetchCatchupChannelList(offset: number, count: number): Promise<CatchupChannelPage> {
  const token = tvStorage.getItem('tv_access_token') ?? ''
  if (!token || !token.includes('.')) return { items: [], total: 0, error: false }
  try {
    const body = new URLSearchParams({ offset: String(offset), count: String(count) })
    const res = await fetch('https://staging.saalai.tv/saalai_app/secure/getCatchupChannelList', {
      method: 'POST',
      headers: {
        Authorization: token,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    })
    if (!res.ok) return { items: [], total: 0, error: true }
    const text = await res.text()
    const data = typeof text === 'string' ? JSON.parse(text) : text
    if (!data.status) return { items: [], total: 0, error: true }
    const list: Array<{ channelId: number; channelName: string; channelLogo: string }> =
      data.response?.channelList ?? []
    const total: number = data.response?.totalCount ?? data.response?.total ?? list.length
    return {
      items: list.map((ch) => ({
        channelId: ch.channelId,
        channelName: ch.channelName,
        channelLogo: ch.channelLogo,
      })),
      total,
      error: false,
    }
  } catch {
    return { items: [], total: 0, error: true }
  }
}
