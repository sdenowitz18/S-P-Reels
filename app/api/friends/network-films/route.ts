/**
 * GET /api/friends/network-films
 *
 * Returns all films watched by the current user's friend network,
 * with watcher attribution (who watched it + their star rating).
 * Also computes the user's own match score for each film.
 *
 * Sorted by: watcher count desc, then match score desc.
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { computeTasteCode, RatedFilmEntry } from '@/lib/taste-code'
import { computeMatchScore, applyQualityMultiplier, computeCompositeQuality, MATCH_SCORE_MIN_FILMS } from '@/lib/taste/match-score'
import { FilmDimensionsV2 } from '@/lib/prompts/film-brief'
import { posterUrl } from '@/lib/types'

export interface NetworkFilm {
  id: string
  title: string
  year: number | null
  poster_path: string | null
  director: string | null
  kind: 'movie' | 'tv'
  genres: string[]
  aiGenres: string[]
  tmdb_vote_average: number | null
  matchScore: number | null
  tasteScore: number | null
  compositeQuality: number | null
  libraryStatus: { list: string; my_stars: number | null } | null
  recommendedBy: string[]
  watchers: { id: string; name: string; stars: number | null }[]
  watcherCount: number
  dimBreakdown: []
  synopsis: null
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  // ── Friends ──────────────────────────────────────────────────────────────────
  const [{ data: sent }, { data: received }] = await Promise.all([
    admin.from('friend_requests').select('friend:to_user_id(id, name)').eq('from_user_id', user.id).eq('status', 'accepted'),
    admin.from('friend_requests').select('friend:from_user_id(id, name)').eq('to_user_id', user.id).eq('status', 'accepted'),
  ])

  const friends: { id: string; name: string }[] = [
    ...(sent   ?? []).map((r: any) => r.friend),
    ...(received ?? []).map((r: any) => r.friend),
  ].filter((f): f is { id: string; name: string } => !!f?.id)

  const friendIds = friends.map(f => f.id)
  const nameMap   = new Map(friends.map(f => [f.id, f.name]))

  // ── User's own library (for libraryStatus + taste code) ───────────────────────
  type MyEntry = {
    film_id: string; list: string; my_stars: number | null
    film: { title: string; poster_path: string | null; ai_brief: { dimensions_v2?: FilmDimensionsV2 } | null } | null
  }
  const { data: myLib } = await supabase
    .from('library_entries')
    .select('film_id, list, my_stars, film:films(title, poster_path, ai_brief)')
    .eq('user_id', user.id)

  const myEntries = (myLib ?? []) as unknown as MyEntry[]

  const libraryMap = new Map(myEntries.map(e => [e.film_id, { list: e.list, my_stars: e.my_stars }]))
  const watchedIds  = new Set(myEntries.filter(e => e.list === 'watched').map(e => e.film_id))
  const dismissedIds = new Set(myEntries.filter(e => e.list === 'dismissed').map(e => e.film_id))

  const ratedWithDims = myEntries.filter(e => e.list === 'watched' && e.my_stars != null && e.film?.ai_brief?.dimensions_v2)
  let tasteCode = null
  if (ratedWithDims.length >= MATCH_SCORE_MIN_FILMS) {
    const tasteCodeFilms: RatedFilmEntry[] = ratedWithDims.map(e => ({
      film_id:       e.film_id,
      title:         e.film?.title ?? '',
      poster_path:   e.film?.poster_path ? posterUrl(e.film.poster_path, 'w185') : null,
      stars:         e.my_stars as number,
      dimensions_v2: e.film!.ai_brief!.dimensions_v2 as FilmDimensionsV2,
    }))
    tasteCode = computeTasteCode(tasteCodeFilms)
  }

  // ── All users' watched entries (any registered user, not just friends) ──────
  // Attribution (watchers shown on card) is still friend-only — we just use the
  // full user pool as the candidate set so the catalog isn't sparse.
  type FriendEntry = {
    film_id: string; my_stars: number | null; user_id: string
    film: {
      id: string; title: string; year: number | null; poster_path: string | null
      director: string | null; kind: 'movie' | 'tv' | null
      tmdb_genres: string[] | null
      tmdb_vote_average: number | null; tmdb_vote_count: number | null
      imdb_rating: number | null; rt_score: number | null; metacritic: number | null
      ai_brief: { dimensions_v2?: FilmDimensionsV2; genres?: string[] } | null
    } | null
  }
  const friendIdSet = new Set(friendIds)
  const { data: friendEntries } = await admin
    .from('library_entries')
    .select('film_id, my_stars, user_id, film:films(id, title, year, poster_path, director, kind, tmdb_genres, tmdb_vote_average, tmdb_vote_count, imdb_rating, rt_score, metacritic, ai_brief)')
    .neq('user_id', user.id)
    .eq('list', 'watched')

  // ── Group by film ─────────────────────────────────────────────────────────────
  const filmMap = new Map<string, { film: FriendEntry['film']; watchers: NetworkFilm['watchers'] }>()

  for (const e of (friendEntries ?? []) as unknown as FriendEntry[]) {
    const f = Array.isArray(e.film) ? e.film[0] : e.film
    if (!f) continue
    if (!filmMap.has(e.film_id)) filmMap.set(e.film_id, { film: f, watchers: [] })
    // Only attribute to friends — non-friends just expand the pool silently
    if (friendIdSet.has(e.user_id)) {
      filmMap.get(e.film_id)!.watchers.push({
        id:    e.user_id,
        name:  nameMap.get(e.user_id) ?? 'Friend',
        stars: e.my_stars ?? null,
      })
    }
  }

  // ── Score + assemble ─────────────────────────────────────────────────────────
  const films: NetworkFilm[] = Array.from(filmMap.entries())
    .filter(([filmId]) => !watchedIds.has(filmId) && !dismissedIds.has(filmId))
    .map(([, { film, watchers }]) => {
    if (!film) return null as unknown as NetworkFilm
    const dims = film.ai_brief?.dimensions_v2 ?? null
    const tasteScore = tasteCode && dims ? computeMatchScore(tasteCode, dims) : null
    const compositeQuality = computeCompositeQuality({
      tmdbVoteAverage: film.tmdb_vote_average, tmdbVoteCount: film.tmdb_vote_count,
      imdbRating: film.imdb_rating, rtScore: film.rt_score, metacritic: film.metacritic,
    })
    const matchScore = tasteScore != null ? Math.round(applyQualityMultiplier(tasteScore, compositeQuality)) : null

    return {
      id:               film.id,
      title:            film.title,
      year:             film.year,
      poster_path:      film.poster_path ? posterUrl(film.poster_path, 'w342') : null,
      director:         film.director,
      kind:             (film.kind ?? 'movie') as 'movie' | 'tv',
      genres:           film.tmdb_genres ?? [],
      aiGenres:         film.ai_brief?.genres ?? [],
      tmdb_vote_average: film.tmdb_vote_average,
      matchScore,
      tasteScore,
      compositeQuality,
      libraryStatus:    libraryMap.get(film.id) ?? null,
      recommendedBy:    [],
      watchers,
      watcherCount:     watchers.length,
      dimBreakdown:     [] as [],
      synopsis:         null,
    }
  }).filter(Boolean)

  // Sort: match score desc, composite quality as fallback
  films.sort((a, b) => {
    const aScore = a.matchScore ?? a.compositeQuality ?? 0
    const bScore = b.matchScore ?? b.compositeQuality ?? 0
    return bScore - aScore
  })

  return NextResponse.json({ friends, films })
}
