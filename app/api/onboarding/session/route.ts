/**
 * POST /api/onboarding/session
 *
 * Smart router that determines which onboarding path a user should take
 * and creates (or resumes) a taste_interview_sessions row accordingly.
 *
 * Routing priority:
 *   1. In-progress session → resume
 *   2. 30+ enriched films, no behavioral portrait → Taste Deep Dive
 *   3. 30+ enriched films, has cold-start portrait → hybrid reveal
 *   4. 30+ enriched films, has behavioral portrait → check-in
 *   5. Below threshold, no portrait → Taste Setup
 *   6. Below threshold, has cold-start portrait → not_ready (show existing portrait)
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  getRatedFilmsForTasteCode,
  getPortraitHistory,
  ENRICHMENT_THRESHOLD,
  OnboardingTrigger,
  OnboardingPath,
} from '@/lib/taste/session'
import { computeTasteCode } from '@/lib/taste-code'
import { computeContradictions } from '@/lib/taste/contradictions'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = await req.json() as {
    trigger: OnboardingTrigger
    preferred_path?: 'letterboxd' | 'cold_start'
  }
  const { trigger, preferred_path } = body

  // ── 1. Resume any in-progress session ─────────────────────────────────────
  const { data: existingSession } = await supabase
    .from('taste_interview_sessions')
    .select('id, path, status, current_step, contradictions, transcript')
    .eq('user_id', user.id)
    .eq('status', 'in_progress')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existingSession) {
    return NextResponse.json({
      path:          'resume' as OnboardingPath,
      session_id:    existingSession.id,
      session_path:  existingSession.path,
      current_step:  existingSession.current_step,
      contradictions: existingSession.contradictions,
    })
  }

  // ── 2. Gather state ────────────────────────────────────────────────────────
  const [ratedFilms, portraits] = await Promise.all([
    getRatedFilmsForTasteCode(supabase, user.id),
    getPortraitHistory(supabase, user.id),
  ])

  const enrichedCount        = ratedFilms.length
  const hasBehavioralPortrait = portraits.some(p => p.source === 'letterboxd' || p.source === 'monthly_refresh')
  const hasColdStartPortrait  = portraits.some(p => p.source === 'cold_start')

  // ── 3. Below threshold ─────────────────────────────────────────────────────
  if (enrichedCount < ENRICHMENT_THRESHOLD) {
    // Already has a Taste Setup portrait — nothing new to offer until threshold
    if (hasColdStartPortrait) {
      return NextResponse.json({
        path:           'not_ready' as OnboardingPath,
        enriched_count: enrichedCount,
        threshold:      ENRICHMENT_THRESHOLD,
        has_setup_portrait: true,
      })
    }

    // No portrait yet — start Taste Setup
    const { data: session, error } = await supabase
      .from('taste_interview_sessions')
      .insert({
        user_id:       user.id,
        path:          'cold_start',
        status:        'in_progress',
        contradictions: [],
        messy_middle:  [],
        transcript:    [],
        current_step:  0,
      })
      .select('id')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({
      path:              'taste_setup' as OnboardingPath,
      session_id:        session.id,
      calibration_films: [],  // TODO: curated calibration film set (Phase 4)
    })
  }

  // ── 4. Above threshold — compute taste code ────────────────────────────────
  const tasteCode = computeTasteCode(ratedFilms)

  // Edge case: enough films but not enough signal spread — fall through to Taste Setup
  if (!tasteCode) {
    const { data: session, error } = await supabase
      .from('taste_interview_sessions')
      .insert({
        user_id:       user.id,
        path:          'cold_start',
        status:        'in_progress',
        contradictions: [],
        messy_middle:  [],
        transcript:    [],
        current_step:  0,
      })
      .select('id')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({
      path:              'taste_setup' as OnboardingPath,
      session_id:        session.id,
      calibration_films: [],
    })
  }

  const contradictions = computeContradictions(tasteCode)
  const tasteSummary   = { letters: tasteCode.letters, entry_count: tasteCode.entries.length }

  // ── 5. Already has behavioral portrait → check-in ─────────────────────────
  if (hasBehavioralPortrait) {
    // TODO: full check-in logic (Phase 5)
    // For now, return the path so the client can show the right state
    return NextResponse.json({
      path:    'checkin' as OnboardingPath,
      message: 'Check-in flow coming in Phase 5',
    })
  }

  // ── 6. Has cold-start portrait + now above threshold → hybrid reveal ───────
  if (hasColdStartPortrait) {
    const { data: session, error } = await supabase
      .from('taste_interview_sessions')
      .insert({
        user_id:       user.id,
        path:          'letterboxd',
        status:        'in_progress',
        contradictions,
        messy_middle:  [],
        transcript:    [],
        current_step:  0,
      })
      .select('id')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({
      path:               'hybrid_reveal' as OnboardingPath,
      session_id:         session.id,
      contradictions,
      taste_code_summary: tasteSummary,
    })
  }

  // ── 7. Fresh Taste Deep Dive ───────────────────────────────────────────────
  const { data: session, error } = await supabase
    .from('taste_interview_sessions')
    .insert({
      user_id:       user.id,
      path:          'letterboxd',
      status:        'in_progress',
      contradictions,
      messy_middle:  [],
      transcript:    [],
      current_step:  0,
    })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    path:               'taste_deep_dive' as OnboardingPath,
    session_id:         session.id,
    contradictions,
    taste_code_summary: tasteSummary,
  })
}
