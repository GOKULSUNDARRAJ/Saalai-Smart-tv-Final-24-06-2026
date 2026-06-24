import { BASE_URL } from '../api/apiUtils';
import { tvStorage } from '../platform/storage'
import { checkAccessDenied } from './apiUtils'

export interface RadioStation {
  channelId: number
  channelName: string
  channelLogo: string
  channelURL: string
}

export interface RadioPage {
  items: RadioStation[]
  error: boolean
}

export interface RadioDetailResponse {
  channelDetails: RadioStation
  radioList: RadioStation[]
}

export async function fetchRadioDetail(channelId: number): Promise<RadioDetailResponse | null> {
  const token = tvStorage.getItem('tv_access_token') ?? ''
  if (!token || !token.includes('.')) return null
  try {
    const body = new URLSearchParams({ offset: '0', count: '20', channelId: String(channelId) })
    const res = await fetch(BASE_URL + '/secure/getRadioList', {
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
    if (checkAccessDenied(data)) return null
    if (!data.status) return null
    return {
      channelDetails: data.response.channelDetails,
      radioList: data.response.radioList ?? [],
    }
  } catch {
    return null
  }
}

export async function fetchRadioList(offset: number, count: number): Promise<RadioPage> {
  const token = tvStorage.getItem('tv_access_token') ?? ''
  if (!token || !token.includes('.')) return { items: [], error: false }
  try {
    const body = new URLSearchParams({ offset: String(offset), count: String(count), channelId: '' })
    const res = await fetch(BASE_URL + '/secure/getRadioList', {
      method: 'POST',
      headers: {
        Authorization: token,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    })
    if (!res.ok) return { items: [], error: true }
    const text = await res.text()
    const data = typeof text === 'string' ? JSON.parse(text) : text
    if (checkAccessDenied(data)) return { items: [], error: true }
    if (!data.status) return { items: [], error: true }
    const list: RadioStation[] = data.response?.radioList ?? []
    return { items: list, error: false }
  } catch {
    return { items: [], error: true }
  }
}
