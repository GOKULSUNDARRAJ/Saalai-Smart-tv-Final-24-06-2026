import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useFocusable, FocusContext } from '@noriginmedia/norigin-spatial-navigation'
import { fetchCatchupChannelDetails } from '../api/catchupApi'
import type { CatchupChannelDetail, CatchupEpisode } from '../api/catchupApi'
import { useAppStore } from '../store/appStore'
import { playNative, shouldUseNativePlayer } from '../platform/nativeVideoPlayer'
import type { PlaylistItem } from '../types/content'
import { tvStorage } from '../platform/storage'

const EP_COLS = 4

function DayPill({
  label, subLabel, focusKey, onArrow, onSelect, focused: _focused,
}: {
  label: string; subLabel: string; focusKey: string
  onArrow: (dir: string) => boolean; onSelect: () => void; focused?: boolean
}) {
  const { ref, focused } = useFocusable({ focusKey, onEnterPress: onSelect, onArrowPress: onArrow })
  return (
    <div
      ref={ref}
      onClick={onSelect}
      style={{
        padding: '10px 14px',
        borderRadius: 10,
        background: focused ? '#e50914' : 'rgba(255,255,255,0.07)',
        border: focused ? '2px solid #e50914' : '2px solid transparent',
        cursor: 'pointer',
        transition: 'background 0.15s, border-color 0.15s',
        marginBottom: 8,
        flexShrink: 0,
      }}
    >
      <p style={{ color: '#fff', fontWeight: 700, fontSize: 13, margin: 0 }}>{label}</p>
      <p style={{ color: focused ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.45)', fontSize: 10, margin: '2px 0 0' }}>{subLabel}</p>
    </div>
  )
}

function EpisodeCard({
  item, focusKey, onArrow, onSelect, progressVersion, style,
}: {
  item: CatchupEpisode; focusKey: string; onArrow: (dir: string) => boolean; onSelect: () => void; progressVersion: number; style?: React.CSSProperties
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

  // Retrieve resume progress
  const [progress, setProgress] = useState(0)
  useEffect(() => {
    const key = `resume_pos_${item.showURL}`
    const stored = tvStorage.getItem(key)
    const storedDur = tvStorage.getItem(`resume_dur_${item.showURL}`)
    if (stored) {
      const pos = parseInt(stored) || 0
      const dur = parseInt(storedDur ?? '0') || (1800 * 1000) // fallback 30m
      if (pos > 0 && dur > 0) {
        setProgress(Math.min(pos / dur, 1))
      } else {
        setProgress(0)
      }
    } else {
      setProgress(0)
    }
  }, [item.showURL, progressVersion])

  return (
    <div
      ref={setRef}
      onClick={onSelect}
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        transform: focused ? 'scale(1.06)' : 'scale(1)',
        transition: 'transform 0.15s',
        zIndex: focused ? 10 : 1,
        cursor: 'pointer',
      }}
    >
      <div style={{
        width: '100%', aspectRatio: '16/9', borderRadius: 10, overflow: 'hidden', background: '#1a1a1a', position: 'relative',
        outline: focused ? '3px solid #e50914' : '3px solid transparent',
        outlineOffset: 3,
        transition: 'outline-color 0.12s'
      }}>
        {!imgError ? (
          <img
            src={item.showLogo}
            alt={item.showName}
            onError={() => setImgError(true)}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : (
          <div style={{
            width: '100%', height: '100%',
            background: 'linear-gradient(135deg, #1a1a2e, #16213e)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 8,
          }}>
            <span style={{ color: '#fff', fontSize: 10, fontWeight: 600, textAlign: 'center', lineHeight: 1.4 }}>
              {item.showName}
            </span>
          </div>
        )}
        {progress > 0 && (
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 4, background: 'rgba(255,255,255,0.2)' }}>
            <div style={{ width: `${progress * 100}%`, height: '100%', background: '#3b82f6' }} />
          </div>
        )}
      </div>
      <div style={{ marginTop: 8, paddingLeft: 4, paddingRight: 4 }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {item.showName}
        </div>
      </div>
    </div>
  )
}

