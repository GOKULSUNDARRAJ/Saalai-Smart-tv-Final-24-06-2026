import { registerPlugin } from '@capacitor/core'
import { updateStreamTime } from '../api/moviesApi'
import { tvStorage } from './storage'
import { useAppStore } from '../store/appStore'
import type { PlaylistItem } from '../store/appStore'

const FALLBACK_URL = 'https://www.w3schools.com/html/mov_bbb.mp4'

interface VideoPlayerPlugin {
  play(options: { url: string; title?: string; fallbackUrl?: string; startPositionMs?: number; movieId?: number; forceFromBeginning?: boolean; isLive?: boolean; disableResumeSave?: boolean; playlistJson?: string; playlistIndex?: number; relatedJson?: string }): Promise<{ positionMs: number; blocked?: boolean; navigateToMovieId?: number; lastPlayedMovieId?: number; url?: string; durationMs?: number }>
  endPlay(): Promise<void>
  getResumePosition(options: { movieId: number }): Promise<{ positionMs: number; durationMs?: number }>
  getResumePositionByTitle(options: { title: string }): Promise<{ positionMs: number }>
}

const VideoPlayer = registerPlugin<VideoPlayerPlugin>('VideoPlayer')

let isNativePlaying = false
let lastPlayEndMs = 0
const PLAY_DEBOUNCE_MS = 800
const BACK_DEBOUNCE_AFTER_PLAY_MS = 600

export function wasRecentNativePlayback(): boolean {
  return shouldUseNativePlayer() && Date.now() - lastPlayEndMs < BACK_DEBOUNCE_AFTER_PLAY_MS
}

export function shouldUseTizenPlayer(): boolean {
  return !!(window as unknown as { webapis?: { avplay?: unknown } }).webapis?.avplay
}

export function shouldUseNativePlayer(): boolean {
  try {
    const cap = (window as unknown as { Capacitor?: { isNativePlatform(): boolean; getPlatform(): string } }).Capacitor
    return !!(cap?.isNativePlatform() && cap?.getPlatform() === 'android')
  } catch {
    return false
  }
}

export async function playNative(url: string, title?: string, startPositionMs?: number, isLive?: boolean, playlist?: PlaylistItem[], playlistIndex?: number, movieId?: number, disableResumeSave?: boolean, forceFromBeginning?: boolean): Promise<{ success: boolean; lastPlayedMovieId?: number }> {
  if (shouldUseTizenPlayer()) {
    useAppStore.getState().navigateToTizenPlayer({ url, title: title ?? '', movieId: movieId ?? 0, startPositionMs: startPositionMs ?? 0, forceFromBeginning: forceFromBeginning ?? false, isLive: isLive ?? false, disableResumeSave: disableResumeSave ?? false, playlist, playlistIndex })
    return { success: true }
  }
  if (!shouldUseNativePlayer()) return { success: false }
  if (isNativePlaying) return { success: false }
  if (Date.now() - lastPlayEndMs < PLAY_DEBOUNCE_MS) return { success: false }
  isNativePlaying = true
  try {
    const fallbackUrl = url !== FALLBACK_URL ? FALLBACK_URL : ''
    const playlistJson = playlist && playlist.length > 1 ? JSON.stringify(playlist) : undefined
    const result = await VideoPlayer.play({ url, title: title ?? '', fallbackUrl, startPositionMs: startPositionMs ?? 0, movieId: movieId ?? 0, isLive: isLive ?? false, disableResumeSave: disableResumeSave ?? false, forceFromBeginning: forceFromBeginning ?? false, playlistJson, playlistIndex: playlistIndex ?? 0 })
    if (result?.blocked) {
      isNativePlaying = false
      lastPlayEndMs = Date.now()
      return { success: false }
    }
    isNativePlaying = false
    lastPlayEndMs = Date.now()
    VideoPlayer.endPlay().catch(() => {})

    const positionMs = result?.positionMs ?? 0
    const durationMs = result?.durationMs ?? 0
    const resolvedUrl = result?.url || url
    const playlistProgressStr = (result as any)?.playlistProgress || '{}'

    if (!disableResumeSave) {
      if (positionMs > 0) {
        if (movieId && movieId > 0) {
          tvStorage.setItem(`resume_pos_${movieId}`, String(positionMs))
          if (durationMs > 0) tvStorage.setItem(`resume_dur_${movieId}`, String(durationMs))
        } else if (resolvedUrl) {
          tvStorage.setItem(`resume_pos_${resolvedUrl}`, String(positionMs))
          if (durationMs > 0) tvStorage.setItem(`resume_dur_${resolvedUrl}`, String(durationMs))
        }
      }

      try {
        const progressMap = JSON.parse(playlistProgressStr)
        for (const urlKey of Object.keys(progressMap)) {
          const item = progressMap[urlKey]
          if (item && item.positionMs > 0) {
            tvStorage.setItem(`resume_pos_${urlKey}`, String(item.positionMs))
            if (item.durationMs > 0) {
              tvStorage.setItem(`resume_dur_${urlKey}`, String(item.durationMs))
            }
          }
        }
      } catch (e) {
        console.error('Failed to parse playlist progress', e)
      }
    }

    return { success: true, lastPlayedMovieId: result?.lastPlayedMovieId }
  } catch {
    isNativePlaying = false
    lastPlayEndMs = Date.now()
    VideoPlayer.endPlay().catch(() => {})
    return { success: false }
  }
}

