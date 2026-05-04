/**
 * Match Score — predicts how much a user will enjoy a film based on their
 * actual rating history at each cinematic pole.
 *
 * Core formula (satisfaction-prediction approach):
 *   For every dimension where the film has real signal (not near-neutral):
 *     1. Find which pole the film leans toward (left if filmScore < 50, right if >= 50).
 *     2. Look up the user's normalized average rating for films at that pole (0–100).
 *     3. Weight that pole score by the film's signal strength (how extreme it is).
 *   Final taste score = weighted average of pole scores across all signalling dimensions.
 *
 * Key properties:
 *   - No direction penalty: a Patient film scores well if the user rates Patient
 *     films highly, even if they slightly prefer Kinetic films overall.
 *   - All extreme dimensions count, not just the user's top-4 preference dims.
 *   - The more extreme a film is on a dimension, the more that dimension matters.
 *   - Dimensions where the film sits near neutral (filmScore ≈ 50) contribute nothing.
 *   - Returns 50 (neutral) if the film has no signal or no taste data is available.
 *
 * Quality multiplier (applied on top of taste score):
 *   A smooth non-linear curve keyed to a composite quality score (0–100) built from
 *   Metacritic, Rotten Tomatoes, IMDb, and TMDB. Bad films are penalised aggressively;
 *   great films receive a small bonus; the curve is intentionally asymmetric.
 */

import { TasteCode } from '@/lib/taste-code'
import { FilmDimensionsV2 } from '@/lib/prompts/film-brief'

/** Minimum logged films required to show a match score. */
export const MATCH_SCORE_MIN_FILMS = 8

/**
 * Minimum σ floor — prevents collapse for users with very narrow rating ranges.
 */
export const SIGMA_FLOOR = 0.6

/**
 * Minimum normalised (0–100) rating stats.
 */
export const NORMALIZED_STATS_MIN_FILMS = 10

export interface RatingStats {
  mu:         number
  sigma:      number
  count:      number
  normalized: boolean
}

export function computeRatingStats(starRatings: number[]): RatingStats {
  const count = starRatings.length
  if (count === 0) return { mu: 3.0, sigma: SIGMA_FLOOR, count: 0, normalized: false }
  const mu = starRatings.reduce((s, r) => s + r, 0) / count
  const variance = starRatings.reduce((s, r) => s + (r - mu) ** 2, 0) / count
  const sigma = Math.max(Math.sqrt(variance), SIGMA_FLOOR)
  return { mu, sigma, count, normalized: count >= NORMALIZED_STATS_MIN_FILMS }
}

export type RatingInterpretation = 'strongly_liked' | 'liked' | 'lukewarm' | 'didnt_land'

export function interpretRating(
  stars: number,
  stats: RatingStats,
): { z: number; bucket: RatingInterpretation } {
  if (!stats.normalized) {
    const bucket: RatingInterpretation =
      stars >= 4.0 ? 'strongly_liked' :
      stars >= 3.0 ? 'liked'          :
      stars >= 2.0 ? 'lukewarm'       : 'didnt_land'
    return { z: (stars - stats.mu) / stats.sigma, bucket }
  }
  const z = (stars - stats.mu) / stats.sigma
  const bucket: RatingInterpretation =
    z >  1.0  ? 'strongly_liked' :
    z >= 0    ? 'liked'          :
    z >= -1.0 ? 'lukewarm'       : 'didnt_land'
  return { z, bucket }
}

// ── Core match score ──────────────────────────────────────────────────────────

/** Signal strength threshold — dimensions where |filmScore − 50| < this are skipped. */
const SIGNAL_THRESHOLD = 0.05  // filmScore must be outside 47.5–52.5

/**
 * Compute a 0–100 taste match score.
 *
 * For each dimension with real signal, looks up how the user actually rates
 * films at the pole the film leans toward, then returns a weighted average.
 * Does NOT apply the quality multiplier — call applyQualityMultiplier separately.
 */
export function computeMatchScore(
  tasteCode: TasteCode,
  filmDimensions: Partial<FilmDimensionsV2>,
): number {
  // Build lookup: dimKey → { leftPoleScore, rightPoleScore }
  const poleScores = new Map<string, { left: number; right: number }>()
  for (const entry of tasteCode.allEntries) {
    const left  = entry.pole === 'left'  ? entry.poleScore : entry.oppositeScore
    const right = entry.pole === 'right' ? entry.poleScore : entry.oppositeScore
    poleScores.set(entry.dimKey as string, { left, right })
  }

  let weightedSum = 0
  let totalWeight = 0

  for (const [dimKeyStr, filmScore] of Object.entries(filmDimensions)) {
    const signal = Math.abs(filmScore - 50) / 50  // 0–1; how extreme the film is
    if (signal < SIGNAL_THRESHOLD) continue

    const scores = poleScores.get(dimKeyStr)
    if (!scores) continue

    // Score for the pole this film actually leans toward
    const filmPoleScore = filmScore < 50 ? scores.left : scores.right

    weightedSum += filmPoleScore * signal
    totalWeight += signal
  }

  if (totalWeight === 0) return 50

  const raw = weightedSum / totalWeight  // weighted avg pole score, 0–100
  return Math.max(2, Math.min(98, Math.round(raw)))
}

