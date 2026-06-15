import { registerPlugin } from '@capacitor/core'
import { updateStreamTime } from '../api/moviesApi'

const FALLBACK_URL = 'https://www.w3schools.com/html/mov_bbb.mp4'

interface VideoPlayerPlugin {
  play(options: { url: string; title?: string; fallbackUrl?: string; startPositionMs?: number }): Promise<{ positionMs: number }>
}

const VideoPlayer = registerPlugin<VideoPlayerPlugin>('VideoPlayer')

function isAndroid(): boolean {
  try {
    const cap = (window as unknown as { Capacitor?: { isNativePlatform(): boolean; getPlatform(): string } }).Capacitor
    return !!(cap?.isNativePlatform() && cap?.getPlatform() === 'android')
  } catch {
    return false
  }
}

export async function playNative(url: string, title?: string): Promise<boolean> {
  if (!isAndroid()) return false
  try {
    const fallbackUrl = url !== FALLBACK_URL ? FALLBACK_URL : ''
    await VideoPlayer.play({ url, title: title ?? '', fallbackUrl })
    return true
  } catch {
    return false
  }
}

export async function playNativeMovie(
  url: string,
  title: string,
  movieId: number,
  startPositionMs?: number,
): Promise<boolean> {
  if (!isAndroid()) return false
  try {
    const fallbackUrl = url !== FALLBACK_URL ? FALLBACK_URL : ''
    const result = await VideoPlayer.play({
      url,
      title: title ?? '',
      fallbackUrl,
      startPositionMs: startPositionMs ?? 0,
    })
    const positionMs = result?.positionMs ?? 0
    if (positionMs > 0) {
      await updateStreamTime(movieId, 1, positionMs)
    }
    return true
  } catch {
    return false
  }
}
