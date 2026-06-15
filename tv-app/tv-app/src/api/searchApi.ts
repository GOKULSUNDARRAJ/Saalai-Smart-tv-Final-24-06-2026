import { tvStorage } from '../platform/storage'

export interface SearchItem {
  channelId: number
  channelName: string
  channelLogo: string
  channelURL?: string
}

export interface SearchResponse {
  channelList: SearchItem[]
  movieList: SearchItem[]
  showList: SearchItem[]
}

export async function searchProgram(keyword: string): Promise<SearchResponse> {
  const token = tvStorage.getItem('tv_access_token') ?? ''
  const empty: SearchResponse = { channelList: [], movieList: [], showList: [] }
  if (!token || !token.includes('.') || !keyword.trim()) return empty
  try {
    const body = new URLSearchParams({ keyword: keyword.trim() })
    const res = await fetch('https://staging.saalai.tv/saalai_app/secure/searchProgram', {
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
    if (data.error_type !== '200') return empty
    const mapItem = (item: Record<string, unknown>): SearchItem => ({
      channelId: item.channelId as number,
      channelName: item.channelName as string,
      channelLogo: (item.channelLogoPath ?? item.channelLogo ?? '') as string,
      channelURL: (item.channelURL ?? '') as string,
    })
    return {
      channelList: (data.channelList ?? []).map(mapItem),
      movieList: (data.movieList ?? []).map(mapItem),
      showList: (data.showList ?? []).map(mapItem),
    }
  } catch {
    return empty
  }
}