// ── Quality composite & multiplier ───────────────────────────────────────────

/**
 * Build a single composite quality score (0–100) from available sources.
 *
 * Weighting rationale:
 *   Critics (55%):  Metacritic 60% + RT 40% — more rigorous for quality detection
 *   Audience (45%): IMDb 60% + TMDB 40%     — TMDB Bayesian-adjusted for vote count
 *
 * Returns null when no data is available for any source.
 */
export function computeCompositeQuality(params: {
  tmdbVoteAverage: number | null
  tmdbVoteCount:   number | null
  imdbRating:      number | null
  rtScore:         number | null
  metacritic:      number | null
}): number | null {
  const { tmdbVoteAverage, tmdbVoteCount, imdbRating, rtScore, metacritic } = params

  // Bayesian-adjust TMDB to account for films with few votes
  let tmdbAdj = tmdbVoteAverage
  if (tmdbVoteAverage != null) {
    const PRIOR_MEAN = 6.5
    const CONFIDENCE = 300  // votes equivalent to full trust
    const n = tmdbVoteCount ?? 0
    tmdbAdj = (tmdbVoteAverage * n + PRIOR_MEAN * CONFIDENCE) / (n + CONFIDENCE)
  }

  // Normalise all to 0–100
  const tmdb = tmdbAdj   != null ? tmdbAdj   * 10 : null
  const imdb = imdbRating != null ? imdbRating * 10 : null
  const rt   = rtScore    != null ? rtScore        : null
  const mc   = metacritic != null ? metacritic     : null

  // Critic composite
  let criticScore: number | null = null
  if (mc != null && rt != null)        criticScore = mc * 0.6 + rt * 0.4
  else if (mc != null)                 criticScore = mc
  else if (rt != null)                 criticScore = rt

  // Audience composite
  let audienceScore: number | null = null
  if (imdb != null && tmdb != null)    audienceScore = imdb * 0.6 + tmdb * 0.4
  else if (imdb != null)               audienceScore = imdb
  else if (tmdb != null)               audienceScore = tmdb

  if (criticScore != null && audienceScore != null)
    return criticScore * 0.55 + audienceScore * 0.45
  if (criticScore  != null) return criticScore
  if (audienceScore != null) return audienceScore
  return null
}

/**
 * A smooth, asymmetric multiplier keyed to a composite quality score (0–100).
 *
 * Intentionally steep on the downside: bad films are strongly penalised.
 * Intentionally flat at the top: quality nudges great films up slightly
 * but taste still does the primary work among good films.
 *
 *  q    multiplier
 *   0   0.40
 *  20   0.40
 *  40   0.60
 *  60   0.88
 *  70   0.98
 *  78   1.02
 *  90   1.07
 * 100   1.12
 */
export function computeQualityMultiplier(compositeScore: number | null): number {
  if (compositeScore == null) return 0.88  // unknown — mild uncertainty penalty
  const q = compositeScore
  if (q <= 20)  return 0.40
  if (q <= 40)  return 0.40 + (q - 20) / 20 * 0.20   // 0.40 → 0.60
  if (q <= 60)  return 0.60 + (q - 40) / 20 * 0.28   // 0.60 → 0.88
  if (q <= 70)  return 0.88 + (q - 60) / 10 * 0.10   // 0.88 → 0.98
  if (q <= 78)  return 0.98 + (q - 70) / 8  * 0.04   // 0.98 → 1.02
  if (q <= 90)  return 1.02 + (q - 78) / 12 * 0.05   // 1.02 → 1.07
  return Math.min(1.12, 1.07 + (q - 90) / 10 * 0.05) // 1.07 → 1.12
}

/**
 * Apply the quality multiplier to a raw taste score.
 * Clamps to 2–98 to avoid displaying exactly 0 or 100.
 */
export function applyQualityMultiplier(tasteScore: number, compositeQuality: number | null): number {
  return Math.max(2, Math.min(98, Math.round(tasteScore * computeQualityMultiplier(compositeQuality))))
}
