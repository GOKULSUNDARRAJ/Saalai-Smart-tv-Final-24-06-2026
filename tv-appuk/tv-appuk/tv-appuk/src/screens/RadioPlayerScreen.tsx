import { useState, useEffect, useCallback, useRef } from 'react'
import { useFocusable, FocusContext } from '@noriginmedia/norigin-spatial-navigation'
import { fetchRadioDetail } from '../api/radioApi'
import type { RadioStation } from '../api/radioApi'
import { useAppStore } from '../store/appStore'

const BAR_COUNT = 36
const CX = 50
const CY = 50
const INNER_R = 38
const BAR_H = 9
const BAR_W = 3

function CircularVisualizer({ logo, name, playing, style }: { logo: string; name: string; playing: boolean; style?: React.CSSProperties }) {
  return (
    <div style={{ position: 'relative', width: 140, height: 140, flexShrink: 0, ...style }}>
      <style>{`
        @keyframes cv-bar {
          0%   { transform: scaleY(0.15); }
          50%  { transform: scaleY(1); }
          100% { transform: scaleY(0.15); }
        }
      `}</style>
      <svg viewBox="0 0 100 100" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%' }}>
        {Array.from({ length: BAR_COUNT }).map((_, i) => {
          const angle = (i / BAR_COUNT) * 360
          const duration = 0.4 + (i % 7) * 0.08
          const delay = (i / BAR_COUNT) * 0.6
          return (
            <g key={i} transform={`rotate(${angle}, ${CX}, ${CY})`}>
              <rect
                x={CX - BAR_W / 2}
                y={CY - INNER_R - BAR_H}
                width={BAR_W}
                height={BAR_H}
                rx={BAR_W / 2}
                fill={playing ? '#e50914' : 'rgba(255,255,255,0.2)'}
                style={{
                  transformBox: 'fill-box' as React.CSSProperties['transformBox'],
                  transformOrigin: '50% 100%',
                  animation: playing ? `cv-bar ${duration}s ${delay}s ease-in-out infinite` : 'none',
                  transition: 'fill 0.3s',
                }}
              />
            </g>
          )
        })}
      </svg>
      <div style={{
        position: 'absolute', top: '14%', left: '14%', right: '14%', bottom: '14%',
        borderRadius: '50%', overflow: 'hidden',
        border: '3px solid rgba(229,9,20,0.6)',
        boxShadow: '0 0 40px rgba(229,9,20,0.35)',
        background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center'
      }}>
        <img src={logo} alt={name} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
      </div>
    </div>
  )
}

function PlayPauseButton({ playing, onToggle }: {
  playing: boolean; onToggle: () => void
}) {
  const onToggleRef = useRef(onToggle)
  onToggleRef.current = onToggle
  const sfRef = useRef<(key: string) => void>(() => {})

  const { ref, focused, setFocus } = useFocusable({
    focusKey: 'radioplayer-playpause',
    onEnterPress: () => onToggleRef.current(),
    onArrowPress: (dir) => {
      if (dir === 'up') { sfRef.current('nav-radio'); return false }
      if (dir === 'down') { sfRef.current('radioplayer-station-0'); return false }
      return false
    },
  })

  sfRef.current = setFocus

  return (
    <div
      ref={ref}
      onClick={() => onToggleRef.current()}
      style={{
        width: 64, height: 64, borderRadius: '50%', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: focused ? '#e50914' : 'rgba(229,9,20,0.25)',
        border: focused ? '3px solid #fff' : '3px solid rgba(229,9,20,0.5)',
        transition: 'background 0.15s, border-color 0.15s',
        boxShadow: focused ? '0 0 24px rgba(229,9,20,0.7)' : '0 0 10px rgba(229,9,20,0.2)',
        marginTop: 16, flexShrink: 0,
        outline: (window as any).isLegacyTv ? 'none' : (focused ? '2px solid rgba(255,255,255,0.4)' : 'none'),
        outlineOffset: 3,
      }}
    >
      <span style={{ color: '#fff', fontSize: 26, lineHeight: 1, userSelect: 'none', marginLeft: playing ? 0 : 4 }}>
        {playing ? '⏸' : '▶'}
      </span>
    </div>
  )
}

