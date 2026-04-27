import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// React to a rec: add the film to watched / now_playing / watchlist
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: recId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { action } = await request.json() // 'watched' | 'watching' | 'save'
  if (!['watched', 'watching', 'save'].includes(action)) {
    return NextResponse.json({ error: 'invalid action' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: rec } = await admin.from('recommendations').select('film_id').eq('id', recId).single()
  if (!rec) return NextResponse.json({ error: 'rec not found' }, { status: 404 })

  const listMap: Record<string, string> = { watched: 'watched', watching: 'now_playing', save: 'watchlist' }
  const list = listMap[action]

  await admin.from('library_entries').upsert(
    { user_id: user.id, film_id: rec.film_id, list, audience: ['me'] },
    { onConflict: 'user_id,film_id,list' }
  )

  return NextResponse.json({ ok: true, list })
}
