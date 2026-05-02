/**
 * GET /api/onboarding/session/latest
 *
 * Returns the most recent taste interview session for the authenticated user,
 * regardless of status. Used by /taste-code to link to the reveal page.
 *
 * Response: { session_id: string } | { session_id: null }
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ session_id: null }, { status: 401 })

  // Prefer completed sessions; fall back to any session for this user
  const { data: sessions } = await supabase
    .from('taste_interview_sessions')
    .select('id, status')
    .eq('user_id', user.id)
    .order('id', { ascending: false })
    .limit(5)

  if (!sessions?.length) return NextResponse.json({ session_id: null })

  // Pick completed first, then any
  const completed = sessions.find(s => s.status === 'completed')
  const best = completed ?? sessions[0]

  return NextResponse.json({ session_id: best.id })
}