function Equalizer({ playing }: { playing: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 24 }}>
      {[0.6, 1, 0.75, 0.9, 0.5].map((h, i) => (
        <div
          key={i}
          style={{
            width: 4, borderRadius: 2, background: '#e50914',
            height: playing ? `${h * 100}%` : '20%',
            animation: playing ? `eq-bar ${0.6 + i * 0.15}s ease-in-out infinite alternate` : 'none',
            transition: 'height 0.3s',
          }}
        />
      ))}
      <style>{`
        @keyframes eq-bar {
          from { transform: scaleY(0.3); }
          to   { transform: scaleY(1); }
        }
      `}</style>
    </div>
  )
}

const GRID_COLS = 4

function StationItem({
  item, focusKey, idx, totalCount, onSelect, isActive, playing, buffering, onToggle,
}: {
  item: RadioStation; focusKey: string; idx: number; totalCount: number
  onSelect: () => void; isActive: boolean; playing?: boolean; buffering?: boolean; onToggle?: () => void
}) {
  const [imgError, setImgError] = useState(false)
  const itemRef = useRef<HTMLDivElement>(null)
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect
  const sfRef = useRef<(key: string) => void>(() => {})

  const { ref, focused, setFocus } = useFocusable({
    focusKey,
    onEnterPress: () => {
      if (isActive && onToggle) { onToggle(); return }
      onSelectRef.current()
    },
    onArrowPress: (dir) => {
      const col = idx % GRID_COLS
      if (dir === 'up') {
        if (idx < GRID_COLS) { sfRef.current('nav-radio'); return false }
        sfRef.current(`radioplayer-station-${idx - GRID_COLS}`); return false
      }
      if (dir === 'down') {
        if (idx + GRID_COLS < totalCount) { sfRef.current(`radioplayer-station-${idx + GRID_COLS}`); return false }
        return false
      }
      if (dir === 'left') {
        if (col === 0) return false
        sfRef.current(`radioplayer-station-${idx - 1}`); return false
      }
      if (dir === 'right') {
        if (col === GRID_COLS - 1 || idx + 1 >= totalCount) return false
        sfRef.current(`radioplayer-station-${idx + 1}`); return false
      }
      return false
    },
    onFocus: () => itemRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }),
  })

  sfRef.current = setFocus

  const setRef = useCallback((el: HTMLDivElement | null) => {
    (ref as React.MutableRefObject<HTMLDivElement | null>).current = el;
    (itemRef as React.MutableRefObject<HTMLDivElement | null>).current = el
  }, [ref])

  return (
    <div
      ref={setRef}
      onClick={() => {
        if (isActive && onToggle) { onToggle(); return }
        onSelectRef.current()
      }}
      style={{
        display: 'flex', alignItems: 'center',
        padding: '10px 12px', borderRadius: 10, cursor: 'pointer',
        background: focused ? 'rgba(229,9,20,0.2)' : isActive ? 'rgba(229,9,20,0.1)' : 'rgba(255,255,255,0.04)',
        border: focused ? '2px solid #e50914' : isActive ? '2px solid rgba(229,9,20,0.5)' : '2px solid transparent',
        transition: 'background 0.15s, border-color 0.15s',
        flexShrink: 0, minWidth: 0,
      }}
    >
      <div style={{ marginRight: 10, width: 44, height: 44, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {!imgError ? (
          <img src={item.channelLogo} alt={item.channelName} onError={() => setImgError(true)}
            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: '#fff', fontSize: 9, fontWeight: 700, textAlign: 'center' }}>{item.channelName.slice(0, 2)}</span>
          </div>
        )}
      </div>
      <span style={{
        color: focused || isActive ? '#fff' : 'rgba(255,255,255,0.7)',
        fontSize: 13, fontWeight: isActive ? 700 : 500,
        flex: 1, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
      }}>
        {item.channelName}
      </span>
      {isActive && (
        buffering ? (
          <>
            <style>{`@keyframes si-spin { to { transform: rotate(360deg); } }`}</style>
            <div style={{
              width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
              border: '2.5px solid rgba(229,9,20,0.25)',
              borderTopColor: '#e50914',
              animation: 'si-spin 0.7s linear infinite',
            }} />
          </>
        ) : playing ? <Equalizer playing={true} /> : (
          <span style={{ color: '#fff', fontSize: 18, lineHeight: 1 }}>▶</span>
        )
      )}
    </div>
  )
}

