import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { TasteDimensions, computeTasteVector } from '@/lib/prompts/taste-profile'
import { FilmBrief, FilmDimensionsV2 } from '@/lib/prompts/film-brief'
import { posterUrl } from '@/lib/types'
import { computeTasteCode, RatedFilmEntry } from '@/lib/taste-code'

const DIMS = ['pace', 'story_engine', 'tone', 'warmth', 'complexity', 'style'] as const

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: friendId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  // ── Verify friendship (regular client, RLS-aware) ────────────────────────────
  const { data: friendship } = await supabase
    .from('friend_requests')
    .select('id')
    .eq('status', 'accepted')
    .or(
      `and(from_user_id.eq.${user.id},to_user_id.eq.${friendId}),and(from_user_id.eq.${friendId},to_user_id.eq.${user.id})`
    )
    .limit(1)
    .maybeSingle()

  if (!friendship) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  // ── Use admin client for friend data (bypasses RLS) ──────────────────────────
  const admin = createAdminClient()

  // ── Fetch friend's name ──────────────────────────────────────────────────────
  let friendName: string | null = null
  const { data: friendUser } = await admin
    .from('users')
    .select('name')
    .eq('id', friendId)
    .single()

  if (friendUser?.name) {
    friendName = friendUser.name as string
  } else {
    // Fallback: auth admin lookup
    const { data: authUser } = await admin.auth.admin.getUserById(friendId)
    if (authUser?.user) {
      friendName =
        (authUser.user.user_metadata?.name as string | undefined) ??
        authUser.user.email ??
        null
    }
  }

  // ── Fetch friend's watched entries (admin bypasses RLS) ──────────────────────
  const { data: entries, error } = await admin
    .from('library_entries')
    .select('*, film:films(*)')
    .eq('user_id', friendId)
    .eq('list', 'watched')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const allWatched = entries ?? []
  const rated = allWatched.filter(e => e.my_stars != null && e.film?.ai_brief?.dimensions)

  // ── Taste dimensions ─────────────────────────────────────────────────────────
  const toEntries = (rows: typeof rated) => rows.map(e => ({
    my_stars: e.my_stars as number | null,
    film: { ai_brief: e.film?.ai_brief ?? null },
  }))

  const dimensions: TasteDimensions = computeTasteVector(toEntries(rated)) ?? {
    pace: 0, story_engine: 0, tone: 0, warmth: 0, complexity: 0, style: 0,
  }

  // ── Overall avg rating (used as baseline for genre deviation) ──────────────
  const ratedEntries = allWatched.filter(e => e.my_stars != null)
  const overallAvg = ratedEntries.length > 0
    ? ratedEntries.reduce((s, e) => s + (e.my_stars as number), 0) / ratedEntries.length
    : 3

  // ── Nuanced genres (ai_brief) — weighted score + avg rating ─────────────────
  const genreData: Record<string, { score: number; ratingTotal: number; ratingCount: number }> = {}

  for (const entry of allWatched) {
    if (!entry.film?.ai_brief?.genres?.length) continue
    const genres: string[] = (entry.film.ai_brief as FilmBrief).genres ?? []
    const stars = entry.my_stars as number | null
    for (const g of genres) {
      genreData[g] = genreData[g] ?? { score: 0, ratingTotal: 0, ratingCount: 0 }
      if (stars != null) {
        genreData[g].score += stars
        genreData[g].ratingTotal += stars
        genreData[g].ratingCount++
      }
    }
  }

  const genres = Object.entries(genreData)
    .filter(([, d]) => d.ratingCount >= 3)
    .map(([label, d]) => {
      const avgRating = Math.round((d.ratingTotal / d.ratingCount) * 10) / 10
      return {
        label,
        score: Math.round(d.score * 10) / 10,
        count: d.ratingCount,
        avgRating,
        weightedScore: avgRating * Math.log(d.ratingCount + 1),
      }
    })
    .sort((a, b) => b.weightedScore - a.weightedScore)
    .slice(0, 12)

  // ── Simple genres (tmdb_genres, fallback to ai_brief) — for quadrant chart ──
  const simpleGenreData: Record<string, { ratingTotal: number; ratingCount: number }> = {}

  for (const entry of allWatched) {
    const tmdbGenres: string[] = (entry.film?.tmdb_genres as string[] | null) ?? []
    const fallbackGenres: string[] = tmdbGenres.length > 0
      ? tmdbGenres
      : ((entry.film?.ai_brief as { genres?: string[] } | null)?.genres ?? [])
    const stars = entry.my_stars as number | null
    for (const g of fallbackGenres) {
      simpleGenreData[g] = simpleGenreData[g] ?? { ratingTotal: 0, ratingCount: 0 }
      if (stars != null) {
        simpleGenreData[g].ratingTotal += stars
        simpleGenreData[g].ratingCount++
      }
    }
  }

  const simpleGenres = Object.entries(simpleGenreData)
    .filter(([, d]) => d.ratingCount >= 2)
    .map(([label, d]) => {
      const avgRating = Math.round((d.ratingTotal / d.ratingCount) * 100) / 100
      return {
        label,
        avgRating,
        count: d.ratingCount,
        weightedScore: avgRating * Math.log(d.ratingCount + 1),
      }
    })
    .sort((a, b) => b.weightedScore - a.weightedScore)

  // ── Film signature ────────────────────────────────────────────────────────────
  const signature = rated
    .filter(e => (e.my_stars as number) >= 3.5)
    .map(e => {
      const brief = e.film.ai_brief as FilmBrief
      const signal = DIMS.reduce((sum, d) => sum + Math.abs(brief.dimensions?.[d] ?? 0), 0)
      return { entry: e, signal }
    })
    .sort((a, b) => (b.signal * b.entry.my_stars) - (a.signal * a.entry.my_stars))
    .slice(0, 8)
    .map(({ entry: e }) => ({
      film_id: e.film_id,
      title: e.film.title,
      poster_path: e.film.poster_path ? posterUrl(e.film.poster_path, 'w342') : null,
      stars: e.my_stars as number,
    }))

  // ── Top rated ─────────────────────────────────────────────────────────────────
  const topRated = [...allWatched]
    .filter(e => e.my_stars != null)
    .sort((a, b) => (b.my_stars as number) - (a.my_stars as number))
    .slice(0, 6)
    .map(e => ({
      film_id: e.film_id,
      title: e.film?.title ?? '',
      poster_path: e.film?.poster_path ? posterUrl(e.film.poster_path, 'w342') : null,
      year: e.film?.year ?? null,
      director: e.film?.director ?? null,
      stars: e.my_stars as number,
    }))

  // ── Directors ─────────────────────────────────────────────────────────────────
  const dirMap: Record<string, { count: number; ratingTotal: number; ratingCount: number }> = {}
  for (const entry of allWatched) {
    const d = entry.film?.director
    if (!d) continue
    dirMap[d] = dirMap[d] ?? { count: 0, ratingTotal: 0, ratingCount: 0 }
    dirMap[d].count++
    if (entry.my_stars != null) {
      dirMap[d].ratingTotal += entry.my_stars as number
      dirMap[d].ratingCount++
    }
  }
  const directors = Object.entries(dirMap)
    .filter(([, v]) => v.count >= 3)
    .map(([name, v]) => ({
      name,
      count: v.count,
      avgRating: v.ratingCount > 0 ? Math.round((v.ratingTotal / v.ratingCount) * 10) / 10 : null,
    }))
    .sort((a, b) => {
      const rDiff = (b.avgRating ?? 0) - (a.avgRating ?? 0)
      return Math.abs(rDiff) > 0.001 ? rDiff : b.count - a.count
    })
    .slice(0, 20)

  // ── Actors ────────────────────────────────────────────────────────────────────
  const actorMap: Record<string, { count: number; ratingTotal: number; ratingCount: number }> = {}
  for (const entry of allWatched) {
    for (const cast of (entry.film?.cast_json ?? []) as { name: string }[]) {
      actorMap[cast.name] = actorMap[cast.name] ?? { count: 0, ratingTotal: 0, ratingCount: 0 }
      actorMap[cast.name].count++
      if (entry.my_stars != null) {
        actorMap[cast.name].ratingTotal += entry.my_stars as number
        actorMap[cast.name].ratingCount++
      }
    }
  }
  const actors = Object.entries(actorMap)
    .filter(([, v]) => v.count >= 3)
    .map(([name, v]) => ({
      name,
      count: v.count,
      avgRating: v.ratingCount > 0 ? Math.round((v.ratingTotal / v.ratingCount) * 10) / 10 : null,
    }))
    .sort((a, b) => {
      const rDiff = (b.avgRating ?? 0) - (a.avgRating ?? 0)
      return Math.abs(rDiff) > 0.001 ? rDiff : b.count - a.count
    })
    .slice(0, 30)

  // ── Decades ───────────────────────────────────────────────────────────────────
  const decadeMap: Record<number, { count: number; ratingTotal: number; ratingCount: number }> = {}
  for (const entry of allWatched) {
    if (!entry.film?.year) continue
    const decade = Math.floor(entry.film.year / 10) * 10
    decadeMap[decade] = decadeMap[decade] ?? { count: 0, ratingTotal: 0, ratingCount: 0 }
    decadeMap[decade].count++
    if (entry.my_stars != null) {
      decadeMap[decade].ratingTotal += entry.my_stars as number
      decadeMap[decade].ratingCount++
    }
  }
  const decades = Object.entries(decadeMap)
    .filter(([, v]) => v.count >= 3)
    .map(([decade, v]) => ({
      decade: parseInt(decade),
      count: v.count,
      avgRating: v.ratingCount > 0 ? Math.round((v.ratingTotal / v.ratingCount) * 10) / 10 : null,
    }))
    .sort((a, b) => {
      const rDiff = (b.avgRating ?? 0) - (a.avgRating ?? 0)
      return Math.abs(rDiff) > 0.001 ? rDiff : b.count - a.count
    })

  // ── Library films — no entry_id exposed ──────────────────────────────────────
  const libraryFilms = allWatched.map(e => ({
    film_id: e.film_id as string,
    title: (e.film?.title ?? '') as string,
    year: (e.film?.year ?? null) as number | null,
    poster_path: e.film?.poster_path ? posterUrl(e.film.poster_path, 'w185') : null,
    director: (e.film?.director ?? null) as string | null,
    genres: ((e.film?.ai_brief as FilmBrief | null)?.genres ?? []) as string[],
    cast: ((e.film?.cast_json ?? []) as { name: string }[]).map(c => c.name),
    my_stars: (e.my_stars ?? null) as number | null,
  }))

  // ── Taste code (Approach C) ──────────────────────────────────────────────────
  const tasteCodeFilms: RatedFilmEntry[] = allWatched
    .filter(e => e.my_stars != null && (e.film?.ai_brief as { dimensions_v2?: unknown } | null)?.dimensions_v2)
    .map(e => ({
      film_id:      e.film_id as string,
      title:        (e.film?.title ?? '') as string,
      poster_path:  e.film?.poster_path ? posterUrl(e.film.poster_path, 'w185') : null,
      stars:        e.my_stars as number,
      dimensions_v2: (e.film.ai_brief as { dimensions_v2: FilmDimensionsV2 }).dimensions_v2,
    }))
  const tasteCode = computeTasteCode(tasteCodeFilms)

  return NextResponse.json({
    friendName,
    dimensions,
    genres,
    simpleGenres,
    overallAvg,
    signature,
    topRated,
    prose: null,
    directors,
    actors,
    decades,
    libraryFilms,
    filmCount: allWatched.length,
    ratedCount: rated.length,
    tasteCode,
  })
}
