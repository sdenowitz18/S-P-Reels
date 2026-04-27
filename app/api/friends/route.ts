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
    .select('id, to_email, status, created_at')
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
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  // Check auth state — if unconfirmed, wipe everything and start fresh
  const { data: { users: authUsers } } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  const authMatch = authUsers.find(u => u.email?.toLowerCase() === normalised)
  const isConfirmed = !!authMatch?.email_confirmed_at

  if (authMatch && !isConfirmed) {
    // Delete stale unconfirmed auth user + any orphaned public.users row + old friend request
    await admin.auth.admin.deleteUser(authMatch.id)
    await admin.from('users').delete().eq('email', normalised)
    await admin.from('friend_requests').delete()
      .eq('from_user_id', user.id)
      .eq('to_email', normalised)
  }

  // Check if they're a real confirmed user
  const { data: target } = await supabase
    .from('users')
    .select('id, name, email')
    .eq('email', normalised)
    .single()

  // Upsert friend request
  await admin.from('friend_requests').upsert(
    { from_user_id: user.id, to_email: normalised, to_user_id: target?.id ?? null, status: 'pending' },
    { onConflict: 'from_user_id,to_email' }
  )

  // invite = PKCE code flow for new users; recovery also uses PKCE for confirmed users
  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: isConfirmed ? 'recovery' : 'invite',
    email: normalised,
    options: { redirectTo: `${appUrl}/auth/callback?next=/home` },
  })

  console.log('generateLink result:', JSON.stringify({ error: linkError, properties: linkData?.properties }))

  if (linkError) {
    return NextResponse.json({ error: linkError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, found: isConfirmed, name: target?.name, inviteLink: linkData.properties?.action_link })
}
