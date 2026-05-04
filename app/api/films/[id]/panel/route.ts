/**
 * GET /api/films/[id]/panel
 *
 * Returns full panel data for a single film — used when the catalog index
 * (which is lean) served a film that the user then clicked to open in the panel.
 *
 * Returns:
 *   - synopsis, tmdb_id, tmdb_vote_average, tmdb_vote_count, imdb_rating,
 *     rt_score, metacritic (the fields the lean index omits)
 *   - dimBreakdown: user's taste alignment per dimension (requires taste code)
 *   - matchScore, tasteScore, compositeQuality
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { computeTasteCode, RatedFilmEntry, TasteCode, ALL_POLES } from '@/lib/taste-code'
import { computeMatchScore, applyQualityMultiplier, computeCompositeQuality, MATCH_SCORE_MIN_FILMS } from '@/lib/taste/match-score'
import { FilmDimensionsV2 } from '@/lib/prompts/film-brief'
import { DimBreakdown } from '@/app/api/films/route'
import { posterUrl } from '@/lib/types'

function buildDimBreakdown(tasteCode: TasteCode, dims: Partial<FilmDimensionsV2>): DimBreakdown[] {
  const filmDims = (Object.entries(dims) as [keyof FilmDimensionsV2, number][])
    .map(([dimKey, filmScore]) => ({ dimKey, filmScore, signal: Math.abs(filmScore - 50) / 50 }))
    .sort((a, b) => b.signal - a.signal)
    .slice(0, 4)

  const entryByDimKey = new Map(tasteCode.allEntries.map(e => [e.dimKey, e]))

  return filmDims.map(({ dimKey, filmScore, signal }) => {
    const leftPole  = ALL_POLES.find(p => p.dimKey === dimKey && p.pole === 'left')!
    const rightPole = ALL_POLES.find(p => p.dimKey === dimKey && p.pole === 'right')!
    const entry = entryByDimKey.get(dimKey)

    const leftPoleScore  = entry ? (entry.pole === 'left'  ? entry.poleScore : entry.oppositeScore) : 50
    const rightPoleScore = entry ? (entry.pole === 'right' ? entry.poleScore : entry.oppositeScore) : 50
    const userBias       = rightPoleScore - leftPoleScore
    const filmPoleScore  = filmScore < 50 ? leftPoleScore : rightPoleScore
    const contribution   = filmPoleScore * signal

    return {
      dimKey,
      leftLetter: leftPole.letter, leftLabel: leftPole.label,
      rightLetter: rightPole.letter, rightLabel: rightPole.label,
      filmScore, filmPoleScore, leftPoleScore, rightPoleScore, userBias, contribution,
    }
  })
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  // Fetch film row
  const { data: film } = await supabase
    .from('films')
    .select('id, title, year, poster_path, director, kind, synopsis, tmdb_id, tmdb_genres, tmdb_vote_average, tmdb_vote_count, imdb_rating, rt_score, metacritic, ai_brief')
    .eq('id', id)
    .single()

  if (!film) return NextResponse.json({ error: 'not found' }, { status: 404 })

  // Fetch user library for taste code
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
      film_id: e.film_id,
      title: e.film?.title ?? '',
      poster_path: e.film?.poster_path ? posterUrl(e.film.poster_path, 'w185') : null,
      stars: e.my_stars as number,
      dimensions_v2: e.film!.ai_brief!.dimensions_v2 as FilmDimensionsV2,
    }))
    tasteCode = computeTasteCode(tasteCodeFilms)
  }

  const dimsV2 = (film.ai_brief as { dimensions_v2?: FilmDimensionsV2 } | null)?.dimensions_v2 ?? null
  const compositeQuality = computeCompositeQuality({
    tmdbVoteAverage: film.tmdb_vote_average, tmdbVoteCount: film.tmdb_vote_count,
    imdbRating: film.imdb_rating, rtScore: film.rt_score, metacritic: film.metacritic,
  })
  const tasteScore = tasteCode && dimsV2 ? computeMatchScore(tasteCode, dimsV2) : null
  const matchScore = tasteScore != null ? applyQualityMultiplier(tasteScore, compositeQuality) : null
  const dimBreakdown = tasteCode && dimsV2 ? buildDimBreakdown(tasteCode, dimsV2) : []

  return NextResponse.json({
    synopsis:          film.synopsis ?? null,
    tmdb_id:           film.tmdb_id ?? null,
    tmdb_vote_average: film.tmdb_vote_average ?? null,
    tmdb_vote_count:   film.tmdb_vote_count ?? null,
    imdb_rating:       film.imdb_rating ?? null,
    rt_score:          film.rt_score ?? null,
    metacritic:        film.metacritic ?? null,
    matchScore,
    tasteScore,
    compositeQuality,
    dimBreakdown,
  })
}
