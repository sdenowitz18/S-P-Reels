/**
 * POST /api/onboarding/session/[id]/rate-film
 *
 * Records a single film rating during the calibration flow.
 * Called once per film as the user swipes through.
 *
 * Body: { film_id: string, stars: number }
 *   stars = 0 means "haven't seen" (stored in transcript, no library entry)
 *   stars 1–5 writes a real library_entry (user gave an actual star rating)
 *
 * Returns: { ok: true }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = await req.json() as { film_id: string; stars: number }
  const { film_id, stars } = body

  if (!film_id || stars === undefined) {
    return NextResponse.json({ error: 'film_id and stars required' }, { status: 400 })
  }

  // Load session
  const { data: session } = await supabase
    .from('taste_interview_sessions')
    .select('id, path, status, transcript')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!session) return NextResponse.json({ error: 'not found' }, { status: 404 })
  if (session.status !== 'in_progress') {
    return NextResponse.json({ error: 'session is not in progress' }, { status: 400 })
  }

  // Append to transcript
  const existing = (session.transcript ?? []) as unknown[]
  const entry = { type: 'calibration_rating', film_id, stars }

  await supabase
    .from('taste_interview_sessions')
    .update({ transcript: [...existing, entry] })
    .eq('id', id)

  // Write real library entry if the user actually rated it (not "haven't seen")
  // These are genuine star ratings given by the user, not synthetic mappings.
  if (stars > 0) {
    await supabase
      .from('library_entries')
      .upsert({
        user_id:  user.id,
        film_id,
        list:     'watched',
        audience: ['me'],
        my_stars: stars,
      }, { onConflict: 'user_id,film_id,list' })
  }

  return NextResponse.json({ ok: true })
}
