/**
 * POST /api/dev/reset-account
 *
 * DEV ONLY — wipes all user-specific data for the authenticated user so you
 * can run through onboarding again without creating a new account.
 *
 * Clears:
 *   • library_entries       (ratings, watch history)
 *   • taste_interview_sessions + interviews (onboarding sessions)
 *   • recommendations + taste_recommendations
 *   • user_taste_tags
 *   • users.taste_prose / taste_prose_film_count
 *
 * Does NOT touch: films, friend_requests, the auth.users row, or the
 * public.users name/email — you stay logged in as the same person.
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'not available in production' }, { status: 403 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const uid = user.id

  // Run all deletes in parallel — order doesn't matter since we're wiping everything
  const results = await Promise.allSettled([
    admin.from('library_entries').delete().eq('user_id', uid),
    admin.from('taste_interview_sessions').delete().eq('user_id', uid),
    admin.from('interviews').delete().eq('user_id', uid),
    admin.from('recommendations').delete().eq('user_id', uid),
    admin.from('taste_recommendations').delete().eq('user_id', uid),
    admin.from('user_taste_tags').delete().eq('user_id', uid),
    admin.from('rec_comments').delete().eq('user_id', uid),
    admin.from('users')
      .update({ taste_prose: null, taste_prose_film_count: null })
      .eq('id', uid),
  ])

  const errors = results
    .filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && r.value.error))
    .map(r => r.status === 'rejected' ? r.reason : (r as PromiseFulfilledResult<{ error: { message: string } | null }>).value.error?.message)
    .filter(Boolean)

  if (errors.length) {
    console.warn('[dev/reset-account] some deletes failed:', errors)
  }

  return NextResponse.json({ ok: true, errors })
}
