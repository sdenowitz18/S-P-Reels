import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  // Fetch the request first so we know who sent it
  const { data: req } = await admin
    .from('friend_requests')
    .select('id, from_user_id')
    .eq('id', id)
    .or(`to_email.eq.${user.email},to_user_id.eq.${user.id}`)
    .maybeSingle()

  const { error } = await admin
    .from('friend_requests')
    .update({ status: 'accepted', to_user_id: user.id })
    .eq('id', id)
    .or(`to_email.eq.${user.email},to_user_id.eq.${user.id}`)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Notify the original sender that their request was accepted
  if (req?.from_user_id) {
    const { data: acceptor } = await admin
      .from('users')
      .select('name')
      .eq('id', user.id)
      .maybeSingle()

    await admin.from('notifications').insert({
      user_id: req.from_user_id,
      type: 'friend_accepted',
      payload: { friendId: user.id, friendName: acceptor?.name ?? 'Someone' },
    })
  }

  return NextResponse.json({ ok: true })
}