export async function playNativeMovie(
  url: string,
  title: string,
  movieId: number,
  startPositionMs?: number,
  forceFromBeginning?: boolean,
  relatedJson?: string,
): Promise<boolean> {
  if (shouldUseTizenPlayer()) {
    useAppStore.getState().navigateToTizenPlayer({ url, title, movieId, startPositionMs: startPositionMs ?? 0, forceFromBeginning: forceFromBeginning ?? false })
    return true
  }
  if (!shouldUseNativePlayer()) return false
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
      movieId,
      forceFromBeginning: forceFromBeginning ?? false,
      relatedJson,
    })
    if (result?.blocked) {
      isNativePlaying = false
      lastPlayEndMs = Date.now()
      return false
    }
    isNativePlaying = false
    lastPlayEndMs = Date.now()
    VideoPlayer.endPlay().catch(() => {})
    const navigateToMovieId = result?.navigateToMovieId ?? 0
    if (navigateToMovieId > 0) {
      const posMs = result?.positionMs ?? 0
      useAppStore.getState().navigateToMovieDetailWithAndroidResume(navigateToMovieId, {
        movieId,
        url,
        title,
        startMs: posMs,
        relatedJson,
      })
      return true
    }
    let positionMs = result?.positionMs ?? 0
    try {
      const stored = await VideoPlayer.getResumePosition({ movieId })
      if ((stored?.positionMs ?? 0) > 0) positionMs = stored.positionMs
    } catch { }
    if (positionMs > 0) {
      tvStorage.setItem(`resume_pos_${movieId}`, String(positionMs))
      updateStreamTime(movieId, 1, positionMs).catch(() => {})
    }
    return true
  } catch {
    VideoPlayer.endPlay().catch(() => {})
    isNativePlaying = false
    lastPlayEndMs = Date.now()
    return false
  }
}

export async function fetchAndSaveEpisodePosition(movieId: number): Promise<number> {
  if (!shouldUseNativePlayer()) return 0
  try {
    const res = await VideoPlayer.getResumePosition({ movieId })
    const posMs = res?.positionMs ?? 0
    const durMs = res?.durationMs ?? 0
    if (posMs > 0) {
      tvStorage.setItem(`resume_pos_${movieId}`, String(posMs))
    }
    if (durMs > 0) {
      tvStorage.setItem(`episode_dur_${movieId}`, String(durMs))
    }
    return posMs
  } catch {
    return 0
  }
}

export async function getResumePositionByTitle(title: string): Promise<number> {
  if (!shouldUseNativePlayer()) return 0
  try {
    const res = await VideoPlayer.getResumePositionByTitle({ title })
    return res?.positionMs ?? 0
  } catch {
    return 0
  }
}
