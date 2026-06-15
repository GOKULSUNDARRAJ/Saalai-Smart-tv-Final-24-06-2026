export enum TVKey {
  UP = 'UP',
  DOWN = 'DOWN',
  LEFT = 'LEFT',
  RIGHT = 'RIGHT',
  OK = 'OK',
  BACK = 'BACK',
  HOME = 'HOME',
  PLAY = 'PLAY',
  PAUSE = 'PAUSE',
  PLAY_PAUSE = 'PLAY_PAUSE',
  STOP = 'STOP',
  REWIND = 'REWIND',
  FAST_FORWARD = 'FAST_FORWARD',
  RED = 'RED',
  GREEN = 'GREEN',
  YELLOW = 'YELLOW',
  BLUE = 'BLUE',
  UNKNOWN = 'UNKNOWN',
}

const STANDARD_KEY_MAP: Record<string, TVKey> = {
  ArrowUp: TVKey.UP,
  ArrowDown: TVKey.DOWN,
  ArrowLeft: TVKey.LEFT,
  ArrowRight: TVKey.RIGHT,
  Enter: TVKey.OK,
  ' ': TVKey.PLAY_PAUSE,
  Escape: TVKey.BACK,
  Backspace: TVKey.BACK,
  GoBack: TVKey.BACK,
  MediaPlayPause: TVKey.PLAY_PAUSE,
  MediaPlay: TVKey.PLAY,
  MediaPause: TVKey.PAUSE,
  MediaStop: TVKey.STOP,
  MediaRewind: TVKey.REWIND,
  MediaFastForward: TVKey.FAST_FORWARD,
}

const ANDROID_KEY_MAP: Record<number, TVKey> = {
  19: TVKey.UP,
  20: TVKey.DOWN,
  21: TVKey.LEFT,
  22: TVKey.RIGHT,
  23: TVKey.OK,
  66: TVKey.OK,
  4: TVKey.BACK,
  36: TVKey.HOME,
  85: TVKey.PLAY_PAUSE,
  126: TVKey.PLAY,
  127: TVKey.PAUSE,
  89: TVKey.REWIND,
  90: TVKey.FAST_FORWARD,
}

const TIZEN_KEY_MAP: Record<number, TVKey> = {
  10009: TVKey.BACK,
  10182: TVKey.HOME,
  10252: TVKey.PLAY_PAUSE,
  415: TVKey.PLAY,
  19: TVKey.PAUSE,
  412: TVKey.REWIND,
  417: TVKey.FAST_FORWARD,
  403: TVKey.RED,
  404: TVKey.GREEN,
  405: TVKey.YELLOW,
  406: TVKey.BLUE,
}

const WEBOS_KEY_MAP: Record<number, TVKey> = {
  461: TVKey.BACK,
  36: TVKey.HOME,
  415: TVKey.PLAY,
  19: TVKey.PAUSE,
  412: TVKey.REWIND,
  417: TVKey.FAST_FORWARD,
  403: TVKey.RED,
  404: TVKey.GREEN,
  405: TVKey.YELLOW,
  406: TVKey.BLUE,
}

export function mapKeyEvent(event: KeyboardEvent): TVKey {
  const byName = STANDARD_KEY_MAP[event.key]
  if (byName) return byName

  const byAndroid = ANDROID_KEY_MAP[event.keyCode]
  if (byAndroid) return byAndroid

  const byTizen = TIZEN_KEY_MAP[event.keyCode]
  if (byTizen) return byTizen

  const byWebOS = WEBOS_KEY_MAP[event.keyCode]
  if (byWebOS) return byWebOS

  return TVKey.UNKNOWN
}
