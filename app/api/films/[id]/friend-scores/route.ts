/**
 * GET /api/films/[id]/friend-scores
 *
 * Returns all of the current user's friends with their computed match score
 * for the given film. Used on the insight card after logging.
 *
 * Returns:
 *   { friends: Array<{ id, name, matchScore }> }
 *
 * Friends without enough logs for a taste code are omitted.
 * Film without dimensions_v2 returns an empty list.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { computeTasteCode, RatedFilmEntry } from '@/lib/taste-code'
import { computeMatchScore, applyQualityMultiplier, computeCompositeQuality, MATCH_SCORE_MIN_FILMS } from '@/lib/taste/match-score'
import { FilmDimensionsV2 } from '@/lib/prompts/film-brief'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: filmId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  // ── Fetch film dimensions ────────────────────────────────────────────────────
  const { data: film } = await supabase
    .from('films')
    .select('id, tmdb_vote_average, tmdb_vote_count, imdb_rating, rt_score, metacritic, ai_brief')
    .eq('id', filmId)
    .single()

  if (!film) return NextResponse.json({ friends: [] })

  const dims = (film.ai_brief as { dimensions_v2?: Partial<FilmDimensionsV2> } | null)?.dimensions_v2 ?? null
  if (!dims) return NextResponse.json({ friends: [] })

  const compositeQuality = computeCompositeQuality({
    tmdbVoteAverage: film.tmdb_vote_average,
    tmdbVoteCount: film.tmdb_vote_count,
    imdbRating: film.imdb_rating,
    rtScore: film.rt_score,
    metacritic: film.metacritic,
  })

  // ── Fetch all accepted friends ───────────────────────────────────────────────
  const [{ data: sent }, { data: received }] = await Promise.all([
    admin
      .from('friend_requests')
      .select('friend:to_user_id(id, name)')
      .eq('from_user_id', user.id)
      .eq('status', 'accepted'),
    admin
      .from('friend_requests')
      .select('friend:from_user_id(id, name)')
      .eq('to_user_id', user.id)
      .eq('status', 'accepted'),
  ])

  const friendRows = [
    ...(sent ?? []).map((r: any) => r.friend),
    ...(received ?? []).map((r: any) => r.friend),
  ].filter((f): f is { id: string; name: string } => !!f?.id)

  if (friendRows.length === 0) return NextResponse.json({ friends: [] })

  // ── Compute match score per friend + check if they've rated this film ────────
  const results = await Promise.all(
    friendRows.map(async ({ id: friendId, name }) => {
      // Fetch friend's full watched library (for taste code) + this specific film's entry
      const [{ data: entries }, { data: thisFilmEntry }] = await Promise.all([
        admin
          .from('library_entries')
          .select('film_id, my_stars, films(ai_brief)')
          .eq('user_id', friendId)
          .eq('list', 'watched')
          .not('my_stars', 'is', null),
        admin
          .from('library_entries')
          .select('my_stars')
          .eq('user_id', friendId)
          .eq('film_id', filmId)
          .eq('list', 'watched')
          .maybeSingle(),
      ])

      // If friend has rated this specific film, we can show their actual rating
      const myStars: number | null = (thisFilmEntry?.my_stars as number | null) ?? null

      if (!entries || entries.length < MATCH_SCORE_MIN_FILMS) return null

      const ratedEntries: RatedFilmEntry[] = entries
        .flatMap((e: any) => {
          const filmDims = (e.films?.ai_brief as { dimensions_v2?: FilmDimensionsV2 } | null)?.dimensions_v2 ?? null
          if (!filmDims) return []
          return [{
            film_id: e.film_id,
            title: '',
            poster_path: null,
            stars: e.my_stars as number,
            dimensions_v2: filmDims,
          } satisfies RatedFilmEntry]
        })

      if (ratedEntries.length < MATCH_SCORE_MIN_FILMS) return null

      const tasteCode = computeTasteCode(ratedEntries)
      if (!tasteCode) return null

      const rawScore = computeMatchScore(tasteCode, dims)
      const matchScore = Math.round(applyQualityMultiplier(rawScore, compositeQuality))

      return { id: friendId, name, matchScore, myStars }
    })
  )

  const friends = results
    .filter((r): r is { id: string; name: string; matchScore: number; myStars: number | null } => r !== null)
    .sort((a, b) => b.matchScore - a.matchScore)

  return NextResponse.json({ friends })
}
