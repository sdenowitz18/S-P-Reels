export type FilmKind = 'movie' | 'tv'
export type ListKind = 'watched' | 'now_playing' | 'watchlist'
export type InterviewerPersona = 'warm' | 'blunt' | 'playful' | 'cinephile'
export type InterviewDepth = 'short' | 'medium' | 'long'

export type InterviewTopic =
  | 'how-it-felt'
  | 'what-worked'
  | 'scenes-and-moments'
  | 'key-themes'
  | 'the-craft'
  | 'performances'
  | 'surprise-me'

export const ALL_TOPICS: InterviewTopic[] = [
  'how-it-felt',
  'what-worked',
  'scenes-and-moments',
  'key-themes',
  'the-craft',
  'performances',
  'surprise-me',
]

export const TOPIC_LABELS: Record<InterviewTopic, string> = {
  'how-it-felt':         'how it felt',
  'what-worked':         'what worked and what didn\'t',
  'scenes-and-moments':  'specific scenes and moments',
  'key-themes':          'key themes',
  'the-craft':           'the craft',
  'performances':        'the performances',
  'surprise-me':         'surprise me',
}

export interface FilmBriefData {
  emotional_question?: string
  tone?: string
  genres?: string[]
  themes?: { theme: string; summary: string }[]
  discourse?: { loved: string; wrestled_with: string; debate: string }
  scenes?: { name: string; hook: string }[]
  craft?: string[]
  performances?: { actor: string; note: string }[]
  viewer_fit?: { connects: string; bounces: string }
  dimensions?: {
    pace: number
    story_engine: number
    tone: number
    warmth: number
    complexity: number
    style: number
  }
}

export interface Film {
  id: string
  kind: FilmKind
  tmdb_id: number
  title: string
  year: number | null
  director: string | null
  poster_path: string | null
  backdrop_path: string | null
  synopsis: string | null
  runtime_minutes: number | null
  cast_json: CastMember[] | null
  keywords: string[] | null
  tmdb_genres: string[] | null
  ai_brief?: FilmBriefData | null
  fetched_at: string
}

export interface CastMember {
  name: string
  character: string
}

export interface LibraryEntry {
  id: string
  user_id: string
  film_id: string
  film?: Film
  list: ListKind
  audience: string[]
  my_stars: number | null
  my_line: string | null
  moods: string[] | null
  why: string | null
  started_at: string | null
  live_notes: LiveNote[] | null
  added_at: string
  finished_at: string | null
}

export interface LiveNote {
  at: string
  text: string
}

export interface Interview {
  id: string
  user_id: string
  film_id: string
  group_id: string | null
  interviewer: InterviewerPersona
  depth: InterviewDepth
  transcript: TranscriptEntry[]
  taste_tags: string[] | null
  reflection: ReflectionResult | null
  created_at: string
}

export interface TranscriptEntry {
  role: 'interviewer' | 'me'
  text: string
  at: string
}

export interface ReflectionResult {
  taste_tags: string[]
  taste_note: string
  shifts: string
  similar: SimilarFilm[]
}

export interface SimilarFilm {
  title: string
  year: number
  dir: string
  why: string
}

export interface Group {
  id: string
  name: string
  created_by: string
  created_at: string
  members?: GroupMember[]
}

export interface GroupMember {
  group_id: string
  user_id: string
  joined_at: string
  user?: UserProfile
}

export interface UserProfile {
  id: string
  email: string
  name: string
  accent_color: string | null
  created_at: string
}

export interface Recommendation {
  id: string
  group_id: string
  film_id: string
  film?: Film
  from_user_id: string
  from_user?: UserProfile
  status: 'saved' | 'now-playing' | 'finished'
  note: string | null
  created_at: string
  reactions?: RecommendationReaction[]
  replies?: RecommendationReply[]
}

export interface RecommendationReaction {
  rec_id: string
  user_id: string
  kind: 'want' | 'saw'
  at: string
}

export interface RecommendationReply {
  id: string
  rec_id: string
  user_id: string
  user?: UserProfile
  text: string
  at: string
}

export interface Notification {
  id: string
  user_id: string
  kind: string
  by_user_id: string | null
  group_id: string | null
  ref_type: string | null
  ref_id: string | null
  summary: string
  read: boolean
  at: string
}

export interface UserTasteTag {
  user_id: string
  tag: string
  weight: number
}

// TMDB search result (before caching)
export interface TMDBSearchResult {
  id: string
  title: string
  year: number | null
  kind: FilmKind
  poster_path: string | null
  director: string | null
}

export function posterUrl(path: string | null, size: 'w92' | 'w185' | 'w342' | 'w500' | 'original' = 'w342'): string | null {
  if (!path) return null
  return `https://image.tmdb.org/t/p/${size}${path}`
}

export const DEPTH_QUESTIONS: Record<InterviewDepth, number> = {
  short: 2,
  medium: 4,
  long: 6,
}
