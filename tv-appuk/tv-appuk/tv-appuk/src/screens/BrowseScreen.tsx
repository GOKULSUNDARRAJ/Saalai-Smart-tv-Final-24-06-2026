import { useState, useRef, useCallback, useEffect } from 'react'
import { useFocusable, FocusContext } from '@noriginmedia/norigin-spatial-navigation'
import { ContentRow } from '../components/ui/ContentRow'
import { MOCK_ROWS } from '../api/mockData'
import { useAppStore } from '../store/appStore'
import type { ContentItem } from '../types/content'

const CATEGORIES = ['All', 'Trending', 'Action', 'Drama', 'Sci-Fi', 'Romance', 'Thriller']

interface CategoryPillProps {
  label: string
  index: number
  isSelected: boolean
  isFirst: boolean
  isLast: boolean
  onSelect: () => void
  onUp: () => void
  onDown: () => void
}

function CategoryPill({ label, index, isSelected, isFirst, isLast, onSelect, onUp, onDown }: CategoryPillProps) {
  const pillScrollRef = useRef<HTMLButtonElement>(null)

  const { ref, focused, setFocus } = useFocusable({
    focusKey: `browse-cat-${index}`,
    onEnterPress: onSelect,
    onFocus: () => {
      pillScrollRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
    },
    onArrowPress: (dir) => {
      if (dir === 'up') { onUp(); return false }
      if (dir === 'down') { onDown(); return false }
      if (dir === 'left') {
        if (!isFirst) setFocus(`browse-cat-${index - 1}`)
        return false
      }
      if (dir === 'right') {
        if (!isLast) setFocus(`browse-cat-${index + 1}`)
        return false
      }
      return false
    },
  })

  const setRef = useCallback((el: HTMLButtonElement | null) => {
    (ref as React.MutableRefObject<HTMLButtonElement | null>).current = el;
    (pillScrollRef as React.MutableRefObject<HTMLButtonElement | null>).current = el
  }, [ref])

  return (
    <button
      ref={setRef}
      onClick={onSelect}
      className="whitespace-nowrap font-medium flex-shrink-0"
      style={{
        padding: '6px 20px',
        borderRadius: 999,
        fontSize: '1rem',
        backgroundColor: focused
          ? '#e50914'
          : isSelected
            ? 'rgba(229,9,20,0.35)'
            : 'rgba(255,255,255,0.10)',
        color: focused || isSelected ? '#fff' : 'rgba(255,255,255,0.55)',
        outline: 'none',
        transform: focused ? 'scale(1.1)' : 'scale(1)',
        transition: 'transform 0.15s, background-color 0.15s',
        cursor: 'pointer',
        border: 'none',
        marginRight: 12,
      }}
    >
      {label}
    </button>
  )
}

interface CategoryBarProps {
  selected: number
  onSelect: (i: number) => void
  firstCardKey: string
}

function CategoryBar({ selected, onSelect, firstCardKey }: CategoryBarProps) {
  const { ref, focusKey, setFocus } = useFocusable({
    focusKey: 'browse-catbar',
    trackChildren: true,
  })

  return (
    <FocusContext.Provider value={focusKey}>
      <div
        ref={ref}
        className="flex overflow-x-auto scrollbar-hide"
        style={{ paddingLeft: '5vw', paddingRight: '5vw', paddingTop: '8px', paddingBottom: '8px' }}
      >
        {CATEGORIES.map((cat, i) => (
          <CategoryPill
            key={cat}
            label={cat}
            index={i}
            isSelected={selected === i}
            isFirst={i === 0}
            isLast={i === CATEGORIES.length - 1}
            onSelect={() => onSelect(i)}
            onUp={() => setFocus('nav-browse')}
            onDown={() => { if (firstCardKey) setFocus(firstCardKey) }}
          />
        ))}
      </div>
    </FocusContext.Provider>
  )
}

export function BrowseScreen() {
  const { navigate } = useAppStore()
  const [selectedCat, setSelectedCat] = useState(0)
  const { ref, focusKey, setFocus } = useFocusable({ focusKey: 'browse-screen', trackChildren: true })

  useEffect(() => {
    const t = setTimeout(() => setFocus('browse-cat-0'), 80)
    return () => clearTimeout(t)
  }, [setFocus])

  const handleSelect = (item: ContentItem) => {
    navigate('detail', item)
  }

  const firstCardKey = MOCK_ROWS.length > 0 ? `card-browse-row-${MOCK_ROWS[0].id}-0` : ''

  return (
    <FocusContext.Provider value={focusKey}>
      <div
        ref={ref}
        className="h-full overflow-y-auto overflow-x-hidden scrollbar-hide"
      >
        <div
          className="relative w-full"
          style={{
            background: 'transparent',
            paddingLeft: '5vw',
            paddingRight: '5vw',
            paddingTop: 'clamp(14px, 2.5vh, 28px)',
            paddingBottom: 'clamp(8px, 1.5vh, 12px)',
          }}
        >
          <h1 className="text-tv-3xl font-bold text-white leading-tight">Browse</h1>
          <p className="text-white/50 text-tv-sm mt-1 mb-4">
            {MOCK_ROWS.reduce((n, r) => n + r.items.length, 0)} titles across {MOCK_ROWS.length} categories
          </p>
        </div>

        <CategoryBar selected={selectedCat} onSelect={setSelectedCat} firstCardKey={firstCardKey} />

        <div className="pt-4 pb-16">
          {MOCK_ROWS.map((row, idx) => (
            <ContentRow
              key={row.id}
              row={row}
              onSelect={handleSelect}
              focusKey={`browse-row-${row.id}`}
              onUp={() => idx === 0 ? setFocus('browse-catbar') : setFocus(`card-browse-row-${MOCK_ROWS[idx - 1].id}-0`)}
              onDown={idx < MOCK_ROWS.length - 1 ? () => setFocus(`card-browse-row-${MOCK_ROWS[idx + 1].id}-0`) : undefined}
            />
          ))}
        </div>
      </div>
    </FocusContext.Provider>
  )
}
