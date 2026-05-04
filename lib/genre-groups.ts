/**
 * Two-level genre taxonomy.
 * Broad categories map to TMDB sub-genres AND AI-generated subgenre keywords
 * (from ai_brief.genres, e.g. "horror comedy"). Both are used for filtering.
 */
export const GENRE_GROUPS = [
  {
    label: 'Drama',
    tmdb: ['Drama', 'History', 'TV Movie'],
    keywords: ['drama', 'melodrama', 'historical', 'biographical', 'coming-of-age', 'family drama', 'social drama', 'period drama', 'war drama', 'domestic'],
  },
  {
    label: 'Action',
    tmdb: ['Action', 'Adventure', 'War', 'Western', 'Action & Adventure'],
    keywords: ['action', 'adventure', 'war', 'western', 'heist', 'spy', 'superhero', 'martial arts', 'action thriller', 'military'],
  },
  {
    label: 'Comedy',
    tmdb: ['Comedy', 'Romance', 'Talk'],
    keywords: ['comedy', 'romantic comedy', 'dark comedy', 'satire', 'parody', 'rom-com', 'screwball', 'black comedy', 'horror comedy', 'absurdist', 'farce'],
  },
  {
    label: 'Horror & Thriller',
    tmdb: ['Horror', 'Thriller', 'Mystery', 'Crime'],
    keywords: ['horror', 'thriller', 'mystery', 'crime', 'noir', 'suspense', 'psychological thriller', 'slasher', 'supernatural horror', 'gothic', 'body horror', 'survival thriller', 'neo-noir', 'domestic noir'],
  },
  {
    label: 'Sci-Fi & Fantasy',
    tmdb: ['Science Fiction', 'Fantasy', 'Sci-Fi & Fantasy'],
    keywords: ['sci-fi', 'science fiction', 'fantasy', 'dystopian', 'cyberpunk', 'supernatural', 'space opera', 'time travel', 'post-apocalyptic', 'speculative'],
  },
  {
    label: 'Animation',
    tmdb: ['Animation', 'Family', 'Kids'],
    keywords: ['animated', 'animation', 'family', 'anime', 'stop-motion'],
  },
  {
    label: 'Documentary',
    tmdb: ['Documentary', 'Music', 'News', 'Reality'],
    keywords: ['documentary', 'docudrama', 'biopic', 'music documentary', 'nature documentary', 'true crime documentary'],
  },
] as const

export type GenreGroup = typeof GENRE_GROUPS[number]
