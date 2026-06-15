export interface RegisterParams {
  name: string
  userCountry: string
  userMobile: string
  referalCode?: string
  deviceID: string
  mobileType: string
  device_token: string
}

export interface RegisterResponse {
  response: {
    userId: number
    userName: string
    userEmail: string
    userMobile: string
    userCountry: string
    userCountryId: string
    userCreatedDate: string
    userCountryCode: string
    token_type: string
    expires_in: number
    access_token: string
    refresh_token: string
  }
  message: string
  error_type: string
  status: boolean
}

export async function registerUser(params: RegisterParams): Promise<RegisterResponse> {
  const body = new FormData()
  body.append('grant_type', 'password')
  body.append('client_id', 'saalai_app')
  body.append('name', params.name)
  body.append('userCountry', params.userCountry)
  body.append('userMobile', params.userMobile)
  body.append('deviceID', params.deviceID)
  body.append('mobileType', params.mobileType)
  body.append('device_token', params.device_token)
  body.append('referalCode', params.referalCode ?? '')

  const res = await fetch('https://staging.saalai.tv/saalai_app/checkRegister', {
    method: 'POST',
    body,
  })

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`)
  }

  return res.json() as Promise<RegisterResponse>
}

export interface Country {
  id: string
  name: string
  code: string
}

export const COUNTRIES: Country[] = [
  { id: '101', name: 'India', code: '91' },
  { id: '235', name: 'United Kingdom', code: '44' },
  { id: '231', name: 'United States', code: '1' },
  { id: '13',  name: 'Australia', code: '61' },
  { id: '38',  name: 'Canada', code: '1' },
  { id: '82',  name: 'Germany', code: '49' },
  { id: '75',  name: 'France', code: '33' },
  { id: '105', name: 'Italy', code: '39' },
  { id: '202', name: 'Spain', code: '34' },
  { id: '236', name: 'United Arab Emirates', code: '971' },
  { id: '194', name: 'Singapore', code: '65' },
  { id: '133', name: 'Malaysia', code: '60' },
  { id: '166', name: 'New Zealand', code: '64' },
  { id: '185', name: 'Saudi Arabia', code: '966' },
  { id: '39',  name: 'Sri Lanka', code: '94' },
]
