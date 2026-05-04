/**
 * POST /api/mood/recommend
 *
 * Mood Room recommendation engine — finds films that score well for ALL
 * members of the room using the Consensus Harmony Score.
 *
 * Algorithm (per film):
 *   1. Compute each member's individual match score (taste code vs. film dims)
 *   2. roomScore = mean(scores) − 0.5 × stdev(scores)
 *      → low variance (everyone agrees) keeps score near mean
 *      → high variance (split opinion) pulls score down
 *   3. Members without enough logs for a taste code are excluded from scoring
 *      (treated as flexible — they don't pull the score down)
 *   4. If no member has a taste code, fall back to compositeQuality sort
 *
 * Request body:
 *   memberIds:   string[]   — friend user IDs to add to room (current user always included)
 *   filters:     {
 *     kind?:        'movie' | 'tv'        — omit for both
 *     aiGenre?:     string                — AI genre keyword filter
 *     newReleases?: boolean               — films from last 2 years only
 *   }
 *   offset?:     number     — pagination offset (default 0)
 *   limit?:      number     — results per page (default 5)
 *   exclude?:    string[]   — film IDs already shown (skip them)
 *
 * Returns:
 *   {
 *     films: Array<{
 *       id, title, year, poster_path, director, kind,
 *       roomScore, memberScores: { [userId]: number }
 *     }>
 *     totalScored: number
 *     hasTasteCode: boolean  — whether any member had a taste code
 *     memberIds: string[]    — all member IDs in the room (current user + friends)
 *   }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { computeTasteCode, RatedFilmEntry, TasteCode } from '@/lib/taste-code'
import {
  computeMatchScore,
  applyQualityMultiplier,
  computeCompositeQuality,
  MATCH_SCORE_MIN_FILMS,
} from '@/lib/taste/match-score'
import { FilmDimensionsV2 } from '@/lib/prompts/film-brief'
import { posterUrl } from '@/lib/types'

type FilmRow = {
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

function stdev(values: number[]): number {
  if (values.length < 2) return 0
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  const variance = values.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / values.length
  return Math.sqrt(variance)
}

/** Fetch taste code for a single user using the admin client. */
async function fetchTasteCode(
  userId: string,
  admin: ReturnType<typeof createAdminClient>,
): Promise<TasteCode | null> {
  const { data: entries } = await admin
    .from('library_entries')
    .select('film_id, my_stars, films(title, poster_path, ai_brief)')
    .eq('user_id', userId)
    .eq('list', 'watched')
    .not('my_stars', 'is', null)

  if (!entries || entries.length < MATCH_SCORE_MIN_FILMS) return null

  const ratedEntries: RatedFilmEntry[] = (entries as any[]).flatMap(e => {
    const dims = (e.films?.ai_brief as { dimensions_v2?: FilmDimensionsV2 } | null)?.dimensions_v2
    if (!dims) return []
    return [{
      film_id: e.film_id,
      title: e.films?.title ?? '',
      poster_path: e.films?.poster_path ? posterUrl(e.films.poster_path, 'w185') : null,
      stars: e.my_stars as number,
      dimensions_v2: dims,
    } satisfies RatedFilmEntry]
  })

  if (ratedEntries.length < MATCH_SCORE_MIN_FILMS) return null
  return computeTasteCode(ratedEntries)
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = await req.json()
  const memberIds: string[] = body.memberIds ?? []
  const filters = body.filters ?? {}
  const offset: number  = body.offset  ?? 0
  const limit: number   = body.limit   ?? 5
  const exclude: string[] = body.exclude ?? []

  // Always include current user; deduplicate
  const allMemberIds = Array.from(new Set([user.id, ...memberIds]))

  const admin = createAdminClient()

  // ── Fetch taste codes for all members in parallel ────────────────────────────
  const tasteCodeMap = new Map<string, TasteCode | null>()
  await Promise.all(
    allMemberIds.map(async id => {
      const tc = await fetchTasteCode(id, admin)
      tasteCodeMap.set(id, tc)
    })
  )

  // Members that actually contribute to scoring
  const scoringMembers = allMemberIds.filter(id => tasteCodeMap.get(id) != null)
  const hasTasteCode = scoringMembers.length > 0

  // ── Fetch watched IDs for current user (hide from results) ───────────────────
  const { data: watchedRows } = await supabase
    .from('library_entries')
    .select('film_id')
    .eq('user_id', user.id)
    .in('list', ['watched', 'now_playing'])

  const watchedIds = new Set((watchedRows ?? []).map((r: any) => r.film_id))
  const excludeSet = new Set([...watchedIds, ...exclude])

  // ── Fetch all enriched films ─────────────────────────────────────────────────
  let q = supabase
    .from('films')
    .select('id, title, year, poster_path, director, kind, tmdb_genres, tmdb_vote_average, tmdb_vote_count, imdb_rating, rt_score, metacritic, ai_brief')
    .not('ai_brief->dimensions_v2', 'is', null)
    .limit(5000)

  if (filters.kind === 'movie' || filters.kind === 'tv') {
    q = q.eq('kind', filters.kind)
  }
  if (filters.newReleases) {
    const since = new Date().getFullYear() - 1
    q = q.gte('year', since)
  }

  const { data: rawFilms, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // ── Score all films ──────────────────────────────────────────────────────────
  const scored = (rawFilms as unknown as FilmRow[])
    .filter(f => !excludeSet.has(f.id))
    .flatMap(f => {
      const dims = f.ai_brief?.dimensions_v2
      if (!dims) return []

      // AI genre filter
      const aiGenres: string[] = (f.ai_brief as any)?.genres ?? []
      if (filters.aiGenre && !aiGenres.some((g: string) =>
        g.toLowerCase().includes((filters.aiGenre as string).toLowerCase())
      )) {
        return []
      }

      const compositeQuality = computeCompositeQuality({
        tmdbVoteAverage: f.tmdb_vote_average,
        tmdbVoteCount: f.tmdb_vote_count,
        imdbRating: f.imdb_rating,
        rtScore: f.rt_score,
        metacritic: f.metacritic,
      })

      if (hasTasteCode) {
        const memberScores: Record<string, number> = {}
        for (const memberId of scoringMembers) {
          const tc = tasteCodeMap.get(memberId)!
          const raw = computeMatchScore(tc, dims)
          memberScores[memberId] = Math.round(applyQualityMultiplier(raw, compositeQuality))
        }

        const scores = Object.values(memberScores)
        const mean = scores.reduce((a, b) => a + b, 0) / scores.length
        const sd   = stdev(scores)
        const roomScore = Math.round(Math.max(0, mean - 0.5 * sd))

        return [{
          id: f.id, title: f.title, year: f.year,
          poster_path: f.poster_path, director: f.director, kind: f.kind,
          roomScore, memberScores,
        }]
      } else {
        // No taste codes — use quality score as room score
        const roomScore = Math.round((compositeQuality ?? 0) * 100)
        return [{
          id: f.id, title: f.title, year: f.year,
          poster_path: f.poster_path, director: f.director, kind: f.kind,
          roomScore, memberScores: {},
        }]
      }
    })
    .sort((a, b) => b.roomScore - a.roomScore)

  const page = scored.slice(offset, offset + limit)

  return NextResponse.json({
    films: page,
    totalScored: scored.length,
    hasTasteCode,
    memberIds: allMemberIds,
  })
}
