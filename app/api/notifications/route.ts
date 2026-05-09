import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  const { data: notifications } = await admin
    .from('notifications')
    .select('id, type, payload, read, created_at, from_user:from_user_id(id, name), rec:rec_id(id, film_id, film:film_id(title))')
    .eq('user_id', user.id)
    .eq('read', false)
    .order('created_at', { ascending: false })
    .limit(20)

  return NextResponse.json({ notifications: notifications ?? [], unread: notifications?.length ?? 0 })
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  let body: { ids?: string[] } = {}
  try { body = await req.json() } catch { /* mark all if no body */ }

  const query = admin.from('notifications').update({ read: true }).eq('user_id', user.id)
  if (body.ids?.length) {
    await query.in('id', body.ids)
  } else {
    await query.eq('read', false)
  }

  return NextResponse.json({ ok: true })
}
