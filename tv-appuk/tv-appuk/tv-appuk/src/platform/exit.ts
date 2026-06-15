import { platform } from './index'

interface TizenApplication {
  getCurrentApplication(): { exit(): void }
}
interface TizenAPI {
  application: TizenApplication
}

function isCapacitorAndroid(): boolean {
  try {
    const cap = (window as unknown as { Capacitor?: { isNativePlatform(): boolean; getPlatform(): string } }).Capacitor
    return !!(cap?.isNativePlatform() && cap?.getPlatform() === 'android')
  } catch {
    return false
  }
}

export function exitApp(): void {
  if (isCapacitorAndroid()) {
    const native = (window as unknown as { AndroidNative?: { exit(): void } }).AndroidNative
    if (native?.exit) {
      native.exit()
      return
    }
  }

  switch (platform) {
    case 'tizen': {
      const tizen = (window as unknown as { tizen?: TizenAPI }).tizen
      tizen?.application.getCurrentApplication().exit()
      break
    }
    case 'webos': {
      const webOS = (window as unknown as { webOS?: { platformBack(): void } }).webOS
      webOS?.platformBack()
      break
    }
    case 'androidtv':
    case 'firetv':
      window.history.back()
      break
    default:
      window.close()
  }
}
