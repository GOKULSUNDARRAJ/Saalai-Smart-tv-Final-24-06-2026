import { useFocusable, FocusContext } from '@noriginmedia/norigin-spatial-navigation'
import { FocusableCard } from '../focusable/FocusableCard'
import type { ContentItem } from '../../types/content'

interface ContentGridProps {
  items: ContentItem[]
  title?: string
  onSelect?: (item: ContentItem) => void
  focusKey: string
}

export function ContentGrid({ items, title, onSelect, focusKey }: ContentGridProps) {
  const { ref, focusKey: currentFocusKey } = useFocusable({
    focusKey,
    trackChildren: true,
  })

  return (
    <FocusContext.Provider value={currentFocusKey}>
      <div ref={ref} className="px-safe py-8">
        {title && (
          <h2 className="text-tv-base font-semibold text-white mb-6">{title}</h2>
        )}
        <div
          className="grid gap-4"
          style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}
        >
          {items.map((item, index) => {
            const cardKey = `grid-${focusKey}-${index}`
            return (
              <FocusableCard
                key={item.id}
                item={item}
                onSelect={onSelect}
                focusKey={cardKey}
                prevFocusKey={index > 0 ? `grid-${focusKey}-${index - 1}` : null}
                nextFocusKey={index < items.length - 1 ? `grid-${focusKey}-${index + 1}` : null}
                width={280}
                height={157}
              />
            )
          })}
        </div>
      </div>
    </FocusContext.Provider>
  )
}
