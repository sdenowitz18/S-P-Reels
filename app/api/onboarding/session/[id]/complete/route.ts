/**
 * POST /api/onboarding/session/[id]/complete
 *
 * Marks the session as completed after the user finishes the contradiction
 * interview questions.  Called by the interview page on the last question.
 *
 * Library entries are written during the rating phase (rate-film endpoint)
 * with real star ratings the user gave — we do not create synthetic entries here.
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { id } = await params

  const { data: session } = await supabase
    .from('taste_interview_sessions')
    .select('id, status')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!session) return NextResponse.json({ error: 'not found' }, { status: 404 })
  if (session.status !== 'in_progress') {
    return NextResponse.json({ error: 'session is not in progress' }, { status: 400 })
  }

  const { error } = await supabase
    .from('taste_interview_sessions')
    .update({
      status:       'completed',
      completed_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ status: 'completed' })
}
