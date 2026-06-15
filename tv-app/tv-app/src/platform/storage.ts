const memoryStore = new Map<string, string>()

function isLocalStorageAvailable(): boolean {
  try {
    localStorage.setItem('__test__', '1')
    localStorage.removeItem('__test__')
    return true
  } catch {
    return false
  }
}

const useLocalStorage = isLocalStorageAvailable()

export const tvStorage = {
  getItem(key: string): string | null {
    if (useLocalStorage) return localStorage.getItem(key)
    return memoryStore.get(key) ?? null
  },

  setItem(key: string, value: string): void {
    if (useLocalStorage) {
      localStorage.setItem(key, value)
    } else {
      memoryStore.set(key, value)
    }
  },

  removeItem(key: string): void {
    if (useLocalStorage) {
      localStorage.removeItem(key)
    } else {
      memoryStore.delete(key)
    }
  },

  getJSON<T>(key: string): T | null {
    const raw = this.getItem(key)
    if (!raw) return null
    try {
      return JSON.parse(raw) as T
    } catch {
      return null
    }
  },

  setJSON<T>(key: string, value: T): void {
    this.setItem(key, JSON.stringify(value))
  },
}
