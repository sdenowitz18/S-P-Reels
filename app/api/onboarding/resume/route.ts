/**
 * GET /api/onboarding/resume
 *
 * Returns the user's in-progress taste interview session (if any) so the
 * home page can show a "continue your taste setup" prompt.
 *
 * Response: { session: { id, path, contradictions_count, needs_rating } | null }
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ session: null })

  const { data: session } = await supabase
    .from('taste_interview_sessions')
    .select('id, path, contradictions, current_step, status')
    .eq('user_id', user.id)
    .eq('status', 'in_progress')
    .limit(1)
    .maybeSingle()

  if (!session) return NextResponse.json({ session: null })

  const contradictions = session.contradictions as unknown[] | null
  const contradictionsCount = Array.isArray(contradictions) ? contradictions.length : 0

  // cold_start with no contradictions yet = still needs to rate films
  const needsRating = session.path === 'cold_start' && contradictionsCount === 0

  return NextResponse.json({
    session: {
      id:                  session.id,
      path:                session.path,
      contradictions_count: contradictionsCount,
      needs_rating:        needsRating,
      current_step:        session.current_step ?? 0,
    },
  })
}
