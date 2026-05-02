/**
 * computeContradictions — finds dimensions where a user has a strong signal
 * in one direction but has also rated films at the opposite pole well.
 *
 * These pairs are the raw material for the onboarding interview (Path A).
 * One ContradictionPair is surfaced per qualifying dimension, ranked by
 * signal strength (gap) descending so the interview starts with the sharpest
 * contradictions.
 *
 * A dimension qualifies when:
 *   1. It has a strong signal (gap ≥ STRONG_GAP — same threshold as the
 *      green indicator on the taste-code page)
 *   2. The user has at least one film at the opposite pole rated ≥ MIN_OUTLIER_STARS
 */

import { TasteCode, TasteCodeFilm } from '../taste-code'

// ── Thresholds ───────────────────────────────────────────────────────────────

// Must match STRONG_GAP in app/(app)/profile/taste-code/page.tsx
export const STRONG_GAP = 35

// Outlier must be rated at least this to be worth asking about
const MIN_OUTLIER_STARS = 3.0

// Max outlier films to keep per dimension — gives the interview options to
// pick the most discussable one at question-generation time
const MAX_OUTLIERS = 3

// ── Types ────────────────────────────────────────────────────────────────────

export interface ContradictionFilm {
  film_id:     string
  title:       string
  poster_path: string | null
  stars:       number
  dim_score:   number  // raw 0–100 score on this dimension
}

export interface ContradictionPair {
  dim_key:         string   // e.g. 'intimate_vs_epic'
  dominant_pole:   'left' | 'right'
  dominant_letter: string   // e.g. 'I'
  dominant_label:  string   // e.g. 'Intimate'
  gap:             number   // signal strength — how far the poles diverge in their ratings
  // The anchor: highest-rated film at their dominant pole — represents their usual lean
  anchor:          ContradictionFilm
  // The outliers: films at the opposite pole they also rated well — the contradiction
  outliers:        ContradictionFilm[]
}

// ── Main computation ─────────────────────────────────────────────────────────

/**
 * Given an already-computed TasteCode (which contains all 12 dimension entries
 * with their sample films), find every dimension where the user has a strong
 * signal AND has rated films against their grain.
 *
 * Takes only the TasteCode — no need to re-query the DB. All the film data
 * needed is already pre-computed in tasteCode.allEntries.
 */
export function computeContradictions(tasteCode: TasteCode): ContradictionPair[] {
  const pairs: ContradictionPair[] = []

  // Track every film ID used across all questions — no film should appear twice
  const usedFilmIds = new Set<string>()

  const strongEntries = tasteCode.allEntries.filter(e => e.gap >= STRONG_GAP)

  for (const entry of strongEntries) {
    // Anchor: highest-rated film at the dominant pole that hasn't been used yet
    const anchorRaw = entry.sampleFilms.find(f => !usedFilmIds.has(f.film_id))
    if (!anchorRaw) continue

    // Outliers: films at the opposite pole the user rated reasonably well,
    // excluding any film already used in a previous question
    const outliers: ContradictionFilm[] = entry.oppSampleFilms
      .filter(f => f.stars >= MIN_OUTLIER_STARS && !usedFilmIds.has(f.film_id))
      .slice(0, MAX_OUTLIERS)
      .map(toContradictionFilm)

    // No point surfacing a contradiction if there are no qualifying outliers
    if (outliers.length === 0) continue

    // Reserve all films used in this question so they can't appear again
    usedFilmIds.add(anchorRaw.film_id)
    outliers.forEach(o => usedFilmIds.add(o.film_id))

    pairs.push({
      dim_key:         entry.dimKey,
      dominant_pole:   entry.pole,
      dominant_letter: entry.letter,
      dominant_label:  entry.label,
      gap:             entry.gap,
      anchor:          toContradictionFilm(anchorRaw),
      outliers,
    })
  }

  // Strongest signals first — the interview should lead with the sharpest contradictions
  pairs.sort((a, b) => b.gap - a.gap)

  return pairs
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function toContradictionFilm(f: TasteCodeFilm): ContradictionFilm {
  return {
    film_id:     f.film_id,
    title:       f.title,
    poster_path: f.poster_path,
    stars:       f.stars,
    dim_score:   f.dimScore,
  }
}
