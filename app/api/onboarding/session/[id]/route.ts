/**
 * GET  /api/onboarding/session/[id]  — fetch current session state
 * PATCH /api/onboarding/session/[id] — append a step to the transcript
 *
 * The PATCH is called once per interview step as the user responds.
 * It appends the step entry to the transcript array and advances current_step.
 *
 * Transcript entry shape (stored in the transcript JSONB array):
 * {
 *   step:        number
 *   type:        'contradiction' | 'calibration' | 'open'
 *   dim_key?:    string          // which dimension this question was about
 *   film_a_id?:  string          // anchor film (contradiction questions)
 *   film_b_id?:  string          // outlier film (contradiction questions)
 *   question:    string          // the question text shown to the user
 *   response:    string          // the user's answer
 *   transition?: string          // bridge sentence to the next question (generated)
 * }
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getOrCacheFilm } from '@/lib/tmdb'
import { posterUrl } from '@/lib/types'

// ── Poster enrichment ─────────────────────────────────────────────────────────
// If contradictions were stored with null poster_paths (e.g. on first run before
// TMDB data was cached), fill them in on the way out and persist for next time.

interface ContradictionFilmRow {
  film_id:     string
  poster_path: string | null
  [key: string]:  unknown
}

interface ContradictionRow {
  anchor:   ContradictionFilmRow
  outliers: ContradictionFilmRow[]
  [key: string]: unknown
}

async function enrichPosters(
  supabase:        ReturnType<typeof createClient> extends Promise<infer T> ? T : never,
  contradictions:  ContradictionRow[],
): Promise<{ enriched: ContradictionRow[]; changed: boolean }> {
  // Collect all film_ids that are missing a poster
  const missingIds = new Set<string>()
  for (const c of contradictions) {
    if (!c.anchor.poster_path)              missingIds.add(c.anchor.film_id)
    for (const o of c.outliers)
      if (!o.poster_path)                   missingIds.add(o.film_id)
  }
  if (missingIds.size === 0) return { enriched: contradictions, changed: false }

  // Fetch from TMDB / cache
  const results = await Promise.allSettled(
    [...missingIds].map(id => getOrCacheFilm(supabase, id))
  )
  const posterMap: Record<string, string | null> = {}
  const ids = [...missingIds]
  for (let i = 0; i < ids.length; i++) {
    const r = results[i]
    posterMap[ids[i]] = r.status === 'fulfilled' && r.value.poster_path
      ? posterUrl(r.value.poster_path, 'w342')
      : null
  }

  const fill = (f: ContradictionFilmRow): ContradictionFilmRow =>
    f.poster_path ? f : { ...f, poster_path: posterMap[f.film_id] ?? null }

  const enriched = contradictions.map(c => ({
    ...c,
    anchor:   fill(c.anchor),
    outliers: c.outliers.map(fill),
  }))

  return { enriched, changed: true }
}

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { id } = await params

  const { data: session } = await supabase
    .from('taste_interview_sessions')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!session) return NextResponse.json({ error: 'not found' }, { status: 404 })

  // Enrich any null poster_paths in-place and persist so subsequent loads are instant
  if (Array.isArray(session.contradictions) && session.contradictions.length > 0) {
    const { enriched, changed } = await enrichPosters(
      supabase,
      session.contradictions as ContradictionRow[],
    )
    if (changed) {
      await supabase
        .from('taste_interview_sessions')
        .update({ contradictions: enriched })
        .eq('id', id)
      session.contradictions = enriched
    }
  }

  return NextResponse.json({ session })
}

// ── PATCH ─────────────────────────────────────────────────────────────────────

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json() as { step_entry: object }
  const { step_entry } = body

  if (!step_entry) return NextResponse.json({ error: 'step_entry required' }, { status: 400 })

  // Fetch current session state
  const { data: session } = await supabase
    .from('taste_interview_sessions')
    .select('transcript, current_step, status')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!session) return NextResponse.json({ error: 'not found' }, { status: 404 })
  if (session.status !== 'in_progress') {
    return NextResponse.json({ error: 'session is not in progress' }, { status: 400 })
  }

  const updatedTranscript = [...(session.transcript as object[]), step_entry]
  const nextStep          = (session.current_step as number) + 1

  const { error } = await supabase
    .from('taste_interview_sessions')
    .update({ transcript: updatedTranscript, current_step: nextStep })
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ current_step: nextStep, transcript_length: updatedTranscript.length })
}
