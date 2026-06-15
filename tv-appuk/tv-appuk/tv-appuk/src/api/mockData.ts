import type { ContentItem, ContentRow } from '../types/content'

const PLACEHOLDER_THUMB = 'https://picsum.photos/seed/{id}/320/180'
const PLACEHOLDER_BACKDROP = 'https://picsum.photos/seed/{id}b/1920/1080'

const DEMO_STREAM = 'http://57.128.140.116/star-vod-3/tt.mp4/playlist.m3u8'

function makeSeriesItem(id: string, title: string, genre: string[]): ContentItem {
  return {
    id,
    title,
    description: `A gripping ${genre[0].toLowerCase()} series with multiple seasons of compelling drama.`,
    thumbnailUrl: PLACEHOLDER_THUMB.replace('{id}', id),
    backdropUrl: PLACEHOLDER_BACKDROP.replace('{id}', id),
    streamUrl: DEMO_STREAM,
    duration: 45,
    genre,
    year: 2020 + Math.floor(Math.random() * 5),
    rating: ['TV-14', 'TV-MA', 'TV-PG'][Math.floor(Math.random() * 3)],
    type: 'series',
  }
}

function makeRadioItem(id: string, title: string, genre: string[]): ContentItem {
  return {
    id,
    title,
    description: `Live ${genre[0].toLowerCase()} radio stream broadcasting 24/7.`,
    thumbnailUrl: PLACEHOLDER_THUMB.replace('{id}', id),
    backdropUrl: PLACEHOLDER_BACKDROP.replace('{id}', id),
    streamUrl: DEMO_STREAM,
    duration: 0,
    genre,
    year: 2024,
    rating: 'G',
    type: 'episode',
  }
}

function makeItem(id: string, title: string, genre: string[]): ContentItem {
  return {
    id,
    title,
    description: `An engaging ${genre[0].toLowerCase()} title with stunning visuals and compelling storytelling.`,
    thumbnailUrl: PLACEHOLDER_THUMB.replace('{id}', id),
    backdropUrl: PLACEHOLDER_BACKDROP.replace('{id}', id),
    streamUrl: DEMO_STREAM,
    duration: 90 + Math.floor(Math.random() * 90),
    genre,
    year: 2020 + Math.floor(Math.random() * 5),
    rating: ['G', 'PG', 'PG-13', 'R'][Math.floor(Math.random() * 4)],
    type: 'movie',
  }
}

export const MOCK_ROWS: ContentRow[] = [
  {
    id: 'trending',
    title: 'Trending Now',
    items: [
      makeItem('t1', 'Cosmic Horizon', ['Sci-Fi', 'Adventure']),
      makeItem('t2', 'Silent Depths', ['Thriller', 'Mystery']),
      makeItem('t3', 'Ember Rising', ['Action', 'Drama']),
      makeItem('t4', 'The Lost Signal', ['Sci-Fi', 'Thriller']),
      makeItem('t5', 'Midnight Protocol', ['Action']),
      makeItem('t6', "Ocean's Call", ['Drama', 'Romance']),
      makeItem('t7', 'Parallel Lives', ['Drama']),
      makeItem('t8', 'Last Frontier', ['Western', 'Action']),
    ],
  },
  {
    id: 'action',
    title: 'Action & Adventure',
    items: [
      makeItem('a1', 'Strike Force', ['Action']),
      makeItem('a2', 'Dark Pursuit', ['Action', 'Thriller']),
      makeItem('a3', 'Edge of War', ['Action', 'Drama']),
      makeItem('a4', 'Velocity', ['Action', 'Sci-Fi']),
      makeItem('a5', 'Iron Resolve', ['Action']),
      makeItem('a6', 'Renegade', ['Action', 'Adventure']),
    ],
  },
  {
    id: 'drama',
    title: 'Drama',
    items: [
      makeItem('d1', 'Broken Bridges', ['Drama']),
      makeItem('d2', 'Whisper of Rain', ['Drama', 'Romance']),
      makeItem('d3', 'The Verdict', ['Drama', 'Crime']),
      makeItem('d4', 'Family Ties', ['Drama']),
      makeItem('d5', 'Crossroads', ['Drama', 'Thriller']),
      makeItem('d6', 'Echoes', ['Drama', 'Mystery']),
    ],
  },
  {
    id: 'scifi',
    title: 'Science Fiction',
    items: [
      makeItem('s1', 'New Worlds', ['Sci-Fi', 'Adventure']),
      makeItem('s2', 'The Algorithm', ['Sci-Fi', 'Thriller']),
      makeItem('s3', 'Quantum Break', ['Sci-Fi', 'Action']),
      makeItem('s4', 'Void Walker', ['Sci-Fi']),
      makeItem('s5', 'Digital Ghost', ['Sci-Fi', 'Drama']),
      makeItem('s6', 'Singularity', ['Sci-Fi', 'Thriller']),
    ],
  },
]

