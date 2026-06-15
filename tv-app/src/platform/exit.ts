import { platform } from './index'

interface TizenApplication {
  getCurrentApplication(): { exit(): void }
}
interface TizenAPI {
  application: TizenApplication
}

export function exitApp(): void {
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
