import { tvStorage } from '../platform/storage'
export const BASE_URL = import.meta.env.DEV ? '/smartapi_v1' : 'https://thirai.net/smartapi_v1';
export function checkAccessDenied(data: Record<string, unknown>): boolean {
  if (data?.error === 'access_denied') {
    tvStorage.removeItem('tv_activated')
    tvStorage.removeItem('tv_access_token')
    window.location.reload()
    return true
  }
  return false
}

export function setupFetchInterceptor() {
  const originalFetch = window.fetch;
  window.fetch = async function (...args) {
    const response = await originalFetch.apply(this, args);
    
    // Check HTTP status
    if (response.status === 401 || response.status === 403) {
      tvStorage.removeItem('tv_activated');
      tvStorage.removeItem('tv_access_token');
      window.location.reload();
      return response;
    }

    // Check JSON payload for access_denied
    try {
      const clone = response.clone();
      const text = await clone.text();
      if (text) {
        const data = JSON.parse(text);
        if (data?.error === 'access_denied' || data?.error_type === 'access_denied' || data?.error === 'invalid_token') {
          tvStorage.removeItem('tv_activated');
          tvStorage.removeItem('tv_access_token');
          window.location.reload();
        }
      }
    } catch (e) {
      // Ignore errors parsing body
    }

    return response;
  };
}
