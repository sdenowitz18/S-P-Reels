import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  const { data: notifications } = await admin
    .from('notifications')
    .select('*, from_user:from_user_id(id, name), rec:rec_id(id, film_id, film:film_id(title))')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(30)

  const unread = (notifications ?? []).filter(n => !n.read).length

  return NextResponse.json({ notifications: notifications ?? [], unread })
}

export async function PATCH() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  await admin.from('notifications').update({ read: true }).eq('user_id', user.id).eq('read', false)
  return NextResponse.json({ ok: true })
}
