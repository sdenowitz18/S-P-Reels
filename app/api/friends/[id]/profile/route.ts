import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: friendId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  const { data: friend } = await admin
    .from('users')
    .select('id, name, email, created_at')
    .eq('id', friendId)
    .single()

  if (!friend) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const { data: entries } = await admin
    .from('library_entries')
    .select('film_id, list, my_stars, my_line, moods, added_at')
    .eq('user_id', friendId)
    .order('added_at', { ascending: false })

  const filmIds = [...new Set((entries ?? []).map(e => e.film_id))]
  const { data: films } = filmIds.length
    ? await admin.from('films').select('id, title, year, poster_path, director').in('id', filmIds)
    : { data: [] }

  const filmMap = new Map((films ?? []).map(f => [f.id, f]))
  const withFilm = (list: string) =>
    (entries ?? []).filter(e => e.list === list).map(e => ({ ...e, film: filmMap.get(e.film_id) ?? null }))

  const { data: interviews } = await admin
    .from('interviews')
    .select('taste_tags')
    .eq('user_id', friendId)

  const tagCounts = new Map<string, number>()
  for (const i of interviews ?? []) {
    for (const t of i.taste_tags ?? []) tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1)
  }
  const tasteTags = [...tagCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([t]) => t)

  return NextResponse.json({
    friend,
    watched: withFilm('watched'),
    watchlist: withFilm('watchlist'),
    nowPlaying: withFilm('now_playing'),
    tasteTags,
  })
}
