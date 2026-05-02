import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Called from the /welcome page after an invited user sets their name + password.
// Uses the admin client so Supabase skips the "confirm your email" step entirely.
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { name, password } = await request.json()
  if (!name?.trim()) return NextResponse.json({ error: 'name required' }, { status: 400 })
  if (!password || password.length < 6) return NextResponse.json({ error: 'password too short' }, { status: 400 })

  const admin = createAdminClient()

  // Update password + name via admin — no confirmation email triggered
  const { error: updateError } = await admin.auth.admin.updateUserById(user.id, {
    password,
    user_metadata: { name: name.trim() },
    email_confirm: true, // mark email as confirmed if it isn't already
  })
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  // Upsert public profile row
  const { error: profileError } = await admin.from('users').upsert({
    id: user.id,
    email: user.email!,
    name: name.trim(),
  })
  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 })

  // Backfill any pending friend requests sent to this email before they had an account
  await admin
    .from('friend_requests')
    .update({ to_user_id: user.id })
    .eq('to_email', user.email!.toLowerCase())
    .eq('status', 'pending')
    .is('to_user_id', null)

  return NextResponse.json({ ok: true })
}
