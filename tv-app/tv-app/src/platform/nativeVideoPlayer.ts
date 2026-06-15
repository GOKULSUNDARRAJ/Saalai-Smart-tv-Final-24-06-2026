import { registerPlugin } from '@capacitor/core'
import { updateStreamTime } from '../api/moviesApi'
import { tvStorage } from './storage'

const FALLBACK_URL = 'https://www.w3schools.com/html/mov_bbb.mp4'

interface VideoPlayerPlugin {
  play(options: { url: string; title?: string; fallbackUrl?: string; startPositionMs?: number; playlistJson?: string; playlistIndex?: number }): Promise<{ positionMs: number; blocked?: boolean }>
  endPlay(): Promise<void>
}

const VideoPlayer = registerPlugin<VideoPlayerPlugin>('VideoPlayer')

let isNativePlaying = false
let lastPlayEndMs = 0
const PLAY_DEBOUNCE_MS = 800

function isAndroid(): boolean {
  try {
    const cap = (window as unknown as { Capacitor?: { isNativePlatform(): boolean; getPlatform(): string } }).Capacitor
    return !!(cap?.isNativePlatform() && cap?.getPlatform() === 'android')
  } catch {
    return false
  }
}

export async function playNative(
  url: string,
  title?: string,
  playlist?: { url: string; title: string; thumbnailUrl?: string }[],
  playlistIndex?: number,
): Promise<boolean> {
  if (!isAndroid()) return false
  try {
    const fallbackUrl = url !== FALLBACK_URL ? FALLBACK_URL : ''
    await VideoPlayer.play({
      url,
      title: title ?? '',
      fallbackUrl,
      playlistJson: playlist && playlist.length > 1 ? JSON.stringify(playlist) : '',
      playlistIndex: playlistIndex ?? 0,
    })
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
  if (isNativePlaying) return false
  if (Date.now() - lastPlayEndMs < PLAY_DEBOUNCE_MS) return false
  isNativePlaying = true
  try {
    const fallbackUrl = url !== FALLBACK_URL ? FALLBACK_URL : ''
    const result = await VideoPlayer.play({
      url,
      title: title ?? '',
      fallbackUrl,
      startPositionMs: startPositionMs ?? 0,
    })
    if (result?.blocked) {
      isNativePlaying = false
      lastPlayEndMs = Date.now()
      return false
    }
    const positionMs = result?.positionMs ?? 0
    if (positionMs > 0) {
      tvStorage.setItem(`resume_pos_${movieId}`, String(positionMs))
      await updateStreamTime(movieId, 1, positionMs)
    }
    try { await VideoPlayer.endPlay() } catch {}
    isNativePlaying = false
    lastPlayEndMs = Date.now()
    return true
  } catch {
    try { await VideoPlayer.endPlay() } catch {}
    isNativePlaying = false
    lastPlayEndMs = Date.now()
    return false
  }
}
