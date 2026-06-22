import { useState, useEffect, useCallback, useRef } from 'react'
import { useFocusable, FocusContext } from '@noriginmedia/norigin-spatial-navigation'
import { ContentRow } from '../components/ui/ContentRow'
import { fetchDashboard } from '../api/dashboardApi'
import { useAppStore } from '../store/appStore'
import { playNative, shouldUseNativePlayer } from '../platform/nativeVideoPlayer'
import { tvStorage } from '../platform/storage'
import type { PlaylistItem } from '../store/appStore'
import type { ContentItem, ContentRow as ContentRowType } from '../types/content'

interface HomeCache {
  rows: ContentRowType[]
  scrollTop: number
  lastFocusKey: string
}

let _cache: HomeCache | null = null

export function clearHomeCache() { _cache = null }

export function HomeScreen() {
  const { navigate, navigateToMovieDetail, navigateToTvShowDetail, navigateToRadioPlayer, setHomeScrolled, homeScrolled } = useAppStore()

  const ROW_VIEW_MORE: Record<string, () => void> = {
    'home-channels': () => navigate('livetv'),
    'home-movies':   () => navigate('movies'),
    'home-tvshows':  () => navigate('tvshows'),
    'home-radio':    () => navigate('radio'),
  }
  const { ref, focusKey, setFocus } = useFocusable({ focusKey: 'home-screen', trackChildren: true })

  const initialCache = useRef(_cache).current

  const [rows, setRows] = useState<ContentRowType[]>(initialCache?.rows ?? [])
  const [loading, setLoading] = useState(!initialCache)
  const [firstRowItem, setFirstRowItem] = useState<ContentItem | null>(null)
  const [isFirstRowFocused, setIsFirstRowFocused] = useState(true)
  const [banners, setBanners] = useState<string[]>(() => {
    try {
      const cached = tvStorage.getItem('dashboard_banners')
      if (cached) return JSON.parse(cached)
    } catch {}
    return []
  })
  const [bannerIdx, setBannerIdx] = useState(0)

  useEffect(() => {
    if (banners.length === 0) return
    const t = setInterval(() => setBannerIdx(i => (i + 1) % banners.length), 5000)
    return () => clearInterval(t)
  }, [banners.length])

  const scrollRef = useRef<HTMLDivElement>(null)
  const lastFocusKeyRef = useRef(initialCache?.lastFocusKey ?? '')
  const rowsRef = useRef(rows)
  const stateRef = useRef({ rows })
  const focusedRowRef = useRef(0)

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onScroll = () => setHomeScrolled(el.scrollTop > 10)
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [setHomeScrolled])

  useEffect(() => {
    rowsRef.current = rows
    stateRef.current = { rows }
  }, [rows])

  const saveCache = useCallback(() => {
    const s = stateRef.current
    _cache = {
      rows: s.rows,
      scrollTop: scrollRef.current?.scrollTop ?? 0,
      lastFocusKey: lastFocusKeyRef.current,
    }
  }, [])

  useEffect(() => {
    if (initialCache) {
      setHomeScrolled(initialCache.scrollTop > 10)
      if (initialCache.rows.length > 0 && initialCache.rows[0].items.length > 0) {
        setFirstRowItem(initialCache.rows[0].items[0])
      }
      setTimeout(() => {
        if (lastFocusKeyRef.current) setFocus(lastFocusKeyRef.current)
        if (scrollRef.current) scrollRef.current.scrollTop = initialCache.scrollTop
      }, 60)
      return
    }
    setHomeScrolled(false)
    fetchDashboard().then((data) => {
      if (data) {
        setRows(data.rows)
        if (data.banners && data.banners.length > 0) {
          setBanners(data.banners)
          tvStorage.setItem('dashboard_banners', JSON.stringify(data.banners))
        }
        if (data.rows.length > 0) {
          const firstKey = `card-row-${data.rows[0].id}-0`
          lastFocusKeyRef.current = firstKey
          if (data.rows[0].items.length > 0) setFirstRowItem(data.rows[0].items[0])
          setTimeout(() => setFocus(firstKey), 150)
        }
      }
      setLoading(false)
    })
  }, [setFocus, initialCache, setHomeScrolled])

  const handleSelect = useCallback(async (item: ContentItem) => {
    saveCache()
    if (item.type === 'movie') {
      const numId = parseInt(item.id.replace('mv-', ''), 10)
      if (!isNaN(numId)) { navigateToMovieDetail(numId); return }
    }
    if (item.type === 'series') {
      const numId = parseInt(item.id.replace('tv-', ''), 10)
      if (!isNaN(numId)) { navigateToTvShowDetail(numId); return }
    }
    if (item.id.startsWith('radio-')) {
      const numId = parseInt(item.id.replace('radio-', ''), 10)
      if (!isNaN(numId)) { navigateToRadioPlayer(numId); return }
    }
    if (!item.streamUrl) {
      navigate('detail', item)
      return
    }
    const isLiveChannel = item.id.startsWith('ch-')
    let playlist: PlaylistItem[] | undefined
    let playlistIndex: number | undefined
    if (!isLiveChannel) {
      const rows = rowsRef.current
      for (const row of rows) {
        const idx = row.items.findIndex(i => i.id === item.id)
        if (idx >= 0) {
          const playable = row.items.filter(i => !!i.streamUrl && !i.id.startsWith('ch-'))
          const itemIdx = playable.findIndex(i => i.id === item.id)
          if (playable.length > 1 && itemIdx >= 0) {
            playlist = playable.map(i => ({ url: i.streamUrl!, title: i.title, movieId: 0, thumbnailUrl: i.thumbnailUrl }))
            playlistIndex = itemIdx
          }
          break
        }
      }
    }
    const launched = await playNative(item.streamUrl, item.title, undefined, isLiveChannel, playlist, playlistIndex)
    if (!launched && !shouldUseNativePlayer()) {
      const itemWithPlaylist = playlist ? { ...item, playlist, playlistIndex } : item
      navigate('player', itemWithPlaylist)
    }
  }, [navigate, navigateToMovieDetail, navigateToTvShowDetail, navigateToRadioPlayer, saveCache])

  const handleItemFocused = useCallback((item: ContentItem) => {
    const rows = rowsRef.current
    for (let r = 0; r < rows.length; r++) {
      const idx = rows[r].items.findIndex(i => i.id === item.id)
      if (idx >= 0) {
        lastFocusKeyRef.current = `card-row-${rows[r].id}-${idx}`
        if (r === 0) {
          setFirstRowItem(item)
          setIsFirstRowFocused(true)
          if (focusedRowRef.current !== 0) {
            scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
          }
        } else {
          setIsFirstRowFocused(false)
        }
        focusedRowRef.current = r
        break
      }
    }
  }, [])

  const heroGenre = firstRowItem?.genre?.length ? firstRowItem.genre.slice(0, 3).join(' · ') : ''
  const heroYear = firstRowItem?.year ? String(firstRowItem.year) : ''
  const heroRating = firstRowItem?.rating ?? ''
  const heroMeta = [heroYear, heroRating].filter(Boolean).join('  ·  ')

  return (
    <FocusContext.Provider value={focusKey}>
      <div ref={ref} style={{ height: '100%', overflow: 'hidden', backgroundImage: homeScrolled ? 'none' : (banners[bannerIdx] ? `url(${banners[bannerIdx]})` : 'none'), backgroundColor: '#000000', backgroundSize: 'cover', backgroundPosition: 'center', position: 'relative', transition: 'background-image 0.8s ease-in-out' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: homeScrolled ? '#000000' : 'rgba(0,0,0,0.40)', zIndex: 0, pointerEvents: 'none', transition: 'background 0.3s ease' }} />

        {/* Red gradient at top when scrolled */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0,
          height: 120,
          background: 'linear-gradient(to bottom, rgba(180,0,0,0.55) 0%, rgba(120,0,0,0.25) 40%, transparent 100%)',
          zIndex: 2,
          pointerEvents: 'none',
          opacity: homeScrolled ? 1 : 0,
          transition: 'opacity 0.4s ease',
        }} />

        {banners.length > 1 && !homeScrolled && (
          <div style={{
            position: 'absolute', right: '5vw', top: 328, zIndex: 2, pointerEvents: 'none',
            display: 'flex', gap: 8, alignItems: 'center',
            transition: 'opacity 0.5s',
            opacity: homeScrolled ? 0 : 1,
          }}>
            {banners.map((_, i) => (
              <div key={i} style={{
                width: i === bannerIdx ? 20 : 8,
                height: 8,
                borderRadius: 999,
                background: i === bannerIdx ? '#fff' : 'rgba(255,255,255,0.35)',
                transition: 'all 0.4s ease',
              }} />
            ))}
          </div>
        )}

        <div
          ref={scrollRef}
          style={{ height: '100%', overflowY: 'auto', overflowX: 'hidden', position: 'relative', zIndex: 1, scrollPaddingTop: 80 }}
          className="scrollbar-hide"
        >
          {loading && rows.length === 0 && (
            <div style={{ 
              position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, 
              display: 'flex', alignItems: 'center', justifyContent: 'center', 
              color: 'rgba(255,255,255,0.4)', fontSize: 16, zIndex: 10 
            }}>
              Loading…
            </div>
          )}

          <div style={{ paddingBottom: 64, paddingTop: 320, scrollMarginTop: 16 }}>

            {rows.map((row, idx) => (
              <ContentRow
                key={row.id}
                row={row}
                onSelect={handleSelect}
                onItemFocused={handleItemFocused}
                focusKey={`row-${row.id}`}
                cardAspect={row.id === 'home-movies' ? 'portrait' : 'landscape'}
                showLiveBadge={row.id === 'home-channels'}
                hideTextOverlay={row.id === 'home-channels'}
                onViewMore={ROW_VIEW_MORE[row.id]}
                isFirstRow={idx === 0}
                onUp={() => {
                  if (idx === 0) {
                    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
                    setFocus('nav-home')
                  } else {
                    setFocus(`card-row-${rows[idx - 1].id}-0`)
                  }
                }}
                onDown={idx < rows.length - 1 ? () => setFocus(`card-row-${rows[idx + 1].id}-0`) : undefined}
              />
            ))}
          </div>
        </div>
      </div>
    </FocusContext.Provider>
  )
}
