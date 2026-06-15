import { tvStorage } from '../platform/storage'

export function checkAccessDenied(data: Record<string, unknown>): boolean {
  if (data?.error === 'access_denied') {
    tvStorage.removeItem('tv_activated')
    tvStorage.removeItem('tv_access_token')
    window.location.reload()
    return true
  }
  return false
}
