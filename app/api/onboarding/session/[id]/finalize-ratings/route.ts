/**
 * POST /api/onboarding/session/[id]/finalize-ratings
 *
 * Called when the user has finished rating films in the calibration flow
 * (either all 12 dimension slots filled in, or all calibration films exhausted).
 *
 * Reads all calibration_rating entries from the transcript, computes the
 * provisional taste code using the hardcoded CALIBRATION_MAP dimensions_v2,
 * computes contradiction pairs, enriches their poster URLs, and saves them
 * back to the session.
 *
 * Does NOT mark the session as "completed" — that happens after the interview.
 *
 * Returns: { ready: boolean, contradictions_count: number }
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { CALIBRATION_MAP } from '@/lib/taste/calibration-films'
import { computeTasteCode } from '@/lib/taste-code'
import { computeContradictions } from '@/lib/taste/contradictions'
import { getOrCacheFilm } from '@/lib/tmdb'
import { posterUrl } from '@/lib/types'

interface TranscriptEntry {
  type:    string
  film_id: string
  stars:   number
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

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

  // All rated (non-skip) calibration entries
  const calibRatings = ((session.transcript ?? []) as TranscriptEntry[])
    .filter(e => e.type === 'calibration_rating' && e.stars > 0)

  // Fetch poster paths for all rated films so contradictions have them
  const seenFilmIds = calibRatings.map(r => r.film_id)
  const filmResults = await Promise.allSettled(
    seenFilmIds.map(fid => getOrCacheFilm(supabase, fid))
  )

  const posterMap: Record<string, string | null> = {}
  for (let i = 0; i < seenFilmIds.length; i++) {
    const r = filmResults[i]
    posterMap[seenFilmIds[i]] = r.status === 'fulfilled' && r.value.poster_path
      ? posterUrl(r.value.poster_path, 'w342')
      : null
  }

  // Build RatedFilmEntry[] from calibration data + user star ratings
  const ratedEntries = calibRatings
    .map(r => {
      const calib = CALIBRATION_MAP[r.film_id]
      if (!calib) return null
      return {
        film_id:       calib.tmdb_id,
        title:         calib.title,
        poster_path:   posterMap[calib.tmdb_id] ?? null,
        stars:         r.stars,
        dimensions_v2: calib.dimensions_v2,
      }
    })
    .filter(Boolean) as Array<{
      film_id: string; title: string; poster_path: string | null;
      stars: number; dimensions_v2: typeof CALIBRATION_MAP[string]['dimensions_v2']
    }>

  const tasteCode     = computeTasteCode(ratedEntries)
  const contradictions = tasteCode ? computeContradictions(tasteCode) : []

  // Save contradictions to session (still in_progress — interview hasn't happened yet)
  await supabase
    .from('taste_interview_sessions')
    .update({ contradictions, current_step: 0 })
    .eq('id', id)

  return NextResponse.json({
    ready:               contradictions.length > 0,
    contradictions_count: contradictions.length,
  })
}
