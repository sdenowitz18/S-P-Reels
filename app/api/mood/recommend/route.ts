/**
 * POST /api/mood/recommend
 *
 * Mood Room recommendation engine — all enriched films in the catalog,
 * scored by Consensus Harmony Score for everyone in the room.
 *
 * Social proof: if any of the CURRENT USER's direct friends have watched
 * a film, that is surfaced as seenBy on the result. Friends of friends
 * are not included.
 *
 * filters.haventSeen (default true): when true, films the current user
 * has already watched are excluded from results.
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

export type SeenByEntry = {
  id: string
  name: string
  stars: number | null
}

function displayScore(raw: number): number {
  return Math.min(99, Math.round(2 * raw - (raw * raw) / 100))
}

function stdev(values: number[]): number {
  if (values.length < 2) return 0
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  const variance = values.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / values.length
  return Math.sqrt(variance)
}

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
  try {
    return await handler(req)
  } catch (e) {
    console.error('[mood/recommend] unhandled error', e)
    return NextResponse.json({ error: 'internal error', films: [] }, { status: 500 })
  }
}

async function handler(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = await req.json()
  const memberIds: string[]  = body.memberIds ?? []
  const filters              = body.filters ?? {}
  const offset: number       = body.offset  ?? 0
  const limit: number        = body.limit   ?? 5
  const exclude: string[]    = body.exclude ?? []
  const haventSeen: boolean  = filters.haventSeen !== false

  const allMemberIds = Array.from(new Set([user.id, ...memberIds]))
  const admin = createAdminClient()

  // ── Taste codes for all room members ────────────────────────────────────────
  const tasteCodeMap = new Map<string, TasteCode | null>()
  await Promise.all(
    allMemberIds.map(async id => {
      tasteCodeMap.set(id, await fetchTasteCode(id, admin))
    })
  )
  const scoringMembers = allMemberIds.filter(id => tasteCodeMap.get(id) != null)
  const hasTasteCode   = scoringMembers.length > 0

  // ── Room members' library (watched / watchlist / now_playing) ────────────────
  const [myWatchedRows, friendLibRows, myWatchlistRows] = await Promise.all([
    supabase
      .from('library_entries')
      .select('film_id')
      .eq('user_id', user.id)
      .in('list', ['watched', 'now_playing'])
      .then(({ data }) => data ?? []),
    memberIds.length > 0
      ? admin
          .from('library_entries')
          .select('film_id, user_id, list')
          .in('user_id', memberIds)
          .in('list', ['watched', 'watchlist', 'now_playing'])
          .then(({ data }) => data ?? [])
      : Promise.resolve([]),
    supabase
      .from('library_entries')
      .select('film_id')
      .eq('user_id', user.id)
      .eq('list', 'watchlist')
      .then(({ data }) => data ?? []),
  ])

  // Films seen by room friends — always excluded
  const friendWatchedIds = new Set(
    (friendLibRows as any[])
      .filter(r => ['watched', 'now_playing'].includes(r.list))
      .map((r: any) => r.film_id)
  )

  // Current user's watched films — excluded when haventSeen is active
  const myWatchedIds = new Set(myWatchedRows.map((r: any) => r.film_id))

  // Watchlist ★ badge for room members
  const watchlistByFilm = new Map<string, string[]>()
  for (const r of friendLibRows as any[]) {
    if (r.list === 'watchlist') {
      const ex = watchlistByFilm.get(r.film_id) ?? []
      watchlistByFilm.set(r.film_id, [...ex, r.user_id])
    }
  }
  for (const r of myWatchlistRows as any[]) {
    const ex = watchlistByFilm.get(r.film_id) ?? []
    watchlistByFilm.set(r.film_id, [...ex, user.id])
  }

  const excludeSet = new Set([
    ...friendWatchedIds,
    ...(haventSeen ? myWatchedIds : []),
    ...exclude,
  ])

  // ── Current user's direct friends (for seenBy social proof only) ─────────────
  const [{ data: sentFriends }, { data: receivedFriends }] = await Promise.all([
    admin.from('friend_requests')
      .select('friend:to_user_id(id, name)')
      .eq('from_user_id', user.id)
      .eq('status', 'accepted'),
    admin.from('friend_requests')
      .select('friend:from_user_id(id, name)')
      .eq('to_user_id', user.id)
      .eq('status', 'accepted'),
  ])

  const myFriends: { id: string; name: string }[] = [
    ...(sentFriends    ?? []).map((r: any) => r.friend),
    ...(receivedFriends ?? []).map((r: any) => r.friend),
  ].filter((f): f is { id: string; name: string } => !!f?.id)

  const friendNameMap = new Map(myFriends.map(f => [f.id, f.name]))

  // Which of my friends have watched each film?
  const friendFilmMap = new Map<string, SeenByEntry[]>()
  if (myFriends.length > 0) {
    const { data: friendWatched } = await admin
      .from('library_entries')
      .select('film_id, my_stars, user_id')
      .in('user_id', myFriends.map(f => f.id))
      .eq('list', 'watched')

    for (const e of (friendWatched ?? []) as any[]) {
      const entry: SeenByEntry = {
        id:    e.user_id,
        name:  friendNameMap.get(e.user_id) ?? 'Friend',
        stars: e.my_stars ?? null,
      }
      const existing = friendFilmMap.get(e.film_id) ?? []
      friendFilmMap.set(e.film_id, [...existing, entry])
    }
  }

  // ── Film IDs that at least one user has actually watched ─────────────────────
  // This is the pool: only films someone in the system logged, not TMDB ghosts.
  const { data: systemWatchedRows } = await admin
    .from('library_entries')
    .select('film_id')
    .eq('list', 'watched')

  const systemWatchedFilmIds = new Set((systemWatchedRows ?? []).map((r: any) => r.film_id as string))

  // ── Fetch enriched films (full catalog) ──────────────────────────────────────
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

  // ── Score ────────────────────────────────────────────────────────────────────
  const scored = (rawFilms as unknown as FilmRow[])
    .filter(f => !excludeSet.has(f.id) && systemWatchedFilmIds.has(f.id))
    .flatMap(f => {
      const dims = f.ai_brief?.dimensions_v2
      if (!dims) return []

      const aiGenres: string[] = (f.ai_brief as any)?.genres ?? []
      if (filters.aiGenre && !aiGenres.some((g: string) =>
        g.toLowerCase().includes((filters.aiGenre as string).toLowerCase())
      )) return []

      const compositeQuality = computeCompositeQuality({
        tmdbVoteAverage: f.tmdb_vote_average,
        tmdbVoteCount:   f.tmdb_vote_count,
        imdbRating:      f.imdb_rating,
        rtScore:         f.rt_score,
        metacritic:      f.metacritic,
      })

      const seenBy = friendFilmMap.get(f.id) ?? []

      if (hasTasteCode) {
        const memberScores: Record<string, number> = {}
        for (const memberId of scoringMembers) {
          const tc  = tasteCodeMap.get(memberId)!
          const raw = computeMatchScore(tc, dims)
          memberScores[memberId] = displayScore(applyQualityMultiplier(raw, compositeQuality))
        }

        const scores    = Object.values(memberScores)
        const mean      = scores.reduce((a, b) => a + b, 0) / scores.length
        const sd        = stdev(scores)
        const roomScore = Math.round(Math.max(0, mean - 0.5 * sd))

        return [{
          id: f.id, title: f.title, year: f.year,
          poster_path: f.poster_path, director: f.director, kind: f.kind,
          roomScore, memberScores,
          onWatchlist: watchlistByFilm.get(f.id) ?? [],
          seenBy,
        }]
      } else {
        const roomScore = displayScore(Math.round((compositeQuality ?? 0) * 100))
        return [{
          id: f.id, title: f.title, year: f.year,
          poster_path: f.poster_path, director: f.director, kind: f.kind,
          roomScore, memberScores: {},
          onWatchlist: watchlistByFilm.get(f.id) ?? [],
          seenBy,
        }]
      }
    })
    .sort((a, b) => b.roomScore - a.roomScore)

  return NextResponse.json({
    films:       scored.slice(offset, offset + limit),
    totalScored: scored.length,
    hasTasteCode,
    memberIds:   allMemberIds,
  })
}
