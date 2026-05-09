import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getOrCacheFilm } from '@/lib/tmdb'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const audience = request.nextUrl.searchParams.get('audience') ?? 'me'

  let query = supabase
    .from('library_entries')
    .select('*, film:films(*)')
    .eq('user_id', user.id)
    .order('added_at', { ascending: false })

  if (audience !== 'all') {
    query = query.contains('audience', [audience])
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const watched = data.filter(e => e.list === 'watched')
  const nowPlaying = data.filter(e => e.list === 'now_playing')
  const watchlist = data.filter(e => e.list === 'watchlist')

  return NextResponse.json({ watched, nowPlaying, watchlist })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = await request.json()
  const {
    filmId, list, audience = ['me'], why, myStars, myLine, commentPublic, moods,
    // Phase 2 log signal fields
    rewatch, rewatchScore,
    fitAnswer, fitDimension, fitPole,
    matchScoreAtLog, predictedStars, deltaStars, deltaZ,
    userMuAtLog, userSigmaAtLog,
    tasteCodeBefore, tasteCodeAfter,
    // Dismiss
    dismissReason,
  } = body

  if (!filmId || !list) return NextResponse.json({ error: 'filmId and list required' }, { status: 400 })

  // ensure film is cached
  await getOrCacheFilm(supabase, filmId)

  const entry = {
    user_id: user.id,
    film_id: filmId,
    list,
    audience,
    why: why ?? null,
    my_stars: myStars ?? null,
    my_line: myLine ?? null,
    comment_public: commentPublic === true,
    moods: moods ?? null,
    started_at: list === 'now_playing' ? new Date().toISOString() : null,
    // Phase 2 log signal fields
    rewatch: rewatch ?? null,
    rewatch_score: rewatchScore ?? null,
    fit_answer: fitAnswer ?? null,
    fit_dimension: fitDimension ?? null,
    fit_pole: fitPole ?? null,
    match_score_at_log: matchScoreAtLog ?? null,
    predicted_stars: predictedStars ?? null,
    delta_stars: deltaStars ?? null,
    delta_z: deltaZ ?? null,
    user_mu_at_log: userMuAtLog ?? null,
    user_sigma_at_log: userSigmaAtLog ?? null,
    taste_code_before: tasteCodeBefore ?? null,
    taste_code_after: tasteCodeAfter ?? null,
    dismiss_reason: list === 'dismissed' ? (dismissReason ?? why ?? null) : null,
  }

  const { data, error } = await supabase
    .from('library_entries')
    .upsert(entry, { onConflict: 'user_id,film_id,list' })
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