export const TV_SHOW_ROWS: ContentRow[] = [
  {
    id: 'tvshows-popular',
    title: 'Popular Series',
    items: [
      makeSeriesItem('tv1', 'The Last Stand',    ['Drama', 'Thriller']),
      makeSeriesItem('tv2', 'Dark Waters',        ['Mystery', 'Drama']),
      makeSeriesItem('tv3', 'City of Lies',       ['Crime', 'Drama']),
      makeSeriesItem('tv4', 'Neon Nights',        ['Sci-Fi', 'Thriller']),
      makeSeriesItem('tv5', 'Heartland',          ['Drama', 'Romance']),
      makeSeriesItem('tv6', 'The Reckoning',      ['Action', 'Drama']),
    ],
  },
  {
    id: 'tvshows-crime',
    title: 'Crime & Thriller',
    items: [
      makeSeriesItem('cr1', 'Cold Case Files',    ['Crime', 'Documentary']),
      makeSeriesItem('cr2', 'Shadow Precinct',    ['Crime', 'Drama']),
      makeSeriesItem('cr3', 'The Informant',      ['Thriller', 'Crime']),
      makeSeriesItem('cr4', 'Underworld',         ['Crime', 'Action']),
      makeSeriesItem('cr5', 'Verdict Unknown',    ['Crime', 'Drama']),
    ],
  },
  {
    id: 'tvshows-comedy',
    title: 'Comedy',
    items: [
      makeSeriesItem('co1', 'Laugh Track',        ['Comedy']),
      makeSeriesItem('co2', 'The Office Hours',   ['Comedy', 'Drama']),
      makeSeriesItem('co3', 'Happy Campers',      ['Comedy']),
      makeSeriesItem('co4', 'Side Effects',       ['Comedy', 'Romance']),
      makeSeriesItem('co5', 'Roommates',          ['Comedy']),
    ],
  },
]

export const RADIO_ROWS: ContentRow[] = [
  {
    id: 'radio-live',
    title: 'Live Radio',
    items: [
      makeRadioItem('r1', 'Hit FM 91.1',         ['Pop', 'Hits']),
      makeRadioItem('r2', 'Rock Station 101',    ['Rock', 'Classic Rock']),
      makeRadioItem('r3', 'Jazz Lounge',         ['Jazz', 'Blues']),
      makeRadioItem('r4', 'Classical FM',        ['Classical']),
      makeRadioItem('r5', 'News Radio 24/7',     ['News', 'Talk']),
      makeRadioItem('r6', 'Chill Vibes',         ['Chillout', 'Electronic']),
    ],
  },
  {
    id: 'radio-music',
    title: 'Music Channels',
    items: [
      makeRadioItem('m1', 'Top 40 Hits',         ['Pop']),
      makeRadioItem('m2', 'Hip Hop Nation',      ['Hip-Hop', 'Rap']),
      makeRadioItem('m3', 'Retro 80s',           ['Retro', 'Pop']),
      makeRadioItem('m4', 'Country Roads',       ['Country']),
      makeRadioItem('m5', 'Electronic Pulse',    ['Electronic', 'Dance']),
      makeRadioItem('m6', 'Indie Mix',           ['Indie', 'Alternative']),
    ],
  },
  {
    id: 'radio-talk',
    title: 'Talk & Podcasts',
    items: [
      makeRadioItem('p1', 'Morning Show',        ['Talk', 'News']),
      makeRadioItem('p2', 'Sports Talk Live',    ['Sports', 'Talk']),
      makeRadioItem('p3', 'Tech Tonight',        ['Technology', 'Talk']),
      makeRadioItem('p4', 'Story Time',          ['Stories', 'Drama']),
      makeRadioItem('p5', 'Health & Wellness',   ['Health', 'Talk']),
    ],
  },
]

export const HERO_ITEM: ContentItem = MOCK_ROWS[0].items[0]
