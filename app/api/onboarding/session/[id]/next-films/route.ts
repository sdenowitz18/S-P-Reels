/**
 * GET /api/onboarding/session/[id]/next-films
 *
 * Dynamically selects the next batch of calibration films to show the user,
 * targeting dimensions that still lack enough rated films at their extremes.
 *
 * Algorithm:
 *   1. Read the session transcript to find already-shown film IDs + ratings.
 *   2. For each of the 24 poles (12 dims × 2 poles), count how many non-skip
 *      films the user has rated in the extreme zone (score ≤ LEFT_MAX or ≥ RIGHT_MIN).
 *   3. Find poles with coverage < MIN_FILMS_PER_POLE.
 *   4. Query DB for films that are extreme on those poles, excluding shown films.
 *   5. Score candidates by how many uncovered poles they help — maximises efficiency.
 *   6. Return top BATCH_SIZE films, balanced across uncovered poles.
 *
 * Response:
 *   { films: FilmCandidate[], allCovered: boolean }
 *
 * allCovered: true means every pole has ≥ MIN_FILMS_PER_POLE ratings — the
 * caller should proceed to the interview even without user action.
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { FilmDimensionsV2 } from '@/lib/prompts/film-brief'
import { ALL_POLES } from '@/lib/taste-code'
import { posterUrl } from '@/lib/types'

// ── Constants ─────────────────────────────────────────────────────────────────

const MIN_FILMS_PER_POLE = 3   // how many non-skip ratings we need at each extreme
const LEFT_MAX           = 30  // score ≤ this is "left extreme"
const RIGHT_MIN          = 70  // score ≥ this is "right extreme"
const BATCH_SIZE         = 8   // films per batch shown to user

// ── Types ─────────────────────────────────────────────────────────────────────

export interface FilmCandidate {
  film_id:      string
  title:        string
  year:         number | null
  poster_url:   string | null
  kind:         'movie' | 'tv'
  dimensions_v2: FilmDimensionsV2
}

type DimKey = keyof FilmDimensionsV2

// ── Route ─────────────────────────────────────────────────────────────────────

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { data: session } = await supabase
    .from('taste_interview_sessions')
    .select('id, status, transcript')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!session) return NextResponse.json({ error: 'not found' }, { status: 404 })

  // ── 1. Extract shown film IDs and ratings from transcript ─────────────────

  type TranscriptEntry = {
    type: string
    film_id: string
    label: string
    stars: number
    dimensions_v2?: FilmDimensionsV2
  }

  const transcript = (session.transcript ?? []) as TranscriptEntry[]
  const calibEntries = transcript.filter(e => e.type === 'calibration_rating')

  const shownIds   = new Set(calibEntries.map(e => e.film_id))
  const ratedMap   = new Map<string, { label: string; stars: number; dims?: FilmDimensionsV2 }>()

  for (const e of calibEntries) {
    ratedMap.set(e.film_id, { label: e.label, stars: e.stars, dims: e.dimensions_v2 })
  }

  // ── 2. Compute current pole coverage ──────────────────────────────────────

  // For each pole, how many non-skip films has the user rated in the extreme zone?
  const dimKeys = [...new Set(ALL_POLES.map(p => p.dimKey))] as DimKey[]

  type PoleKey = `${string}:left` | `${string}:right`
  const coverage = new Map<PoleKey, number>()

  for (const dimKey of dimKeys) {
    coverage.set(`${dimKey}:left`, 0)
    coverage.set(`${dimKey}:right`, 0)
  }

  // We need the dimensions_v2 of rated films — stored in transcript (if we saved them)
  // OR we can re-query the DB for them. Use transcript first for speed.
  for (const [filmId, rating] of ratedMap) {
    if (rating.stars === 0) continue  // skip
    const dims = rating.dims
    if (!dims) continue

    for (const dimKey of dimKeys) {
      const score = dims[dimKey]
      if (score <= LEFT_MAX) {
        const k: PoleKey = `${dimKey}:left`
        coverage.set(k, (coverage.get(k) ?? 0) + 1)
      }
      if (score >= RIGHT_MIN) {
        const k: PoleKey = `${dimKey}:right`
        coverage.set(k, (coverage.get(k) ?? 0) + 1)
      }
    }
  }

  // ── 3. Find uncovered poles ───────────────────────────────────────────────

  const uncoveredPoles = new Set<PoleKey>()
  for (const [pole, count] of coverage) {
    if (count < MIN_FILMS_PER_POLE) uncoveredPoles.add(pole as PoleKey)
  }

  if (uncoveredPoles.size === 0) {
    return NextResponse.json({ films: [], allCovered: true })
  }

  // ── 4. Query DB for candidate films ──────────────────────────────────────

  // Fetch a generous pool — we'll filter and rank client-side
  // We pull films with dimensions_v2, excluding already-shown ones
  const { data: rawFilms, error } = await supabase
    .from('films')
    .select('id, title, year, poster_path, kind, ai_brief')
    .not('ai_brief->dimensions_v2', 'is', null)
    .limit(2000)

  if (error || !rawFilms) {
    return NextResponse.json({ error: 'failed to fetch films' }, { status: 500 })
  }

  // ── 5. Score and rank candidates ─────────────────────────────────────────

  type ScoredCandidate = FilmCandidate & { coverageScore: number }

  const candidates: ScoredCandidate[] = []

  for (const film of rawFilms) {
    if (shownIds.has(film.id)) continue  // already shown

    const dims = (film.ai_brief as { dimensions_v2?: FilmDimensionsV2 } | null)?.dimensions_v2
    if (!dims) continue

    // How many uncovered poles does this film help with?
    let coverageScore = 0
    for (const dimKey of dimKeys) {
      const score = dims[dimKey]
      const leftKey:  PoleKey = `${dimKey}:left`
      const rightKey: PoleKey = `${dimKey}:right`
      if (score <= LEFT_MAX  && uncoveredPoles.has(leftKey))  coverageScore++
      if (score >= RIGHT_MIN && uncoveredPoles.has(rightKey)) coverageScore++
    }

    if (coverageScore === 0) continue  // doesn't help any uncovered pole

    candidates.push({
      film_id:      film.id,
      title:        film.title ?? '',
      year:         film.year ?? null,
      poster_url:   film.poster_path ? posterUrl(film.poster_path, 'w342') : null,
      kind:         (film.kind ?? 'movie') as 'movie' | 'tv',
      dimensions_v2: dims,
      coverageScore,
    })
  }

  // Sort by coverage efficiency (most helpful first), then shuffle within same score
  // to avoid always returning the same films
  candidates.sort((a, b) => {
    if (b.coverageScore !== a.coverageScore) return b.coverageScore - a.coverageScore
    return Math.random() - 0.5
  })

  // ── 6. Pick a balanced batch ──────────────────────────────────────────────

  // Target ~20% TV shows in each batch (at least 1-2 per batch of 8)
  const TV_TARGET = Math.max(1, Math.round(BATCH_SIZE * 0.2))

  // Greedily pick films, tracking how many we've picked per uncovered pole
  // to ensure the batch covers as many distinct poles as possible
  const batchPoleCount = new Map<PoleKey, number>()
  const batch: FilmCandidate[] = []
  const MAX_PER_POLE_IN_BATCH = 2  // don't stack too many films on the same pole

  // Separate candidates into TV and movies, preserving coverage-score order
  const tvCandidates    = candidates.filter(c => c.kind === 'tv')
  const movieCandidates = candidates.filter(c => c.kind !== 'tv')

  // First pass: fill TV slots
  function tryAdd(candidate: ScoredCandidate): boolean {
    const dims = candidate.dimensions_v2
    let useful = false
    for (const dimKey of dimKeys) {
      const score = dims[dimKey]
      const leftKey:  PoleKey = `${dimKey}:left`
      const rightKey: PoleKey = `${dimKey}:right`
      if (score <= LEFT_MAX  && uncoveredPoles.has(leftKey)  && (batchPoleCount.get(leftKey)  ?? 0) < MAX_PER_POLE_IN_BATCH) useful = true
      if (score >= RIGHT_MIN && uncoveredPoles.has(rightKey) && (batchPoleCount.get(rightKey) ?? 0) < MAX_PER_POLE_IN_BATCH) useful = true
    }
    if (!useful) return false
    for (const dimKey of dimKeys) {
      const score = dims[dimKey]
      if (score <= LEFT_MAX)  { const k: PoleKey = `${dimKey}:left`;  batchPoleCount.set(k, (batchPoleCount.get(k) ?? 0) + 1) }
      if (score >= RIGHT_MIN) { const k: PoleKey = `${dimKey}:right`; batchPoleCount.set(k, (batchPoleCount.get(k) ?? 0) + 1) }
    }
    const { coverageScore: _, ...film } = candidate
    batch.push(film)
    return true
  }

  // Reserve TV slots first (up to TV_TARGET)
  for (const candidate of tvCandidates) {
    if (batch.filter(f => f.kind === 'tv').length >= TV_TARGET) break
    if (batch.length >= BATCH_SIZE) break
    tryAdd(candidate)
  }

  // Fill remaining slots with movies (and any remaining TV if movies run short)
  for (const candidate of [...movieCandidates, ...tvCandidates]) {
    if (batch.length >= BATCH_SIZE) break
    if (batch.some(f => f.film_id === candidate.film_id)) continue  // already in batch
    tryAdd(candidate)
  }

  // Coverage progress for UI
  const totalPoles   = coverage.size
  const coveredPoles = totalPoles - uncoveredPoles.size

  return NextResponse.json({
    films:       batch,
    allCovered:  false,
    coveredPoles,
    totalPoles,
    // If we have no candidates left (pool exhausted), signal ready even if not all covered
    poolExhausted: batch.length === 0,
  })
}