export function CatchupDetailScreen() {
  const [detail, setDetail] = useState<CatchupChannelDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedDayIdx, setSelectedDayIdx] = useState(0)
  const [progressVersion, setProgressVersion] = useState(0)
  const episodeScrollRef = useRef<HTMLDivElement>(null)

  const { currentScreen, selectedCatchupChannelId, navigate, goBack } = useAppStore()
  const { ref, focusKey, setFocus } = useFocusable({ focusKey: 'catchupdetail-screen', trackChildren: true })
  const { ref: backRef, focused: backFocused } = useFocusable({
    focusKey: 'catchupdetail-back',
    onEnterPress: () => goBack(),
    onArrowPress: (dir) => {
      if (dir === 'down') { setFocus('catchupdetail-day-0'); return false }
      return false
    },
  })

  useEffect(() => {
    if (!selectedCatchupChannelId) return
    setLoading(true)
    fetchCatchupChannelDetails(selectedCatchupChannelId).then((data) => {
      setDetail(data)
      setLoading(false)
      setTimeout(() => setFocus('catchupdetail-back'), 100)
    })
  }, [selectedCatchupChannelId, setFocus])

  useEffect(() => {
    if (episodeScrollRef.current) {
      episodeScrollRef.current.scrollTop = 0
    }
  }, [selectedDayIdx])

  useEffect(() => {
    if (currentScreen === 'catchupdetail') {
      setProgressVersion(v => v + 1)
    }
  }, [currentScreen])

  const episodes = detail?.showList[selectedDayIdx]?.episodeList ?? []
  const epRows = Math.ceil(episodes.length / EP_COLS)

  const dayArrow = useCallback((idx: number) => (dir: string): boolean => {
    if (dir === 'up') {
      if (idx === 0) { setFocus('catchupdetail-back'); return false }
      setFocus(`catchupdetail-day-${idx - 1}`); return false
    }
    if (dir === 'down') {
      const days = detail?.showList ?? []
      if (idx + 1 < days.length) { setFocus(`catchupdetail-day-${idx + 1}`); return false }
      return false
    }
    if (dir === 'right') {
      setFocus('catchupdetail-ep-0-0'); return false
    }
    if (dir === 'left') {
      return false
    }
    return true
  }, [detail, setFocus])

  const epArrow = useCallback((row: number, col: number) => (dir: string): boolean => {
    if (dir === 'up') {
      if (row === 0) { setFocus('catchupdetail-back'); return false }
      setFocus(`catchupdetail-ep-${row - 1}-${col}`); return false
    }
    if (dir === 'down') {
      if (row + 1 < epRows) {
        const nextRowLen = episodes.slice((row + 1) * EP_COLS, (row + 2) * EP_COLS).length
        setFocus(`catchupdetail-ep-${row + 1}-${Math.min(col, nextRowLen - 1)}`); return false
      }
      return false
    }
    if (dir === 'left') {
      if (col === 0) { setFocus(`catchupdetail-day-${selectedDayIdx}`); return false }
      setFocus(`catchupdetail-ep-${row}-${col - 1}`); return false
    }
    if (dir === 'right') {
      const rowLen = episodes.slice(row * EP_COLS, (row + 1) * EP_COLS).length
      if (col < rowLen - 1) { setFocus(`catchupdetail-ep-${row}-${col + 1}`); return false }
      return false
    }
    return true
  }, [epRows, episodes, selectedDayIdx, setFocus])

  const handleEpisodeSelect = useCallback(async (ep: CatchupEpisode) => {
    if (!ep.showURL) return
    const playableEps = episodes.filter(e => !!e.showURL)
    const epIdx = playableEps.findIndex(e => e.showURL === ep.showURL && e.showName === ep.showName)
    let playlist: PlaylistItem[] | undefined
    let playlistIndex: number | undefined
    if (playableEps.length > 1 && epIdx >= 0) {
      playlist = playableEps.map(e => ({ url: e.showURL!, title: e.showName, movieId: 0, thumbnailUrl: e.showLogo }))
      playlistIndex = epIdx
    }
    const storedPos = tvStorage.getItem(`resume_pos_${ep.showURL}`)
    const startPosMs = storedPos ? (parseInt(storedPos) || 0) : 0
    const launched = await playNative(ep.showURL, ep.showName, startPosMs, false, playlist, playlistIndex, undefined, false)
    setProgressVersion(v => v + 1)
    if (!launched && !shouldUseNativePlayer()) navigate('player', {
      id: ep.showName,
      title: ep.showName,
      description: '',
      thumbnailUrl: ep.showLogo,
      backdropUrl: ep.showLogo,
      streamUrl: ep.showURL,
      duration: 0,
      genre: [],
      year: new Date().getFullYear(),
      rating: '',
      type: 'episode',
      playlist,
      playlistIndex,
      startPositionMs: startPosMs,
    })
  }, [navigate, episodes])

  if (loading) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.4)', fontSize: 16 }}>
        Loading…
      </div>
    )
  }

  if (!detail) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>
        Channel not found
      </div>
    )
  }

  return (
    <FocusContext.Provider value={focusKey}>
      <div ref={ref} style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        <div style={{
          display: 'flex', alignItems: 'center', gap: 16,
          paddingLeft: '4vw', paddingRight: '4vw',
          paddingTop: 'clamp(10px, 1.8vh, 20px)', paddingBottom: 'clamp(8px, 1.2vh, 14px)',
          background: 'transparent',
          flexShrink: 0,
        }}>
          <img
            src={detail.channelLogo}
            alt={detail.channelName}
            style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: '50%', background: '#1a1a2e', flexShrink: 0 }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ color: '#fff', fontWeight: 700, fontSize: 'clamp(14px, 2vw, 22px)', margin: 0, lineHeight: 1.2 }}>{detail.channelName}</h1>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 'clamp(9px, 1.1vw, 12px)', margin: '4px 0 0', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
              {detail.channelDescription}
            </p>
          </div>
        </div>

        <div style={{ flex: 1, display: 'flex', overflow: 'hidden', gap: 0 }}>

          <div style={{
            width: 160, flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            overflowY: 'auto', overflowX: 'hidden',
            paddingLeft: '2vw', paddingRight: 8,
            paddingTop: 8, paddingBottom: 16,
            borderRight: '1px solid rgba(255,255,255,0.07)',
          }}
            className="scrollbar-hide"
          >
            <button
              ref={backRef}
              onClick={() => goBack()}
              style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                background: backFocused ? '#e50914' : 'rgba(255,255,255,0.07)',
                border: backFocused ? '2px solid #e50914' : '2px solid transparent',
                color: '#fff', borderRadius: 10, padding: '10px 14px', fontSize: 13, fontWeight: 700,
                cursor: 'pointer', outline: 'none', flexShrink: 0,
                transform: backFocused ? 'scale(1.04)' : 'scale(1)',
                transition: 'all 0.12s',
                marginBottom: 16,
                width: '100%',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}><path d="M15 5L8 12L15 19" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/></svg> Back
            </button>
            {detail.showList.map((day, idx) => (
              <DayPill
                key={day.Date}
                label={day.Day}
                subLabel={day.Date}
                focusKey={`catchupdetail-day-${idx}`}
                onArrow={dayArrow(idx)}
                onSelect={() => { setSelectedDayIdx(idx); setFocus('catchupdetail-ep-0-0') }}
                focused={idx === selectedDayIdx}
              />
            ))}
          </div>

          <div
            ref={episodeScrollRef}
            style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '8px 4vw 24px 16px' }}
            className="scrollbar-hide"
          >
            {detail.showList[selectedDayIdx] && (
              <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10, fontWeight: 600, marginBottom: 10, marginTop: 2, textTransform: 'uppercase', letterSpacing: 1 }}>
                {detail.showList[selectedDayIdx].Day} — {detail.showList[selectedDayIdx].Date} · {episodes.length} episodes
              </p>
            )}
            {Array.from({ length: epRows }).map((_, rowIdx) => {
              const rowItems = episodes.slice(rowIdx * EP_COLS, (rowIdx + 1) * EP_COLS)
              return (
                <div key={rowIdx} style={{ display: 'flex', gap: 12, marginBottom: 12, overflow: 'visible' }}>
                  {rowItems.map((ep, colIdx) => (
                    <EpisodeCard
                      key={`${ep.showName}-${colIdx}`}
                      item={ep}
                      focusKey={`catchupdetail-ep-${rowIdx}-${colIdx}`}
                      onArrow={epArrow(rowIdx, colIdx)}
                      onSelect={() => handleEpisodeSelect(ep)}
                      progressVersion={progressVersion}
                    />
                  ))}
                  {rowItems.length < EP_COLS && Array.from({ length: EP_COLS - rowItems.length }).map((_, i) => (
                    <div key={`sp-${i}`} style={{ flex: 1, aspectRatio: '16/9' }} />
                  ))}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </FocusContext.Provider>
  )
}




