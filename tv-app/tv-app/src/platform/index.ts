export type TVPlatform =
  | 'tizen'
  | 'webos'
  | 'roku'
  | 'androidtv'
  | 'firetv'
  | 'appletv'
  | 'browser'

function detectPlatform(): TVPlatform {
  const ua = navigator.userAgent.toLowerCase()

  if (ua.includes('tizen')) return 'tizen'
  if (ua.includes('webos') || ua.includes('web0s')) return 'webos'
  if (ua.includes('roku')) return 'roku'
  if ((window as unknown as { Amazon?: unknown }).Amazon !== undefined) return 'firetv'
  if (ua.includes('atv') || ua.includes('android tv')) return 'androidtv'
  if (ua.includes('appletv') || ua.includes('tvos')) return 'appletv'

  return 'browser'
}

export const platform: TVPlatform = detectPlatform()

export const isTizen = platform === 'tizen'
export const isWebOS = platform === 'webos'
export const isRoku = platform === 'roku'
export const isAndroidTV = platform === 'androidtv'
export const isFireTV = platform === 'firetv'
export const isAppleTV = platform === 'appletv'
export const isBrowser = platform === 'browser'
