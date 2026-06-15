import { useState, useEffect, useCallback, useRef } from 'react'
import { useFocusable, FocusContext } from '@noriginmedia/norigin-spatial-navigation'
import { fetchTvShowEpisodeList } from '../api/tvShowsApi'
import type { EpisodeDetail, EpisodeItem } from '../api/tvShowsApi'
import { useAppStore } from '../store/appStore'
import { playNative, shouldUseNativePlayer } from '../platform/nativeVideoPlayer'
import type { PlaylistItem } from '../types/content'

const EPISODE_COLS = 3

function EpisodeCard({
  item, focusKey, onArrow, onSelect,
}: {
  item: EpisodeItem; focusKey: string; onArrow: (dir: string) => boolean; onSelect: () => void
}) {
  const [imgError, setImgError] = useState(false)
  const domRef = useRef<HTMLDivElement | null>(null)
  const { ref, focused } = useFocusable({
    focusKey,
    onEnterPress: onSelect,
    onArrowPress: onArrow,
  })
  const setRef = useCallback((el: HTMLDivElement | null) => {
    domRef.current = el
    const r = ref as unknown
    if (typeof r === 'function') (r as (e: HTMLDivElement | null) => void)(el)
    else if (r && typeof r === 'object') (r as { current: HTMLDivElement | null }).current = el
  }, [ref])
  useEffect(() => {
    if (!focused || !domRef.current) return
    let parent = domRef.current.parentElement
    while (parent) {
      const ov = getComputedStyle(parent).overflowY
      if (ov === 'auto' || ov === 'scroll') break
      parent = parent.parentElement
    }
    if (!parent) return
    const pRect = parent.getBoundingClientRect()
    const eRect = domRef.current.getBoundingClientRect()
    const safeBottom = pRect.bottom - 64
    const safeTop = pRect.top + 8
    if (eRect.top < safeTop) {
      parent.scrollTop -= safeTop - eRect.top + 8
    } else if (eRect.bottom > safeBottom) {
      parent.scrollTop += eRect.bottom - safeBottom + 16
    }
  }, [focused])

  return (
    <div
      ref={setRef}
      onClick={onSelect}
      style={{
        flex: 1,
        aspectRatio: '16/8',
        borderRadius: 12,
        outline: focused ? '3px solid #e50914' : '3px solid transparent',
        outlineOffset: 3,
        transform: focused ? 'scale(1.06)' : 'scale(1)',
        transition: 'transform 0.15s, outline-color 0.12s',
        zIndex: focused ? 10 : 1,
        cursor: 'pointer',
        position: 'relative',
      }}
    >
      <div style={{ width: '100%', height: '100%', borderRadius: 12, overflow: 'hidden', background: '#1a1a1a', position: 'relative' }}>
        {!imgError ? (
          <img
            src={item.episodeLogo}
            alt={item.episodeName}
            onError={() => setImgError(true)}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : (
          <div style={{
            width: '100%', height: '100%',
            background: 'linear-gradient(135deg, #1a1a2e, #16213e)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 8,
          }}>
            <span style={{ color: '#fff', fontSize: 11, fontWeight: 600, textAlign: 'center', lineHeight: 1.4 }}>
              {item.episodeName}
            </span>
          </div>
        )}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          background: 'linear-gradient(to top, rgba(0,0,0,0.9) 0%, transparent 100%)',
          padding: '18px 6px 6px',
        }}>
          <p style={{ color: '#fff', fontSize: 10, fontWeight: 600, textAlign: 'center', margin: 0, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
            {item.episodeName}
          </p>
          {item.episodeDate ? (
            <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 9, textAlign: 'center', margin: '2px 0 0', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
              {item.episodeDate}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function ActionButton({
  focusKey, primary, children, onPress, onArrow, scrollToTop, onUp,
}: {
  focusKey: string
  primary?: boolean
  children: React.ReactNode
  onPress: () => void
  onArrow: (dir: string) => boolean
  scrollToTop: () => void
  onUp: () => void
}) {
  const { ref, focused } = useFocusable({
    focusKey,
    onEnterPress: onPress,
    onArrowPress: (dir) => {
      if (dir === 'up') { onUp(); return false }
      return onArrow(dir)
    },
    onFocus: scrollToTop,
  })

  return (
    <div
      ref={ref}
      onClick={onPress}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '10px 28px', borderRadius: 8, cursor: 'pointer', outline: 'none',
        border: primary ? 'none' : '2px solid rgba(255,255,255,0.3)',
        background: primary
          ? (focused ? '#e50914' : 'rgba(229,9,20,0.85)')
          : (focused ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.07)'),
        color: '#fff',
        fontWeight: primary ? 700 : 600,
        fontSize: 15,
        transform: focused ? 'scale(1.05)' : 'scale(1)',
        boxShadow: focused
          ? (primary ? '0 0 0 3px rgba(229,9,20,0.4)' : '0 0 0 3px rgba(255,255,255,0.2)')
          : 'none',
        transition: 'transform 0.12s, box-shadow 0.12s, background 0.12s',
      }}
    >
      {children}
    </div>
  )
}

export function TvShowDetailScreen() {
  const { selectedTvShowId, navigate, goBack, getPreviousScreen } = useAppStore()
  const [episodeDetail, setEpisodeDetail] = useState<EpisodeDetail | null>(null)
  const [episodes, setEpisodes] = useState<EpisodeItem[]>([])
  const [loading, setLoading] = useState(true)
  const scrollRef = useRef<HTMLDivElement>(null)

  const { ref, focusKey, setFocus } = useFocusable({ focusKey: 'tvshowdetail-screen', trackChildren: true })


  const scrollToTop = useCallback(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  const loadEpisodes = useCallback(async (channelId: number, episodeId = 0) => {
    setLoading(true)
    if (scrollRef.current) scrollRef.current.scrollTop = 0
    const data = await fetchTvShowEpisodeList(channelId, episodeId)
    setEpisodeDetail(data.episodeDetails)
    setEpisodes(data.episodes)
    setLoading(false)
    setTimeout(() => setFocus('tvshowdetail-play'), 100)
  }, [setFocus])

  useEffect(() => {
    if (!selectedTvShowId) return
    loadEpisodes(selectedTvShowId)
  }, [selectedTvShowId, loadEpisodes])

  const prevScreen = getPreviousScreen()
  const DETAIL_PARENT: Partial<Record<string, string>> = {
    moviedetail: 'movies',
    tvshowdetail: 'tvshows',
    catchupdetail: 'catchup',
    radioplayer: 'radio',
  }
  const resolvedPrev = DETAIL_PARENT[prevScreen] ?? prevScreen
  const prevNavKey = `nav-${resolvedPrev}`

  const handleBack = useCallback(() => {
    const goingToTvShows = prevScreen === 'tvshows'
    const goingToHome = prevScreen === 'home'
    goBack()
    if (!goingToTvShows && !goingToHome) {
      setTimeout(() => setFocus(prevNavKey), 80)
    }
  }, [goBack, setFocus, prevNavKey, prevScreen])

  const handleUpToNav = useCallback(() => {
    setFocus(prevNavKey)
  }, [setFocus, prevNavKey])

  const buildPlaylist = useCallback((
    startDetail: EpisodeDetail,
    allEpisodes: EpisodeItem[],
  ): { playlist: PlaylistItem[]; playlistIndex: number } | undefined => {
    const playableEps = allEpisodes.filter(e => !!e.episodeURL)
    if (playableEps.length === 0) return undefined
    const startItem: PlaylistItem = { url: startDetail.episodeURL, title: startDetail.episodeName, movieId: startDetail.episodeId, thumbnailUrl: startDetail.episodeLogo }
    const rest: PlaylistItem[] = playableEps
      .filter(e => e.episodeId !== startDetail.episodeId)
      .map(e => ({ url: e.episodeURL!, title: e.episodeName, movieId: e.episodeId, thumbnailUrl: e.episodeLogo }))
    const playlist = [startItem, ...rest]
    return playlist.length > 1 ? { playlist, playlistIndex: 0 } : undefined
  }, [])

  const handlePlay = useCallback(async () => {
    if (!episodeDetail) return
    const pl = buildPlaylist(episodeDetail, episodes)
    const launched = await playNative(episodeDetail.episodeURL, episodeDetail.episodeName, undefined, false, pl?.playlist, pl?.playlistIndex, episodeDetail.episodeId, true)
    if (!launched && !shouldUseNativePlayer()) {
      navigate('player', {
        id: `tvshow-${episodeDetail.episodeId}`,
        title: episodeDetail.episodeName,
        description: episodeDetail.episodeDescription ?? '',
        thumbnailUrl: episodeDetail.episodeLogo,
        backdropUrl: episodeDetail.episodeLogo,
        streamUrl: episodeDetail.episodeURL,
        duration: 0,
        genre: [],
        year: new Date().getFullYear(),
        rating: '',
        type: 'episode' as const,
        playlist: pl?.playlist,
        playlistIndex: pl?.playlistIndex,
      })
    }
  }, [episodeDetail, navigate, episodes, buildPlaylist])

  const handleEpisodeSelect = useCallback(async (ep: EpisodeItem) => {
    if (!selectedTvShowId) return
    const data = await fetchTvShowEpisodeList(selectedTvShowId, ep.episodeId)
    const detail = data.episodeDetails
    if (!detail) return
    const allEps = episodes.length > 0 ? episodes : data.episodes
    const pl = buildPlaylist(detail, allEps)
    const launched = await playNative(detail.episodeURL, detail.episodeName, undefined, false, pl?.playlist, pl?.playlistIndex, detail.episodeId, true)
    if (!launched && !shouldUseNativePlayer()) {
      navigate('player', {
        id: `tvshow-${detail.episodeId}`,
        title: detail.episodeName,
        description: detail.episodeDescription ?? '',
        thumbnailUrl: detail.episodeLogo,
        backdropUrl: detail.episodeLogo,
        streamUrl: detail.episodeURL,
        duration: 0,
        genre: [],
        year: new Date().getFullYear(),
        rating: '',
        type: 'episode' as const,
        playlist: pl?.playlist,
        playlistIndex: pl?.playlistIndex,
      })
    }
  }, [selectedTvShowId, navigate, episodes, buildPlaylist])

  const rows = Math.ceil(episodes.length / EPISODE_COLS)

  const episodeArrow = useCallback((row: number, col: number) => (dir: string): boolean => {
    if (dir === 'up') {
      if (row === 0) { scrollToTop(); setFocus('tvshowdetail-play'); return false }
      setFocus(`tvshowdetail-ep-${row - 1}-${col}`); return false
    }
    if (dir === 'down') {
      if (row + 1 < rows) {
        const nextLen = episodes.slice((row + 1) * EPISODE_COLS, (row + 2) * EPISODE_COLS).length
        setFocus(`tvshowdetail-ep-${row + 1}-${Math.min(col, nextLen - 1)}`); return false
      }
      return false
    }
    if (dir === 'left') { if (col > 0) { setFocus(`tvshowdetail-ep-${row}-${col - 1}`); return false } return false }
    if (dir === 'right') {
      const rowLen = episodes.slice(row * EPISODE_COLS, (row + 1) * EPISODE_COLS).length
      if (col < rowLen - 1) { setFocus(`tvshowdetail-ep-${row}-${col + 1}`); return false }
      return false
    }
    return true
  }, [rows, episodes, setFocus, scrollToTop])

  if (loading) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.4)', fontSize: 16 }}>
        Loading…
      </div>
    )
  }

  if (!episodeDetail) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.4)', fontSize: 16 }}>
        No content found
      </div>
    )
  }

  return (
    <FocusContext.Provider value={focusKey}>
      <div ref={ref} style={{ height: '100%', overflow: 'hidden', position: 'relative' }}>
        <div
          ref={scrollRef}
          style={{ height: '100%', overflowY: 'auto', overflowX: 'hidden' }}
          className="scrollbar-hide"
        >
          <div style={{ position: 'relative', marginBottom: 12 }}>
            <img
              src={episodeDetail.episodeLogo}
              alt=""
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.22 }}
            />
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, #0a0a0a 0%, rgba(10,10,10,0.88) 55%, rgba(10,10,10,0.5) 100%)' }} />
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 50%, #0a0a0a 100%)' }} />

            <div style={{ position: 'relative', zIndex: 2, display: 'flex', alignItems: 'flex-start', minHeight: '30vh', padding: '20px 5vw 20px', gap: 24 }}>
              <img
                src={episodeDetail.episodeLogo}
                alt={episodeDetail.episodeName}
                style={{ width: 200, flexShrink: 0, borderRadius: 10, boxShadow: '0 8px 32px rgba(0,0,0,0.6)', objectFit: 'cover', aspectRatio: '16/9' }}
              />

              <div style={{ flex: 1, paddingTop: 4 }}>
                {episodeDetail.episodeNo && episodeDetail.episodeNo.trim() && (
                  <span style={{ background: 'rgba(229,9,20,0.8)', color: '#fff', fontSize: 11, padding: '2px 10px', borderRadius: 4, marginBottom: 8, display: 'inline-block' }}>
                    {episodeDetail.episodeNo.trim()}
                  </span>
                )}
                <h1 style={{ color: '#fff', fontSize: 'clamp(18px, 2.8vw, 34px)', fontWeight: 700, margin: '6px 0 8px', lineHeight: 1.2 }}>
                  {episodeDetail.episodeName}
                </h1>

                {episodeDetail.episodeDescription ? (
                  <p style={{
                    color: 'rgba(255,255,255,0.75)', fontSize: 12, lineHeight: 1.55, marginBottom: 14, maxWidth: 520,
                    overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                  } as React.CSSProperties}>
                    {episodeDetail.episodeDescription}
                  </p>
                ) : (
                  <div style={{ marginBottom: 14 }} />
                )}

                <div style={{ display: 'flex', gap: 12 }}>
                  <ActionButton
                    focusKey="tvshowdetail-play"
                    primary
                    onPress={handlePlay}
                    scrollToTop={scrollToTop}
                    onUp={() => {}}
                    onArrow={(dir) => {
                      if (dir === 'right') { setFocus('tvshowdetail-back'); return false }
                      if (dir === 'down') {
                        if (episodes.length > 0) { setFocus('tvshowdetail-ep-0-0'); return false }
                        return false
                      }
                      return false
                    }}
                  >
                    ▶ Play
                  </ActionButton>
                  <ActionButton
                    focusKey="tvshowdetail-back"
                    onPress={handleBack}
                    scrollToTop={scrollToTop}
                    onUp={() => {}}
                    onArrow={(dir) => {
                      if (dir === 'left') { setFocus('tvshowdetail-play'); return false }
                      if (dir === 'down') {
                        if (episodes.length > 0) { setFocus('tvshowdetail-ep-0-0'); return false }
                        return false
                      }
                      return false
                    }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M15 5L8 12L15 19" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/></svg> Back
                  </ActionButton>
                </div>
              </div>
            </div>
          </div>

          {episodes.length > 0 && (
            <div style={{ paddingLeft: '5vw', paddingRight: '5vw', paddingBottom: 40 }}>
              <h2 style={{ color: '#fff', fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Episodes</h2>
              {Array.from({ length: rows }).map((_, rowIdx) => {
                const rowItems = episodes.slice(rowIdx * EPISODE_COLS, (rowIdx + 1) * EPISODE_COLS)
                return (
                  <div key={rowIdx} style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                    {rowItems.map((ep, colIdx) => (
                      <EpisodeCard
                        key={ep.episodeId}
                        item={ep}
                        focusKey={`tvshowdetail-ep-${rowIdx}-${colIdx}`}
                        onArrow={episodeArrow(rowIdx, colIdx)}
                        onSelect={() => handleEpisodeSelect(ep)}
                      />
                    ))}
                    {rowItems.length < EPISODE_COLS && Array.from({ length: EPISODE_COLS - rowItems.length }).map((_, i) => (
                      <div key={`spacer-${i}`} style={{ flex: 1, aspectRatio: '16/8' }} />
                    ))}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </FocusContext.Provider>
  )
}
