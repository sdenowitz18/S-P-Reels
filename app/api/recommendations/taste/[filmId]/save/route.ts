import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getOrCacheFilm } from '@/lib/tmdb'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ filmId: string }> }
) {
  const { filmId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { list = 'watchlist', stars } = await req.json().catch(() => ({})) as { list?: string; stars?: number }

  await getOrCacheFilm(supabase, filmId)

  const entry: Record<string, unknown> = {
    user_id: user.id,
    film_id: filmId,
    list: list === 'watched' ? 'watched' : 'watchlist',
    audience: ['me'],
  }

  if (list === 'watched') {
    entry.my_stars = stars ?? null
    entry.finished_at = new Date().toISOString()
  }

  const { error } = await supabase
    .from('library_entries')
    .upsert(entry, { onConflict: 'user_id,film_id,list' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
