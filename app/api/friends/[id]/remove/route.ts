/**
 * DELETE /api/friends/[id]/remove
 *
 * Removes an accepted friendship. [id] is the friend's user ID.
 * Deletes the friend_request row in whichever direction it exists.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: friendUserId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  // Find the accepted friendship — could be in either direction
  const { data: req } = await admin
    .from('friend_requests')
    .select('id')
    .eq('status', 'accepted')
    .or(
      `and(from_user_id.eq.${user.id},to_user_id.eq.${friendUserId}),` +
      `and(from_user_id.eq.${friendUserId},to_user_id.eq.${user.id})`
    )
    .maybeSingle()

  if (!req) return NextResponse.json({ error: 'friendship not found' }, { status: 404 })

  const { error } = await admin
    .from('friend_requests')
    .delete()
    .eq('id', req.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
