/**
 * GET /api/films
 *
 * Returns all films in the DB that have dimensions_v2, with the user's
 * match score computed for each. Also returns the user's library film_ids
 * so the client can show watched/watchlist status.
 *
 * Query params:
 *   page   — 0-indexed page number (default 0)
 *   limit  — films per page (default 60, max 200)
 *   q      — title search
 *   genre  — filter by TMDB genre string
 *   sort   — 'match' | 'year' | 'title' (default 'match')
 *
 * When sort=match and tasteCode is available:
 *   Fetches ALL qualifying films, computes match scores for all, sorts
 *   server-side, then returns the requested page slice. This ensures
 *   the global ordering is correct across pagination.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { computeTasteCode, RatedFilmEntry, TasteCode, ALL_POLES } from '@/lib/taste-code'
import { computeMatchScore, applyQualityMultiplier, computeCompositeQuality, MATCH_SCORE_MIN_FILMS, computeRatingStats } from '@/lib/taste/match-score'
import { FilmDimensionsV2 } from '@/lib/prompts/film-brief'
import { posterUrl } from '@/lib/types'

type FilmRow = {
  id: string; title: string; year: number | null; poster_path: string | null
  director: string | null; tmdb_genres: string[] | null; synopsis: string | null
  kind: 'movie' | 'tv' | null
  tmdb_id: number | null
  tmdb_vote_average: number | null; tmdb_vote_count: number | null
  imdb_rating: number | null; rt_score: number | null; metacritic: number | null
  ai_brief: { dimensions_v2?: FilmDimensionsV2; genres?: string[] } | null
}

export interface DimBreakdown {
  dimKey:         string
  leftLetter:     string   // absolute: letter for score=0 (left) pole
  leftLabel:      string
  rightLetter:    string   // absolute: letter for score=100 (right) pole
  rightLabel:     string
  filmScore:      number   // 0–100 where film sits on this dim
  filmPoleScore:  number   // user's avg rating (0–100) for the pole this film leans toward
  leftPoleScore:  number   // user's avg rating (0–100) for the left pole
  rightPoleScore: number   // user's avg rating (0–100) for the right pole
  userBias:       number   // rightPoleScore − leftPoleScore (positive = user prefers right)
  contribution:   number   // filmPoleScore × signalStrength — used in match score
}

function buildDimBreakdown(tasteCode: TasteCode, dims: Partial<FilmDimensionsV2>): DimBreakdown[] {
  // Show the film's 4 most strongly-characterized dimensions (furthest from neutral 50).
  const filmDims = (Object.entries(dims) as [keyof FilmDimensionsV2, number][])
    .map(([dimKey, filmScore]) => ({ dimKey, filmScore, signal: Math.abs(filmScore - 50) / 50 }))
    .sort((a, b) => b.signal - a.signal)
    .slice(0, 4)

  // User preference lookup across all 12 dimensions
  const entryByDimKey = new Map(tasteCode.allEntries.map(e => [e.dimKey, e]))

  return filmDims.map(({ dimKey, filmScore, signal }) => {
    const leftPole  = ALL_POLES.find(p => p.dimKey === dimKey && p.pole === 'left')!
    const rightPole = ALL_POLES.find(p => p.dimKey === dimKey && p.pole === 'right')!
    const entry = entryByDimKey.get(dimKey)

    const leftPoleScore  = entry ? (entry.pole === 'left'  ? entry.poleScore : entry.oppositeScore) : 50
    const rightPoleScore = entry ? (entry.pole === 'right' ? entry.poleScore : entry.oppositeScore) : 50
    const userBias       = rightPoleScore - leftPoleScore

    // The pole the film leans toward — this determines the badge (H/M/L)
    const filmPoleScore  = filmScore < 50 ? leftPoleScore : rightPoleScore

    // Contribution mirrors the match formula: how much does this dim move the score?
    const contribution   = filmPoleScore * signal

    return {
      dimKey,
      leftLetter:    leftPole.letter,  leftLabel:    leftPole.label,
      rightLetter:   rightPole.letter, rightLabel:   rightPole.label,
      filmScore, filmPoleScore, leftPoleScore, rightPoleScore, userBias, contribution,
    }
  })
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const sp            = req.nextUrl.searchParams
  const page          = Math.max(0, parseInt(sp.get('page')  ?? '0'))
  const limit         = Math.min(2000, Math.max(1, parseInt(sp.get('limit') ?? '60')))
  const q             = sp.get('q')?.trim() ?? ''
  const genres        = (sp.get('genres') ?? '').split(',').map(g => g.trim()).filter(Boolean)
  // genreKeywords: lowercase substrings to match against ai_brief.genres (AI-generated nuanced labels)
  const genreKeywords = (sp.get('genreKeywords') ?? '').split(',').map(k => k.trim().toLowerCase()).filter(Boolean)
  const sort          = sp.get('sort') ?? 'match'
  // mediaType: filter to 'movie', 'tv', or 'both' (default 'both')
  const mediaType     = sp.get('mediaType') ?? 'both'
  // hideWatched: exclude films the user has already watched
  const hideWatched   = sp.get('hideWatched') === 'true'
  // New releases mode: only films from the last ~18 months
  const newOnly   = sp.get('newOnly') === 'true'
  const NEW_SINCE = new Date().getFullYear() - 1  // e.g. 2025 when year is 2026

  // ── 1. Fetch user's library ─────────────────────────────────────────────────
  const { data: libraryEntries } = await supabase
    .from('library_entries')
    .select('film_id, list, my_stars, film:films(title, poster_path, ai_brief)')
    .eq('user_id', user.id)

  type LibEntry = {
    film_id: string
    list: string
    my_stars: number | null
    film: { title: string; poster_path: string | null; ai_brief: { dimensions_v2?: FilmDimensionsV2 } | null } | null
  }
  const lib = (libraryEntries ?? []) as unknown as LibEntry[]

  // ── 2. Compute taste code ────────────────────────────────────────────────────
  const ratedWithDims = lib.filter(
    e => e.list === 'watched' && e.my_stars != null && e.film?.ai_brief?.dimensions_v2
  )
  const allStars = lib.filter(e => e.list === 'watched' && e.my_stars != null).map(e => e.my_stars as number)
  const ratingStats = computeRatingStats(allStars)

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

  // ── 2a. Build library lookup ─────────────────────────────────────────────────
  const libraryMap = new Map<string, { list: string; my_stars: number | null }>()
  for (const e of lib) libraryMap.set(e.film_id, { list: e.list, my_stars: e.my_stars })

  // ── 2b. Fetch friend recommendations ────────────────────────────────────────
  const { data: recRows } = await supabase
    .from('recommendations')
    .select('film_id, from_user:from_user_id(name)')
    .eq('to_user_id', user.id)

  const recMap = new Map<string, string[]>()
  for (const r of (recRows ?? []) as unknown as { film_id: string; from_user: { name: string } | null }[]) {
    const from = Array.isArray(r.from_user) ? r.from_user[0] : r.from_user
    const name = from?.name ?? 'a friend'
    recMap.set(r.film_id, [...(recMap.get(r.film_id) ?? []), name])
  }

  // ── 3. Fetch films ───────────────────────────────────────────────────────────
  // When sorting by match score we must fetch ALL qualifying films so we can
  // compute + sort globally, then slice for pagination.
  // For year/title sorts the DB can order + paginate directly.
  // Use global sort path for:
  //   - match sort + taste code → sort by match score
  //   - match sort + no taste code → sort by composite quality (no taste yet)
  // Year/title sorts use the DB-ordered path (no need to fetch all films)
  const useGlobalSort = sort === 'match'

  // Build set of watched film IDs for fast exclusion
  const watchedIds = hideWatched
    ? new Set(lib.filter(e => e.list === 'watched').map(e => e.film_id))
    : null

  const baseSelect = 'id, title, year, poster_path, director, tmdb_genres, synopsis, kind, tmdb_id, tmdb_vote_average, tmdb_vote_count, imdb_rating, rt_score, metacritic, ai_brief'

  let filmData: FilmRow[] = []
  let total = 0

  if (useGlobalSort) {
    // Fetch all (up to 5000) so we can sort by match score across the full set.
    // When genre filtering is requested we skip the DB-level TMDB genre filter
    // so we can apply JS-level OR logic: match by TMDB genre tags OR by
    // AI-generated subgenre keywords in ai_brief.genres (e.g. "horror comedy").
    // This union catch films that cross TMDB genre boundaries.
    const useJsGenreFilter = genres.length > 0 || genreKeywords.length > 0

    let allQuery = supabase
      .from('films')
      .select(baseSelect)
      .not('ai_brief->dimensions_v2', 'is', null)
      .limit(5000)
    if (q)       allQuery = allQuery.ilike('title', `%${q}%`)
    if (newOnly) allQuery = allQuery.gte('year', NEW_SINCE)
    // Apply TMDB genre filter in DB only when no JS genre filtering is needed
    if (!useJsGenreFilter && genres.length) allQuery = allQuery.overlaps('tmdb_genres', genres)

    const { data: allFilmsRaw, error } = await allQuery
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // JS filters: genre (TMDB OR ai_brief keywords) + mediaType + hideWatched
    const allFilms: FilmRow[] = (allFilmsRaw as FilmRow[]).filter(f => {
      // Exclude watched films
      if (watchedIds && watchedIds.has(f.id)) return false
      // Media type filter
      if (mediaType === 'movie' && f.kind !== 'movie') return false
      if (mediaType === 'tv'    && f.kind !== 'tv')    return false
      // Genre filter (TMDB genres OR ai_brief subgenre keywords — union for cross-boundary films)
      if (useJsGenreFilter) {
        const filmTmdb = f.tmdb_genres ?? []
        const filmAi   = ((f.ai_brief as { genres?: string[] } | null)?.genres ?? [])
          .map(g => g.toLowerCase())
        const matchesTmdb    = genres.length ? genres.some(g => filmTmdb.includes(g)) : false
        const matchesKeyword = genreKeywords.length ? filmAi.some(ag => genreKeywords.some(k => ag.includes(k))) : false
        if (!matchesTmdb && !matchesKeyword) return false
      }
      return true
    })

    // Compute both taste + quality-adjusted scores, sort by final matchScore
    // (sorting by raw taste score would produce mismatched display order)
    const scored = allFilms.map(f => {
      const tasteScore = tasteCode && f.ai_brief?.dimensions_v2
        ? computeMatchScore(tasteCode, f.ai_brief.dimensions_v2)
        : null
      const compositeQuality = computeCompositeQuality({
        tmdbVoteAverage: f.tmdb_vote_average, tmdbVoteCount: f.tmdb_vote_count,
        imdbRating: f.imdb_rating, rtScore: f.rt_score, metacritic: f.metacritic,
      })
      const matchScore = tasteScore != null
        ? applyQualityMultiplier(tasteScore, compositeQuality)
        : null
      return { film: f, tasteScore, compositeQuality, matchScore }
    })
    scored.sort((a, b) => {
      // Primary: match score; fallback to composite quality so users without
      // a taste code still see a quality-ranked catalog instead of year order
      const aScore = a.matchScore ?? a.compositeQuality ?? 0
      const bScore = b.matchScore ?? b.compositeQuality ?? 0
      return bScore - aScore
    })

    total = scored.length
    filmData = scored.slice(page * limit, (page + 1) * limit).map(s => s.film)

    // Build result with pre-computed scores
    const result = filmData.map((f, i) => {
      const entry         = scored[page * limit + i]
      const tasteScore    = entry?.tasteScore ?? null
      const compositeQuality = entry?.compositeQuality ?? null
      const matchScore    = entry?.matchScore ?? null
      const dimsV2        = f.ai_brief?.dimensions_v2 ?? null
      return {
        id:                f.id,
        title:             f.title,
        year:              f.year,
        poster_path:       f.poster_path ? posterUrl(f.poster_path, 'w342') : null,
        director:          f.director,
        kind:              f.kind ?? 'movie',
        genres:            f.tmdb_genres ?? [],
        aiGenres:          (f.ai_brief as { genres?: string[] } | null)?.genres ?? [],
        synopsis:          f.synopsis,
        tmdb_id:           f.tmdb_id,
        tmdb_vote_average: f.tmdb_vote_average,
        tmdb_vote_count:   f.tmdb_vote_count,
        imdb_rating:       f.imdb_rating,
        rt_score:          f.rt_score,
        metacritic:        f.metacritic,
        matchScore,
        tasteScore,
        compositeQuality,
        dimBreakdown: tasteCode && dimsV2 ? buildDimBreakdown(tasteCode, dimsV2) : [],
        libraryStatus: libraryMap.get(f.id) ?? null,
        recommendedBy: recMap.get(f.id) ?? [],
      }
    })

    return NextResponse.json({ films: result, total, page, limit, hasMatchScores: tasteCode != null, ratingStats })
  }

  // ── DB-ordered path (year / title sorts) ────────────────────────────────────
  let filmQuery = supabase
    .from('films')
    .select(baseSelect)
    .not('ai_brief->dimensions_v2', 'is', null)
    .range(page * limit, (page + 1) * limit - 1)

  if (sort === 'title') filmQuery = filmQuery.order('title', { ascending: true })
  else filmQuery = filmQuery.order('year', { ascending: false })  // 'year' default

  if (q)                          filmQuery = filmQuery.ilike('title', `%${q}%`)
  if (genres.length)              filmQuery = filmQuery.overlaps('tmdb_genres', genres)
  if (newOnly)                    filmQuery = filmQuery.gte('year', NEW_SINCE)
  if (mediaType === 'movie')      filmQuery = filmQuery.eq('kind', 'movie')
  if (mediaType === 'tv')         filmQuery = filmQuery.eq('kind', 'tv')

  const { data: filmsRaw, error } = await filmQuery
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Apply hideWatched filter in JS (watched IDs already computed above)
  const films = watchedIds
    ? (filmsRaw as FilmRow[]).filter(f => !watchedIds.has(f.id))
    : (filmsRaw as FilmRow[])

  const result = films.map(f => {
    const dimsV2    = f.ai_brief?.dimensions_v2 ?? null
    const tasteScore = tasteCode && dimsV2 ? computeMatchScore(tasteCode, dimsV2) : null
    const compositeQuality = computeCompositeQuality({
      tmdbVoteAverage: f.tmdb_vote_average, tmdbVoteCount: f.tmdb_vote_count,
      imdbRating: f.imdb_rating, rtScore: f.rt_score, metacritic: f.metacritic,
    })
    const matchScore = tasteScore != null
      ? applyQualityMultiplier(tasteScore, compositeQuality)
      : null
    return {
      id:                f.id,
      title:             f.title,
      year:              f.year,
      poster_path:       f.poster_path ? posterUrl(f.poster_path, 'w342') : null,
      director:          f.director,
      kind:              f.kind ?? 'movie',
      genres:            f.tmdb_genres ?? [],
      aiGenres:          (f.ai_brief as { genres?: string[] } | null)?.genres ?? [],
      synopsis:          f.synopsis,
      tmdb_id:           f.tmdb_id,
      tmdb_vote_average: f.tmdb_vote_average,
      tmdb_vote_count:   f.tmdb_vote_count,
      imdb_rating:       f.imdb_rating,
      rt_score:          f.rt_score,
      metacritic:        f.metacritic,
      matchScore,
      tasteScore,
      compositeQuality,
      dimBreakdown: tasteCode && dimsV2 ? buildDimBreakdown(tasteCode, dimsV2) : [],
      libraryStatus: libraryMap.get(f.id) ?? null,
      recommendedBy: recMap.get(f.id) ?? [],
    }
  })

  // Count for pagination
  let countQuery = supabase
    .from('films')
    .select('id', { count: 'exact', head: true })
    .not('ai_brief->dimensions_v2', 'is', null)
  if (q)                     countQuery = countQuery.ilike('title', `%${q}%`)
  if (genres.length)         countQuery = countQuery.overlaps('tmdb_genres', genres)
  if (newOnly)               countQuery = countQuery.gte('year', NEW_SINCE)
  if (mediaType === 'movie') countQuery = countQuery.eq('kind', 'movie')
  if (mediaType === 'tv')    countQuery = countQuery.eq('kind', 'tv')
  const { count } = await countQuery

  return NextResponse.json({
    films: result,
    total: count ?? 0,
    page,
    limit,
    hasMatchScores: tasteCode != null,
    ratingStats,
  })
}
