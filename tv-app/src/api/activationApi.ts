import { tvStorage } from '../platform/storage'

const DEVICE_ID_KEY = 'tv_device_id'
const ACCESS_TOKEN_KEY = 'tv_access_token'

function getOrCreateDeviceId(): string {
  let id = tvStorage.getItem(DEVICE_ID_KEY)
  if (!id) {
    id = Array.from({ length: 16 }, () =>
      Math.floor(Math.random() * 16).toString(16)
    ).join('')
    tvStorage.setItem(DEVICE_ID_KEY, id)
  }
  return id
}

export interface ActivationResult {
  success: boolean
  message: string
}

export async function callActivationApi(activationCode: string): Promise<ActivationResult> {
  const deviceId = getOrCreateDeviceId()
  const body = JSON.stringify({
    activationCode,
    deviceName: 'SaalaiTV',
    deviceId,
    version: '1.0',
  })

  try {
    const res = await fetch('https://staging.saalai.tv/saalai_app/sendActivationCode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    })

    const data = await res.json()
    console.log('ACTIVATION_RESPONSE:', JSON.stringify(data))

    if (data.result === 'true' || data.result === true || data.status === true || data.status === 'true') {
      const raw =
        data.accessToken ??
        data.access_token ??
        data.token?.access_token ??
        data.token?.accessToken ??
        data.jwt ??
        data.bearerToken ??
        data.bearer_token ??
        data.authToken ??
        data.auth_token ??
        data.device_token ??
        data.deviceToken ??
        data.api_token ??
        (typeof data.token === 'string' ? data.token : undefined) ??
        data.response?.accessToken ??
        data.response?.access_token ??
        data.response?.token?.access_token ??
        data.response?.token ??
        data.response?.jwt ??
        data.response?.bearerToken ??
        data.response?.bearer_token ??
        data.data?.accessToken ??
        data.data?.access_token ??
        data.data?.token?.access_token ??
        data.data?.token ??
        data.data?.jwt ??
        ''
      const rawStr = typeof raw === 'string' ? raw.trim() : (raw ? String(raw) : '')
      const tokenType: string = typeof data.token?.token_type === 'string' ? data.token.token_type : 'Bearer'
      const token = rawStr && !rawStr.toLowerCase().startsWith('bearer ') ? `${tokenType} ${rawStr}` : rawStr
      console.log('ACTIVATION_TOKEN_EXTRACTED:', token ? token.substring(0, 50) + '...' : '(empty)')
      if (token && token.includes('.')) {
        tvStorage.setItem(ACCESS_TOKEN_KEY, token)
      }
      return { success: token.includes('.'), message: token.includes('.') ? (data.message ?? 'Activated!') : 'Activation succeeded but token was not returned. Please contact support.' }
    }

    return { success: false, message: data.message ?? 'Invalid Activation Code.' }
  } catch (err) {
    console.log('ACTIVATION_ERROR:', String(err))
    return { success: false, message: 'Network error. Please try again.' }
  }
}
