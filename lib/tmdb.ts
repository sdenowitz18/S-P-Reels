import { Film, FilmKind, CastMember } from './types'
import { generateFilmBrief } from './prompts/film-brief'

const BASE = 'https://api.themoviedb.org/3'

async function tmdb(path: string, params: Record<string, string> = {}) {
  const key = process.env.TMDB_API_KEY!
  const url = new URL(`${BASE}${path}`)
  url.searchParams.set('api_key', key)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const res = await fetch(url.toString(), { next: { revalidate: 604800 } }) // 7 days
  if (!res.ok) throw new Error(`TMDB ${path} → ${res.status}`)
  return res.json()
}

export async function searchFilms(query: string, kind: 'movie' | 'tv' | 'both' = 'both') {
  const data = await tmdb('/search/multi', { query, include_adult: 'false' })
  return (data.results as any[])
    .filter(r => r.media_type === 'movie' || r.media_type === 'tv')
    .filter(r => kind === 'both' || r.media_type === kind)
    .slice(0, 10)
    .map(r => ({
      id: `${r.media_type}-${r.id}` as string,
      title: r.title ?? r.name,
      year: r.release_date ? parseInt(r.release_date) : r.first_air_date ? parseInt(r.first_air_date) : null,
      kind: r.media_type as FilmKind,
      poster_path: r.poster_path ?? null,
      director: null,
    }))
}

export async function fetchFilm(kind: FilmKind, tmdbId: number): Promise<Film> {
  const path = kind === 'movie' ? `/movie/${tmdbId}` : `/tv/${tmdbId}`
  const data = await tmdb(path, { append_to_response: 'credits,keywords' })

  const director = kind === 'movie'
    ? data.credits?.crew?.find((c: any) => c.job === 'Director')?.name ?? null
    : data.created_by?.[0]?.name ?? null

  const cast: CastMember[] = (data.credits?.cast ?? []).slice(0, 8).map((c: any) => ({
    name: c.name,
    character: c.character,
  }))

  const keywords: string[] = kind === 'movie'
    ? (data.keywords?.keywords ?? []).slice(0, 20).map((k: any) => k.name)
    : (data.keywords?.results ?? []).slice(0, 20).map((k: any) => k.name)

  const tmdb_genres: string[] = (data.genres ?? []).map((g: any) => g.name as string)

  return {
    id: `${kind}-${tmdbId}`,
    kind,
    tmdb_id: tmdbId,
    title: data.title ?? data.name,
    year: data.release_date ? parseInt(data.release_date) : data.first_air_date ? parseInt(data.first_air_date) : null,
    director,
    poster_path: data.poster_path ?? null,
    backdrop_path: data.backdrop_path ?? null,
    synopsis: data.overview ?? null,
    runtime_minutes: data.runtime ?? data.episode_run_time?.[0] ?? null,
    cast_json: cast,
    keywords,
    tmdb_genres,
    tmdb_vote_average: data.vote_average ?? null,
    tmdb_vote_count:   data.vote_count   ?? null,
    fetched_at: new Date().toISOString(),
  }
}

export async function getOrCacheFilm(supabase: any, filmId: string): Promise<Film> {
  const { data: cached } = await supabase
    .from('films')
    .select('*')
    .eq('id', filmId)
    .single()

  if (cached) {
    const weekOld = Date.now() - 7 * 24 * 60 * 60 * 1000
    if (new Date(cached.fetched_at).getTime() > weekOld) {
      // fire brief generation in background if not yet done
      if (!cached.ai_brief) {
        generateFilmBrief(cached).then(brief => {
          if (brief) supabase.from('films').update({ ai_brief: brief, brief_at: new Date().toISOString() }).eq('id', filmId)
        }).catch(() => {})
      }
      return cached
    }
  }

  const [kind, id] = filmId.split('-') as [FilmKind, string]
  const film = await fetchFilm(kind, parseInt(id))

  await supabase.from('films').upsert(film)

  // fire brief generation in background — don't await
  generateFilmBrief(film).then(brief => {
    if (brief) supabase.from('films').update({ ai_brief: brief, brief_at: new Date().toISOString() }).eq('id', filmId)
  }).catch(() => {})

  return film
}

/**
 * Returns the YouTube video key for the best available trailer,
 * or null if none found. Priority: official Trailer > any Trailer > any YouTube video.
 */
export async function fetchTrailerKey(kind: FilmKind, tmdbId: number): Promise<string | null> {
  try {
    const path = kind === 'movie' ? `/movie/${tmdbId}/videos` : `/tv/${tmdbId}/videos`
    const data = await tmdb(path)
    const videos: any[] = data.results ?? []
    const yt = videos.filter(v => v.site === 'YouTube')
    const pick =
      yt.find(v => v.type === 'Trailer' && v.official) ??
      yt.find(v => v.type === 'Trailer') ??
      yt[0] ??
      null
    return pick?.key ?? null
  } catch {
    return null
  }
}

export async function validateFilmTitle(title: string, year?: number): Promise<string | null> {
  const results = await searchFilms(title)
  const match = results.find(r =>
    r.title.toLowerCase() === title.toLowerCase() &&
    (year == null || r.year === year)
  )
  return match?.id ?? null
}
