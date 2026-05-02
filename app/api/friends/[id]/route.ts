import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * DELETE /api/friends/[id]
 *
 * Rescinds a pending outgoing friend request.
 * Also removes the friend_request notification from the recipient's inbox.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  // Fetch the request — must be ours and still pending
  const { data: req } = await admin
    .from('friend_requests')
    .select('id, from_user_id, to_user_id, status')
    .eq('id', id)
    .eq('from_user_id', user.id)
    .eq('status', 'pending')
    .maybeSingle()

  if (!req) return NextResponse.json({ error: 'not found' }, { status: 404 })

  // Delete the friend request
  const { error } = await admin.from('friend_requests').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Clean up the notification we created for the recipient
  if (req.to_user_id) {
    await admin
      .from('notifications')
      .delete()
      .eq('type', 'friend_request')
      .eq('from_user_id', user.id)
      .eq('user_id', req.to_user_id)
  }

  return NextResponse.json({ ok: true })
}
