import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * GET /api/friends/search?email=...
 *
 * Looks up whether an email belongs to an existing confirmed user.
 * Used to show a preview card before sending a friend request.
 *
 * Returns:
 *   { status: 'found',        user: { id, name, email } }  — confirmed user, can send request
 *   { status: 'already_friends' }                          — already connected
 *   { status: 'already_requested' }                        — request already pending
 *   { status: 'not_found' }                                — not on S&P Reels
 *   { status: 'self' }                                     — that's you
 */
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const email = req.nextUrl.searchParams.get('email')?.trim().toLowerCase()
  if (!email || !email.includes('@')) {
    return NextResponse.json({ status: 'not_found' })
  }

  if (email === user.email?.toLowerCase()) {
    return NextResponse.json({ status: 'self' })
  }

  const admin = createAdminClient()

  // Look up confirmed user in public.users
  const { data: target } = await admin
    .from('users')
    .select('id, name, email')
    .eq('email', email)
    .maybeSingle()

  if (!target) return NextResponse.json({ status: 'not_found' })

  // Check if already friends
  const { data: existing } = await admin
    .from('friend_requests')
    .select('id, status')
    .or(
      `and(from_user_id.eq.${user.id},to_user_id.eq.${target.id}),` +
      `and(from_user_id.eq.${target.id},to_user_id.eq.${user.id})`
    )
    .limit(1)
    .maybeSingle()

  if (existing?.status === 'accepted') return NextResponse.json({ status: 'already_friends' })
  if (existing?.status === 'pending')  return NextResponse.json({ status: 'already_requested' })

  return NextResponse.json({ status: 'found', user: target })
}
