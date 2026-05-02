import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { name } = await request.json()
  const { error } = await supabase.from('users').upsert({
    id: user.id,
    email: user.email!,
    name: name || user.user_metadata?.name || 'viewer',
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Backfill any pending friend requests sent to this email before the user signed up
  const admin = createAdminClient()
  await admin
    .from('friend_requests')
    .update({ to_user_id: user.id })
    .eq('to_email', user.email!.toLowerCase())
    .eq('status', 'pending')
    .is('to_user_id', null)

  return NextResponse.json({ ok: true })
}
