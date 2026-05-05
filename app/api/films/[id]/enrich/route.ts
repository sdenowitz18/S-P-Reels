/**
 * POST /api/films/[id]/enrich
 *
 * On-demand enrichment for a single film. Idempotent — no-op if the film
 * already has an ai_brief with dimensions_v2. Used to kick off enrichment
 * when a user logs a film that hasn't been analyzed yet, so the insight
 * card and catalog panel have real data.
 *
 * Returns:
 *   { ok: true, alreadyEnriched: boolean }
 *
 * Errors if generation fails (caller should treat as non-blocking).
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getOrCacheFilm } from '@/lib/tmdb'
import { generateFilmBrief, FilmDimensionsV2 } from '@/lib/prompts/film-brief'

// Allow up to 60s for OpenAI to generate the film brief
export const maxDuration = 60

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  // Check if already enriched with dimensions_v2
  const { data: existing } = await supabase
    .from('films')
    .select('ai_brief, brief_at')
    .eq('id', id)
    .single()

  const alreadyEnriched = !!(existing?.ai_brief as { dimensions_v2?: Partial<FilmDimensionsV2> } | null)?.dimensions_v2

  if (alreadyEnriched) {
    return NextResponse.json({ ok: true, alreadyEnriched: true })
  }

  // Not enriched — generate now
  const film = await getOrCacheFilm(supabase, id)
  if (!film) return NextResponse.json({ error: 'film not found' }, { status: 404 })

  const brief = await generateFilmBrief(film)
  if (!brief) return NextResponse.json({ error: 'enrichment failed' }, { status: 500 })

  await supabase
    .from('films')
    .update({ ai_brief: brief, brief_at: new Date().toISOString() })
    .eq('id', id)

  return NextResponse.json({ ok: true, alreadyEnriched: false })
}