export function RadioPlayerScreen() {
  const [detail, setDetail] = useState<{ channelDetails: RadioStation; radioList: RadioStation[] } | null>(null)
  const [current, setCurrent] = useState<RadioStation | null>(null)
  const [loading, setLoading] = useState(true)
  const [playing, setPlaying] = useState(false)
  const [buffering, setBuffering] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const pageRef = useRef(1)
  const scrollRef = useRef<HTMLDivElement>(null)
  const playingRef = useRef(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const { selectedRadioChannelId } = useAppStore()
  const { ref, focusKey, setFocus } = useFocusable({ focusKey: 'radioplayer-screen', trackChildren: true })

  useEffect(() => {
    if (!selectedRadioChannelId) return
    setLoading(true)
    fetchRadioDetail(selectedRadioChannelId).then((data) => {
      setDetail(data)
      if (data) {
        setCurrent(data.channelDetails)
        const activeIdx = data.radioList.findIndex(s => s.channelId === data.channelDetails.channelId)
        const focusIdx = activeIdx >= 0 ? activeIdx : 0
        setLoading(false)
        setTimeout(() => setFocus(`radioplayer-station-${focusIdx}`), 150)
      } else {
        setLoading(false)
      }
    })
  }, [selectedRadioChannelId, setFocus])

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || !detail) return
    setLoadingMore(true)
    const offset = pageRef.current * 20
    const { fetchRadioList } = await import('../api/radioApi')
    const result = await fetchRadioList(offset, 20)
    
    setDetail(prev => {
      if (!prev) return prev
      const existingIds = new Set(prev.radioList.map(r => r.channelId))
      const newItems = result.items.filter(r => !existingIds.has(r.channelId))
      return {
        ...prev,
        radioList: [...prev.radioList, ...newItems]
      }
    })
    
    setLoadingMore(false)
    pageRef.current += 1
    if (result.items.length === 0) setHasMore(false)
  }, [loadingMore, hasMore, detail])

  const handleScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el || loadingMore || !hasMore) return
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 300) {
      loadMore()
    }
  }, [loadingMore, hasMore, loadMore])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.addEventListener('scroll', handleScroll)
    return () => el.removeEventListener('scroll', handleScroll)
  }, [handleScroll])

  useEffect(() => {
    if (!current) return
    const audio = audioRef.current ?? new Audio()
    audioRef.current = audio
    audio.src = current.channelURL
    audio.load()
    setPlaying(false)
    setBuffering(true)
    playingRef.current = false

    const onWaiting = () => setBuffering(true)
    const onPlaying = () => { setBuffering(false); setPlaying(true); playingRef.current = true }
    const onPause = () => { setBuffering(false); setPlaying(false); playingRef.current = false }
    const onError = () => { setBuffering(false); setPlaying(false); playingRef.current = false }

    audio.addEventListener('waiting', onWaiting)
    audio.addEventListener('playing', onPlaying)
    audio.addEventListener('pause', onPause)
    audio.addEventListener('error', onError)

    audio.play().catch(() => {
      setBuffering(false)
      setPlaying(false)
      playingRef.current = false
    })

    return () => {
      audio.removeEventListener('waiting', onWaiting)
      audio.removeEventListener('playing', onPlaying)
      audio.removeEventListener('pause', onPause)
      audio.removeEventListener('error', onError)
      audio.pause()
    }
  }, [current])

  useEffect(() => {
    return () => {
      audioRef.current?.pause()
      audioRef.current = null
    }
  }, [])

  const togglePlay = useCallback(() => {
    if (!audioRef.current) return
    if (playingRef.current) {
      audioRef.current.pause()
      playingRef.current = false
      setPlaying(false)
      setBuffering(false)
    } else {
      setBuffering(true)
      audioRef.current.play().then(() => {
        playingRef.current = true
        setPlaying(true)
        setBuffering(false)
      }).catch(() => { setBuffering(false) })
    }
  }, [])

  const switchStation = useCallback((station: RadioStation) => {
    setCurrent(station)
  }, [])

  const stationList = detail?.radioList ?? []

  if (loading) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.4)', fontSize: 16 }}>
        Loading…
      </div>
    )
  }

  if (!detail || !current) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>
        Station not found
      </div>
    )
  }

  return (
    <FocusContext.Provider value={focusKey}>
      <div ref={ref} style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>

        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0,
          background: 'rgba(0,0,0,0.45)',
        }} />

        {/* Player section — top */}
        <div style={{
          position: 'relative', zIndex: 1,
          flexShrink: 0,
          display: 'flex', flexDirection: 'row', alignItems: 'center',
          paddingTop: 'clamp(72px,9.5vh,96px)',
          paddingBottom: 'clamp(12px,1.8vh,20px)',
          paddingLeft: 'clamp(16px,4vw,48px)',
          paddingRight: 'clamp(16px,4vw,48px)',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
        }}>
          <CircularVisualizer 
            logo={current.channelLogo} 
            name={current.channelName} 
            playing={playing} 
            style={{ marginRight: 'clamp(16px,2.5vw,32px)' }}
          />

          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
            <div style={{
              display: 'inline-flex', alignSelf: 'flex-start',
              background: playing ? '#e50914' : 'rgba(255,255,255,0.15)', color: '#fff',
              fontSize: 10, fontWeight: 700, letterSpacing: 2,
              padding: '3px 10px', borderRadius: 999,
              transition: 'background 0.3s',
              marginBottom: 6
            }}>
              {playing ? 'NOW PLAYING' : 'PAUSED'}
            </div>

            <h2 style={{
              color: '#fff', fontWeight: 800,
              fontSize: 'clamp(18px, 2.4vw, 32px)',
              margin: 0, lineHeight: 1.2,
              overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
              marginBottom: 6
            }}>
              {current.channelName}
            </h2>

            <Equalizer playing={playing} />
          </div>


        </div>

        {/* Station list — below player */}
        <div style={{
          position: 'relative', zIndex: 1,
          flex: 1, display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}>
          <div style={{ padding: 'clamp(10px,1.5vh,16px) clamp(16px,4vw,48px) clamp(6px,1vh,10px)', flexShrink: 0 }}>
            <h3 style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, fontWeight: 700, letterSpacing: 2, margin: 0 }}>
              OTHER STATIONS
            </h3>
          </div>

          <div
            ref={scrollRef}
            onScroll={handleScroll}
            style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '0 clamp(16px,4vw,48px) 24px' }}
            className="scrollbar-hide"
          >
            {Array.from({ length: Math.ceil(stationList.length / GRID_COLS) }).map((_, rowIdx) => {
              const rowItems = stationList.slice(rowIdx * GRID_COLS, (rowIdx + 1) * GRID_COLS)
              return (
                <div key={rowIdx} style={{ display: 'flex', marginBottom: 8 }}>
                  {rowItems.map((station, colIdx) => {
                    const idx = rowIdx * GRID_COLS + colIdx
                    return (
                      <div key={station.channelId} style={{ flex: 1, marginRight: colIdx < GRID_COLS - 1 ? 8 : 0 }}>
                        <StationItem
                          item={station}
                          focusKey={`radioplayer-station-${idx}`}
                          idx={idx}
                          totalCount={stationList.length}
                          onSelect={() => switchStation(station)}
                          isActive={current.channelId === station.channelId}
                          playing={current.channelId === station.channelId ? playing : undefined}
                          buffering={current.channelId === station.channelId ? buffering : undefined}
                          onToggle={current.channelId === station.channelId ? togglePlay : undefined}
                        />
                      </div>
                    )
                  })}
                  {rowItems.length < GRID_COLS && Array.from({ length: GRID_COLS - rowItems.length }).map((_, i) => {
                    const colIdx = rowItems.length + i
                    return (
                      <div key={`spacer-${i}`} style={{ flex: 1, marginRight: colIdx < GRID_COLS - 1 ? 8 : 0 }} />
                    )
                  })}
                </div>
              )
            })}
            {loadingMore && (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '16px 0', color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>
                Loading more…
              </div>
            )}
            {!hasMore && stationList.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 40, color: 'rgba(255,255,255,0.2)', fontSize: 12 }}>
                — end —
              </div>
            )}
          </div>
        </div>
      </div>
    </FocusContext.Provider>
  )
}
