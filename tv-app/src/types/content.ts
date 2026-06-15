export interface ContentItem {
  id: string
  title: string
  description: string
  thumbnailUrl: string
  backdropUrl: string
  streamUrl: string
  duration: number
  genre: string[]
  year: number
  rating: string
  type: 'movie' | 'series' | 'episode'
}

export interface ContentRow {
  id: string
  title: string
  items: ContentItem[]
}

export type Screen = 'activation' | 'home' | 'livetv' | 'movies' | 'tvshows' | 'catchup' | 'catchupdetail' | 'radio' | 'radioplayer' | 'browse' | 'detail' | 'player' | 'search' | 'settings' | 'moviedetail' | 'tvshowdetail' | 'contactus'
