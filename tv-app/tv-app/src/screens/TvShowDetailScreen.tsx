import { useState, useEffect, useCallback, useRef } from 'react'
import { useFocusable, FocusContext } from '@noriginmedia/norigin-spatial-navigation'
import { fetchTvShowEpisodeList } from '../api/tvShowsApi'
import type { EpisodeDetail, EpisodeItem } from '../api/tvShowsApi'
import { useAppStore } from '../store/appStore'
import { playNative } from '../platform/nativeVideoPlayer'

const EPISODE_COLS = 3

function EpisodeCard({
  item, focusKey, onArrow, onSelect,
}: {
  item: EpisodeItem; focusKey: string; onArrow: (dir: string) => boolean; onSelect: () => void
}) {
  const [imgError, setImgError] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)
  const { ref, focused } = useFocusable({
    focusKey,
    onEnterPress: onSelect,
    onArrowPress: onArrow,
    onFocus: () => cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }),
  })
  const setRef = useCallback((el: HTMLDivElement | null) => {
    (ref as React.MutableRefObject<HTMLDivElement | null>).current = el;
    (cardRef as React.MutableRefObject<HTMLDivElement | null>).current = el
  }, [ref])

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

  const handlePlay = useCallback(async () => {
    if (!episodeDetail) return
    const launched = await playNative(episodeDetail.episodeURL, episodeDetail.episodeName)
    if (!launched) {
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
      })
    }
  }, [episodeDetail, navigate])

  const handleEpisodeSelect = useCallback(async (ep: EpisodeItem) => {
    if (!selectedTvShowId) return
    const data = await fetchTvShowEpisodeList(selectedTvShowId, ep.episodeId)
    const detail = data.episodeDetails
    if (!detail) return
    const launched = await playNative(detail.episodeURL, detail.episodeName)
    if (!launched) {
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
      })
    }
  }, [selectedTvShowId, navigate])

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
        <img
          src={episodeDetail.episodeLogo}
          alt=""
          style={{
            position: 'absolute', inset: '-12px',
            width: 'calc(100% + 24px)', height: 'calc(100% + 24px)',
            objectFit: 'cover', opacity: 0.55,
            filter: 'blur(10px) saturate(1.3) brightness(0.65)',
            zIndex: 0,
          }}
        />
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(5,5,5,0.60)', zIndex: 1 }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(5,5,5,0.15) 0%, rgba(5,5,5,0.50) 50%, rgba(5,5,5,0.88) 100%)', zIndex: 1 }} />

        <div
          ref={scrollRef}
          style={{ position: 'relative', zIndex: 2, height: '100%', overflowY: 'auto', overflowX: 'hidden' }}
          className="scrollbar-hide"
        >
          <div style={{
            display: 'flex', alignItems: 'center',
            height: '44vh', minHeight: 260,
            padding: '0 5vw', gap: 40,
          }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              {episodeDetail.episodeNo && episodeDetail.episodeNo.trim() && (
                <span style={{
                  display: 'inline-block', marginBottom: 10,
                  background: '#e50914', color: '#fff',
                  fontSize: 11, fontWeight: 700, letterSpacing: 1.5,
                  textTransform: 'uppercase', padding: '3px 12px', borderRadius: 4,
                  alignSelf: 'flex-start',
                }}>
                  {episodeDetail.episodeNo.trim()}
                </span>
              )}
              <h1 style={{
                color: '#fff', fontWeight: 800, margin: '0 0 12px', lineHeight: 1.15,
                fontSize: 'clamp(20px, 3vw, 40px)',
                textShadow: '0 2px 20px rgba(0,0,0,0.9)',
              }}>
                {episodeDetail.episodeName}
              </h1>
              {episodeDetail.episodeDescription ? (
                <p style={{
                  color: 'rgba(255,255,255,0.70)', fontSize: 13, lineHeight: 1.65,
                  margin: '0 0 22px', maxWidth: 460,
                }}>
                  {episodeDetail.episodeDescription}
                </p>
              ) : (
                <div style={{ marginBottom: 22 }} />
              )}
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <ActionButton
                  focusKey="tvshowdetail-play"
                  primary
                  onPress={handlePlay}
                  scrollToTop={scrollToTop}
                  onUp={handleUpToNav}
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
                  onUp={handleUpToNav}
                  onArrow={(dir) => {
                    if (dir === 'left') { setFocus('tvshowdetail-play'); return false }
                    if (dir === 'down') {
                      if (episodes.length > 0) { setFocus('tvshowdetail-ep-0-0'); return false }
                      return false
                    }
                    return false
                  }}
                >
                  « Back
                </ActionButton>
              </div>
            </div>

            <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
              <img
                src={episodeDetail.episodeLogo}
                alt={episodeDetail.episodeName}
                style={{
                  width: 'min(300px, 28vw)',
                  aspectRatio: '16/9',
                  borderRadius: 12,
                  objectFit: 'cover',
                  boxShadow: '0 8px 48px rgba(0,0,0,0.95)',
                }}
              />
            </div>
          </div>

          {episodes.length > 0 && (
            <div style={{ paddingLeft: '5vw', paddingRight: '5vw', paddingTop: 24, paddingBottom: 48 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
                <div style={{ width: 4, height: 20, borderRadius: 2, background: '#e50914' }} />
                <h2 style={{ color: '#fff', fontSize: 17, fontWeight: 700, margin: 0 }}>Episodes</h2>
                <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13 }}>{episodes.length}</span>
              </div>
              {Array.from({ length: rows }).map((_, rowIdx) => {
                const rowItems = episodes.slice(rowIdx * EPISODE_COLS, (rowIdx + 1) * EPISODE_COLS)
                return (
                  <div key={rowIdx} style={{ display: 'flex', gap: 16, marginBottom: 16, overflow: 'visible' }}>
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
