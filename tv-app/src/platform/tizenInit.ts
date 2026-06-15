interface TizenInputDevice {
  registerKey(keyName: string): void
  unregisterKey(keyName: string): void
  getSupportedKeys(): Array<{ name: string; code: number }>
}

interface TizenTV {
  tvinputdevice: TizenInputDevice
  application: {
    getCurrentApplication(): { exit(): void }
  }
}

const TIZEN_KEYS = [
  'Back',
  'MediaPlay',
  'MediaPause',
  'MediaPlayPause',
  'MediaStop',
  'MediaRewind',
  'MediaFastForward',
  'ColorF0Red',
  'ColorF1Green',
  'ColorF2Yellow',
  'ColorF3Blue',
]

export function initTizen(): void {
  const win = window as unknown as { tizen?: TizenTV }
  const tizen = win.tizen
  if (!tizen?.tvinputdevice) return

  let supported: string[] = []
  try {
    supported = tizen.tvinputdevice.getSupportedKeys().map((k) => k.name)
  } catch {
    return
  }

  for (const key of TIZEN_KEYS) {
    if (supported.includes(key)) {
      try {
        tizen.tvinputdevice.registerKey(key)
      } catch {
      }
    }
  }
}
