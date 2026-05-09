/**
 * GET /api/films/index
 *
 * Lean filter index: film IDs + kind + genres + match score only.
 * No posters, synopses, or dim breakdowns — just what's needed to:
 *   1. Filter client-side by genre / media type (instant)
 *   2. Know the global match-score sort order
 *
 * The catalog page loads this once in the background after the initial
 * paginated render. Once loaded, all genre / media filters are instant.
 *
 * Approximate payload: ~200 bytes per film × 5000 = 1MB uncompressed,
 * ~120KB gzipped — fine as a one-time background load.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { computeTasteCode, RatedFilmEntry } from '@/lib/taste-code'
import { computeMatchScore, applyQualityMultiplier, computeCompositeQuality, MATCH_SCORE_MIN_FILMS } from '@/lib/taste/match-score'
import { FilmDimensionsV2 } from '@/lib/prompts/film-brief'
import { posterUrl } from '@/lib/types'

type IndexRow = {
  id: string
  title: string
  year: number | null
  poster_path: string | null
  director: string | null
  kind: 'movie' | 'tv' | null
  tmdb_genres: string[] | null
  tmdb_vote_average: number | null
  tmdb_vote_count: number | null
  imdb_rating: number | null
  rt_score: number | null
  metacritic: number | null
  ai_brief: { dimensions_v2?: FilmDimensionsV2; genres?: string[] } | null
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const sp      = req.nextUrl.searchParams
  const newOnly = sp.get('newOnly') === 'true'
  const NEW_SINCE = new Date().getFullYear() - 1

  // ── Library: watched IDs + taste code inputs ─────────────────────────────────
  const { data: libraryEntries } = await supabase
    .from('library_entries')
    .select('film_id, list, my_stars, film:films(title, poster_path, ai_brief)')
    .eq('user_id', user.id)

  type LibEntry = {
    film_id: string; list: string; my_stars: number | null
    film: { title: string; poster_path: string | null; ai_brief: { dimensions_v2?: FilmDimensionsV2 } | null } | null
  }
  const lib = (libraryEntries ?? []) as unknown as LibEntry[]

  const ratedWithDims = lib.filter(e => e.list === 'watched' && e.my_stars != null && e.film?.ai_brief?.dimensions_v2)

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

  const watchedIds  = new Set(lib.filter(e => e.list === 'watched').map(e => e.film_id))
  const dismissedIds = new Set(lib.filter(e => e.list === 'dismissed').map(e => e.film_id))
  const libraryMap = new Map(lib.map(e => [e.film_id, { list: e.list, my_stars: e.my_stars }]))

  // ── Film fetch ───────────────────────────────────────────────────────────────
  // Select ai_brief as a whole column (JSON path extraction via -> didn't
  // reliably map to IndexRow fields via the JS client).
  let q = supabase
    .from('films')
    .select('id, title, year, poster_path, director, kind, tmdb_genres, tmdb_vote_average, tmdb_vote_count, imdb_rating, rt_score, metacritic, ai_brief')
    .not('ai_brief->dimensions_v2', 'is', null)
    .limit(5000)
  if (newOnly) q = q.gte('year', NEW_SINCE)

  const { data: rawFilms, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // ── Score + filter ───────────────────────────────────────────────────────────
  const index = (rawFilms as unknown as IndexRow[])
    .filter(f => !watchedIds.has(f.id) && !dismissedIds.has(f.id))
    .map(f => {
      const dimsV2 = f.ai_brief?.dimensions_v2 ?? null
      const tasteScore = tasteCode && dimsV2
        ? computeMatchScore(tasteCode, dimsV2)
        : null
      const compositeQuality = computeCompositeQuality({
        tmdbVoteAverage: f.tmdb_vote_average, tmdbVoteCount: f.tmdb_vote_count,
        imdbRating: f.imdb_rating, rtScore: f.rt_score, metacritic: f.metacritic,
      })
      const matchScore = tasteScore != null
        ? applyQualityMultiplier(tasteScore, compositeQuality)
        : null
      return {
        id:              f.id,
        title:           f.title,
        year:            f.year,
        poster_path:     f.poster_path ? posterUrl(f.poster_path, 'w342') : null,
        director:        f.director,
        kind:            (f.kind ?? 'movie') as 'movie' | 'tv',
        genres:          f.tmdb_genres ?? [],
        aiGenres:        (f.ai_brief as { genres?: string[] } | null)?.genres ?? [],
        tmdb_vote_average: f.tmdb_vote_average,
        imdb_rating:     f.imdb_rating,
        rt_score:        f.rt_score,
        metacritic:      f.metacritic,
        matchScore,
        tasteScore,
        compositeQuality,
        libraryStatus:   libraryMap.get(f.id) ?? null,
      }
    })
    .sort((a, b) => {
      // Primary: match score (null → fall through to quality)
      const aScore = a.matchScore ?? a.compositeQuality ?? 0
      const bScore = b.matchScore ?? b.compositeQuality ?? 0
      return bScore - aScore
    })

  return NextResponse.json({
    index,
    hasMatchScores: tasteCode != null,
  }, {
    headers: {
      'Cache-Control': 'private, max-age=300, stale-while-revalidate=60',
    },
  })
}

