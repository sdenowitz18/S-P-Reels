/**
 * POST /api/onboarding/session/[id]/rate
 *
 * Accepts a batch of calibration film ratings. The request now includes
 * the dimensions_v2 of each rated film (supplied by the client from the
 * next-films response), so we never need the hardcoded CALIBRATION_MAP.
 *
 * After saving, checks whether all poles have adequate coverage. If so,
 * computes the provisional taste code + contradiction pairs and signals ready.
 *
 * Request body:
 *   {
 *     ratings: Array<{
 *       film_id:      string               // e.g. "movie-123"
 *       label:        'love'|'like'|'meh'|'skip'
 *       title:        string
 *       poster_url:   string | null
 *       dimensions_v2: FilmDimensionsV2   // from next-films response
 *     }>
 *     all_covered: boolean   // client signals that next-films returned allCovered
 *   }
 *
 * Response:
 *   { ready: true }   — contradictions computed, redirect to interview
 *   { ready: false }  — keep serving more films
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { computeTasteCode, ALL_POLES } from '@/lib/taste-code'
import { computeContradictions } from '@/lib/taste/contradictions'
import { FilmDimensionsV2 } from '@/lib/prompts/film-brief'

const LABEL_TO_STARS: Record<string, number> = {
  love:     5,
  like:     4,
  watching: 4,  // "still watching" TV shows — treat as positive engagement
  meh:      2,
  skip:     0,
}

const MIN_FILMS_PER_POLE = 3
const LEFT_MAX           = 30
const RIGHT_MIN          = 70
const MIN_SEEN_TO_COMPUTE = 10

type DimKey = keyof FilmDimensionsV2

interface RatingInput {
  film_id:       string
  label:         string
  title:         string
  poster_url:    string | null
  dimensions_v2: FilmDimensionsV2
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = await req.json() as { ratings: RatingInput[]; all_covered?: boolean }
  const { ratings, all_covered = false } = body

  if (!Array.isArray(ratings)) {
    return NextResponse.json({ error: 'ratings array required' }, { status: 400 })
  }

  // Load current session
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

  // Append batch to transcript — include dimensions_v2 so coverage can be
  // recomputed from transcript alone without re-querying the DB
  const existing: unknown[] = session.transcript ?? []
  const newEntries = ratings.map(r => ({
    type:          'calibration_rating',
    film_id:       r.film_id,
    label:         r.label,
    stars:         LABEL_TO_STARS[r.label] ?? 0,
    title:         r.title,
    poster_url:    r.poster_url,
    dimensions_v2: r.dimensions_v2,
  }))

  const updatedTranscript = [...existing, ...newEntries]

  await supabase
    .from('taste_interview_sessions')
    .update({ transcript: updatedTranscript })
    .eq('id', id)

  // All non-skip ratings across the full transcript
  type TranscriptEntry = {
    type: string; film_id: string; label: string; stars: number;
    title: string; poster_url: string | null; dimensions_v2?: FilmDimensionsV2
  }

  const allSeen = (updatedTranscript as TranscriptEntry[])
    .filter(e => e.type === 'calibration_rating' && e.stars > 0 && e.dimensions_v2)

  const totalSeen = allSeen.length

  if (totalSeen < MIN_SEEN_TO_COMPUTE && !all_covered) {
    return NextResponse.json({ ready: false, total_seen: totalSeen })
  }

  // Compute pole coverage
  const dimKeys = [...new Set(ALL_POLES.map(p => p.dimKey))] as DimKey[]
  const coverage = new Map<string, number>()
  for (const dimKey of dimKeys) {
    coverage.set(`${dimKey}:left`, 0)
    coverage.set(`${dimKey}:right`, 0)
  }

  for (const entry of allSeen) {
    const dims = entry.dimensions_v2!
    for (const dimKey of dimKeys) {
      const score = dims[dimKey]
      if (score <= LEFT_MAX)  coverage.set(`${dimKey}:left`,  (coverage.get(`${dimKey}:left`)  ?? 0) + 1)
      if (score >= RIGHT_MIN) coverage.set(`${dimKey}:right`, (coverage.get(`${dimKey}:right`) ?? 0) + 1)
    }
  }

  const coverageComplete = [...coverage.values()].every(c => c >= MIN_FILMS_PER_POLE)

  // Only finalize if coverage is complete OR client says pool is exhausted/all_covered
  if (!coverageComplete && !all_covered) {
    return NextResponse.json({ ready: false, total_seen: totalSeen })
  }

  // Build RatedFilmEntry[] for taste code computation
  const ratedEntries = allSeen.map(e => ({
    film_id:       e.film_id,
    title:         e.title,
    poster_path:   e.poster_url,
    stars:         e.stars,
    dimensions_v2: e.dimensions_v2!,
  }))

  const tasteCode = computeTasteCode(ratedEntries)

  if (!tasteCode) {
    return NextResponse.json({ ready: false, total_seen: totalSeen })
  }

  const contradictions = computeContradictions(tasteCode)

  await supabase
    .from('taste_interview_sessions')
    .update({ contradictions, current_step: 0 })
    .eq('id', id)

  return NextResponse.json({ ready: true, total_seen: totalSeen })
}
