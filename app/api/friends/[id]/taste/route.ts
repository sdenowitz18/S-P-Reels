import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { TasteDimensions } from '@/lib/prompts/taste-profile'
import { FilmBrief } from '@/lib/prompts/film-brief'
import { posterUrl } from '@/lib/types'

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
  const dimTotals: Record<string, number> = Object.fromEntries(DIMS.map(d => [d, 0]))
  const dimWeightSum: Record<string, number> = Object.fromEntries(DIMS.map(d => [d, 0]))

  for (const entry of rated) {
    const brief = entry.film.ai_brief as FilmBrief
    const w = (entry.my_stars as number) / 5
    for (const dim of DIMS) {
      dimTotals[dim] += (brief.dimensions[dim] ?? 0) * w
      dimWeightSum[dim] += w
    }
  }

  const dimensions: TasteDimensions = {
    pace:         dimWeightSum.pace         > 0 ? dimTotals.pace         / dimWeightSum.pace         : 0,
    story_engine: dimWeightSum.story_engine > 0 ? dimTotals.story_engine / dimWeightSum.story_engine : 0,
    tone:         dimWeightSum.tone         > 0 ? dimTotals.tone         / dimWeightSum.tone         : 0,
    warmth:       dimWeightSum.warmth       > 0 ? dimTotals.warmth       / dimWeightSum.warmth       : 0,
    complexity:   dimWeightSum.complexity   > 0 ? dimTotals.complexity   / dimWeightSum.complexity   : 0,
    style:        dimWeightSum.style        > 0 ? dimTotals.style        / dimWeightSum.style        : 0,
  }

  // ── Genres — weighted score + avg rating ─────────────────────────────────────
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
    .map(([label, d]) => ({
      label,
      score: Math.round(d.score * 10) / 10,
      count: d.ratingCount,
      avgRating: d.ratingCount > 0 ? Math.round((d.ratingTotal / d.ratingCount) * 10) / 10 : null,
    }))
    .sort((a, b) => {
      const rDiff = (b.avgRating ?? 0) - (a.avgRating ?? 0)
      return Math.abs(rDiff) > 0.001 ? rDiff : b.count - a.count
    })
    .slice(0, 12)

  // ── Film signature ────────────────────────────────────────────────────────────
  const signature = rated
    .filter(e => (e.my_stars as number) >= 3.5)
    .map(e => {
      const brief = e.film.ai_brief as FilmBrief
      const signal = DIMS.reduce((sum, d) => sum + Math.abs(brief.dimensions[d] ?? 0), 0)
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

  return NextResponse.json({
    friendName,
    dimensions,
    genres,
    signature,
    topRated,
    prose: null,
    directors,
    actors,
    decades,
    libraryFilms,
    filmCount: allWatched.length,
    ratedCount: rated.length,
  })
}
