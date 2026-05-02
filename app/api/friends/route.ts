import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// GET — list friends (accepted requests in either direction) + incoming pending
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { data: { user: authUser } } = await supabase.auth.getUser()
  const myEmail = authUser?.email ?? ''

  const admin = createAdminClient()

  // Requests I sent that were accepted
  const { data: sent } = await admin
    .from('friend_requests')
    .select('*, friend:to_user_id(id, name, email)')
    .eq('from_user_id', user.id)
    .eq('status', 'accepted')

  // Requests sent to me that were accepted
  const { data: received } = await admin
    .from('friend_requests')
    .select('*, friend:from_user_id(id, name, email)')
    .eq('to_user_id', user.id)
    .eq('status', 'accepted')

  // Incoming pending requests — match by email OR linked user id
  const { data: incoming } = await admin
    .from('friend_requests')
    .select('*, from_user:from_user_id(id, name, email)')
    .eq('status', 'pending')
    .or(`to_email.eq.${myEmail},to_user_id.eq.${user.id}`)

  // Outgoing pending requests I sent
  const { data: outgoing } = await supabase
    .from('friend_requests')
    .select('id, to_email, to_user_id, status, created_at')
    .eq('from_user_id', user.id)
    .eq('status', 'pending')

  const friends = [
    ...(sent ?? []).map((r: any) => r.friend).filter(Boolean),
    ...(received ?? []).map((r: any) => r.friend).filter(Boolean),
  ]

  return NextResponse.json({ friends, incoming: incoming ?? [], outgoing: outgoing ?? [] })
}

// POST — send a friend request by email
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { email } = await request.json()
  if (!email) return NextResponse.json({ error: 'email required' }, { status: 400 })

  const normalised = email.trim().toLowerCase()
  if (normalised === user.email?.toLowerCase()) {
    return NextResponse.json({ error: "that's your own email" }, { status: 400 })
  }

  const admin = createAdminClient()

  // Check if they're a confirmed user in public.users
  const { data: target } = await admin
    .from('users')
    .select('id, name, email')
    .eq('email', normalised)
    .maybeSingle()

  if (target) {
    // ── Confirmed user: in-app friend request only, no email sent ──
    const { error } = await admin.from('friend_requests').upsert(
      { from_user_id: user.id, to_email: normalised, to_user_id: target.id, status: 'pending' },
      { onConflict: 'from_user_id,to_email' }
    )
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Notify the recipient
    await admin.from('notifications').insert({
      user_id: target.id,
      type: 'friend_request',
      from_user_id: user.id,
    })

    return NextResponse.json({ ok: true, found: true, name: target.name })
  }

  // ── Not a confirmed user: send an email invitation ──
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  // Clean up any stale unconfirmed auth user so the invite email is fresh
  const { data: { users: authUsers } } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  const authMatch = authUsers.find(u => u.email?.toLowerCase() === normalised)
  if (authMatch && !authMatch.email_confirmed_at) {
    await admin.auth.admin.deleteUser(authMatch.id)
    await admin.from('users').delete().eq('email', normalised)
    await admin.from('friend_requests').delete()
      .eq('from_user_id', user.id).eq('to_email', normalised)
  }

  // Upsert the friend request without a to_user_id (they don't have an account yet)
  await admin.from('friend_requests').upsert(
    { from_user_id: user.id, to_email: normalised, to_user_id: null, status: 'pending' },
    { onConflict: 'from_user_id,to_email' }
  )

  // Send the invite email directly — no link returned to the client
  const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(normalised, {
    redirectTo: `${appUrl}/invite`,
  })

  if (inviteError) return NextResponse.json({ error: inviteError.message }, { status: 500 })

  return NextResponse.json({ ok: true, found: false, invited: true })
}
