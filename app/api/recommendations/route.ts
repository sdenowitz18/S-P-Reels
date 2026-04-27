import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getOrCacheFilm } from '@/lib/tmdb'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { toUserId, filmId, note } = await request.json()
  if (!toUserId || !filmId) return NextResponse.json({ error: 'toUserId and filmId required' }, { status: 400 })

  // Ensure film exists in films table before creating the FK reference
  await getOrCacheFilm(supabase, filmId)

  const admin = createAdminClient()

  const { data: rec, error } = await admin.from('recommendations').insert({
    from_user_id: user.id,
    to_user_id: toUserId,
    film_id: filmId,
    note: note?.trim() || null,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Create notification for recipient
  await admin.from('notifications').insert({
    user_id: toUserId,
    type: 'rec_received',
    rec_id: rec.id,
    from_user_id: user.id,
  })

  return NextResponse.json({ ok: true, rec })
}
