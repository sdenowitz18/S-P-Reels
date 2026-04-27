import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  const { data: recs, error } = await admin
    .from('recommendations')
    .select('*, film:film_id(id, title, year, poster_path, director), from_user:from_user_id(id, name)')
    .eq('to_user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Mark related rec_received notifications as read
  await admin
    .from('notifications')
    .update({ read: true })
    .eq('user_id', user.id)
    .eq('type', 'rec_received')
    .eq('read', false)

  return NextResponse.json({ recs: recs ?? [] })
}
