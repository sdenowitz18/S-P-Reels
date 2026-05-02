/**
 * Shared helpers for onboarding session routing and taste code computation.
 */

import { posterUrl } from '../types'
import { FilmDimensionsV2 } from '../prompts/film-brief'
import { RatedFilmEntry } from '../taste-code'

// ── Constants ────────────────────────────────────────────────────────────────

// Minimum enriched+rated films required before Taste Deep Dive is meaningful.
// Below this, the taste code doesn't have enough pole coverage to find
// reliable contradictions — route to Taste Setup instead.
export const ENRICHMENT_THRESHOLD = 30

// ── Types ────────────────────────────────────────────────────────────────────

export type OnboardingTrigger =
  | 'post_import'        // user just completed a Letterboxd import
  | 'taste_page'         // user clicked CTA on their taste page
  | 'threshold_crossed'  // app detected the user crossed ENRICHMENT_THRESHOLD

export type OnboardingPath =
  | 'taste_deep_dive'  // Letterboxd data → contradiction interview
  | 'taste_setup'      // no/insufficient data → calibration film interview
  | 'hybrid_reveal'    // had cold-start portrait, now has behavioral data
  | 'checkin'          // has behavioral portrait + new films → check-in flow
  | 'resume'           // in-progress session exists
  | 'not_ready'        // below threshold + already has a setup portrait; nothing new to offer

export interface PortraitSummary {
  id:         string
  source:     'letterboxd' | 'cold_start' | 'monthly_refresh'
  signal_mode: 'soft' | 'hard'
  version:    number
  created_at: string
}

// ── Data fetching ────────────────────────────────────────────────────────────

/**
 * Fetches all watched+rated films with dimensions_v2 for a user.
 * This is the input to computeTasteCode and computeContradictions.
 *
 * Reads dimensions_v2 from the top-level films column (not ai_brief),
 * which is the canonical location after migration 0010.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getRatedFilmsForTasteCode(supabase: any, userId: string): Promise<RatedFilmEntry[]> {
  const { data: entries } = await supabase
    .from('library_entries')
    .select('film_id, my_stars, film:films(title, poster_path, dimensions_v2)')
    .eq('user_id', userId)
    .eq('list', 'watched')
    .not('my_stars', 'is', null)

  if (!entries?.length) return []

  return (entries as Array<{
    film_id: string
    my_stars: number
    film: { title: string; poster_path: string | null; dimensions_v2: FilmDimensionsV2 | null } | null
  }>)
    .filter(e => e.film?.dimensions_v2 != null)
    .map(e => ({
      film_id:      e.film_id,
      title:        e.film!.title,
      poster_path:  e.film!.poster_path ? posterUrl(e.film!.poster_path, 'w185') : null,
      stars:        e.my_stars,
      dimensions_v2: e.film!.dimensions_v2!,
    }))
}

/**
 * Returns the user's portrait history, newest first.
 * Used by the session router to determine which path applies.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getPortraitHistory(supabase: any, userId: string): Promise<PortraitSummary[]> {
  const { data } = await supabase
    .from('taste_portraits')
    .select('id, source, signal_mode, version, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(10)

  return (data ?? []) as PortraitSummary[]
}
