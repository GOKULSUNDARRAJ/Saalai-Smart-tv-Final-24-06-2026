import { tvStorage } from '../platform/storage'

const BASE_URL = 'https://staging.saalai.tv/saalai_app'

export interface ContactEntry {
  country: string
  contactNo: string
}

export interface SocialEntry {
  contactNo: string
  type: string
  url: string
}

export interface ContactUsData {
  title: string
  desc: string
  list: ContactEntry[]
  socialList: SocialEntry[]
}

export async function fetchContactUs(): Promise<ContactUsData | null> {
  try {
    const token = tvStorage.getItem('tv_access_token') ?? ''
    const headers: Record<string, string> = {}
    if (token) headers['Authorization'] = token

    const res = await fetch(`${BASE_URL}/contactUs`, { method: 'POST', headers })
    if (!res.ok) return null
    const text = await res.text()
    const data = typeof text === 'string' ? JSON.parse(text) : text

    if ((data.result === 'true' || data.result === true) && data.response) {
      return data.response as ContactUsData
    }
    return null
  } catch {
    return null
  }
}
