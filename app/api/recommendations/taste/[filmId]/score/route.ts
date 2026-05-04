/**
 * GET /api/recommendations/taste/[filmId]/score
 *
 * Lightweight numeric-only match score — no LLM, no narrative.
 * Returns { score: number | null, filmDims: FilmDimensionsV2 | null }
 * in ~50–150ms (two DB queries + CPU only).
 *
 * Used by the rate/log flow where we need score + dims for the insight
 * card but don't need the prose narrative.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getOrCacheFilm } from '@/lib/tmdb'
import { computeTasteCode, RatedFilmEntry } from '@/lib/taste-code'
import { computeMatchScore, MATCH_SCORE_MIN_FILMS } from '@/lib/taste/match-score'
import { FilmDimensionsV2 } from '@/lib/prompts/film-brief'
import { posterUrl } from '@/lib/types'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ filmId: string }> }
) {
  const { filmId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  // Fetch film (cache from TMDB if needed) — also triggers brief generation
  // fire-and-forget so dimensions_v2 will be ready on future requests
  let film: Awaited<ReturnType<typeof getOrCacheFilm>> | null = null
  try { film = await getOrCacheFilm(supabase, filmId) } catch {}

  // Fetch user's rated library — only fields needed for taste code
  const { data: entries } = await supabase
    .from('library_entries')
    .select('film_id, my_stars, film:films(title, poster_path, ai_brief)')
    .eq('user_id', user.id)
    .eq('list', 'watched')

  type RawEntry = {
    film_id: string
    my_stars: number | null
    film: {
      title: string
      poster_path: string | null
      ai_brief: { dimensions_v2?: FilmDimensionsV2 } | null
    } | null
  }
  const allEntries = (entries ?? []) as unknown as RawEntry[]

  let score: number | null = null

  const ratedWithDims = allEntries.filter(
    e => e.my_stars != null && e.film?.ai_brief?.dimensions_v2
  )

  if (ratedWithDims.length >= MATCH_SCORE_MIN_FILMS) {
    const tasteCodeFilms: RatedFilmEntry[] = ratedWithDims.map(e => ({
      film_id:       e.film_id,
      title:         e.film?.title ?? '',
      poster_path:   e.film?.poster_path ? posterUrl(e.film.poster_path, 'w185') : null,
      stars:         e.my_stars as number,
      dimensions_v2: e.film!.ai_brief!.dimensions_v2 as FilmDimensionsV2,
    }))

    const tasteCode = computeTasteCode(tasteCodeFilms)
    const filmDimsV2 = (film?.ai_brief as { dimensions_v2?: FilmDimensionsV2 } | null)?.dimensions_v2 ?? null

    if (tasteCode && filmDimsV2) {
      score = computeMatchScore(tasteCode, filmDimsV2)
    }
  }

  const filmDimsV2 = (film?.ai_brief as { dimensions_v2?: FilmDimensionsV2 } | null)?.dimensions_v2 ?? null

  return NextResponse.json({ score, filmDims: filmDimsV2 })
}
