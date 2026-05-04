/**
 * Analyzes match score distribution across all users.
 *
 * Run: npx tsx scripts/analyze-match-scores.ts
 */
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

import { computeTasteCode, RatedFilmEntry } from '../lib/taste-code'
import { computeMatchScore, applyQualityMultiplier, computeCompositeQuality, MATCH_SCORE_MIN_FILMS } from '../lib/taste/match-score'
import type { FilmDimensionsV2 } from '../lib/prompts/film-brief'
import { posterUrl } from '../lib/types'

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function histogram(scores: number[], bucketSize = 5): string {
  const buckets: Record<number, number> = {}
  for (let i = 0; i <= 100; i += bucketSize) buckets[i] = 0
  for (const s of scores) {
    const bucket = Math.floor(s / bucketSize) * bucketSize
    buckets[Math.min(bucket, 100 - bucketSize)]++
  }
  const maxCount = Math.max(...Object.values(buckets))
  const barWidth = 30
  const lines = Object.entries(buckets).map(([lo, count]) => {
    const hi = parseInt(lo) + bucketSize
    const bar = '█'.repeat(Math.round((count / maxCount) * barWidth))
    const pct = ((count / scores.length) * 100).toFixed(1)
    return `  ${lo.padStart(2)}–${String(hi).padStart(3)}: ${bar.padEnd(barWidth)} ${count} (${pct}%)`
  })
  return lines.join('\n')
}

function stats(scores: number[]) {
  if (scores.length === 0) return { min: 0, max: 0, mean: 0, median: 0, p25: 0, p75: 0, stddev: 0 }
  const sorted = [...scores].sort((a, b) => a - b)
  const mean = scores.reduce((s, x) => s + x, 0) / scores.length
  const variance = scores.reduce((s, x) => s + (x - mean) ** 2, 0) / scores.length
  const stddev = Math.sqrt(variance)
  return {
    min: sorted[0],
    max: sorted[sorted.length - 1],
    mean: Math.round(mean * 10) / 10,
    median: sorted[Math.floor(sorted.length / 2)],
    p25: sorted[Math.floor(sorted.length * 0.25)],
    p75: sorted[Math.floor(sorted.length * 0.75)],
    stddev: Math.round(stddev * 10) / 10,
  }
}

async function main() {
  // 1. Fetch all films with dimensions
  console.log('Fetching films...')
  const { data: films, error: filmErr } = await sb
    .from('films')
    .select('id, title, year, ai_brief, tmdb_vote_average, tmdb_vote_count, imdb_rating, rt_score, metacritic')
    .not('ai_brief->dimensions_v2', 'is', null)
    .limit(5000)
  if (filmErr) throw filmErr
  console.log(`  ${films!.length} films with dimensions_v2\n`)

  // 2. Fetch all users with library entries
  console.log('Fetching users...')
  const { data: allEntries } = await sb
    .from('library_entries')
    .select('user_id, film_id, list, my_stars, film:films(title, poster_path, ai_brief)')
  if (!allEntries) { console.log('No library entries'); return }

  // Group by user
  type LibEntry = {
    user_id: string; film_id: string; list: string; my_stars: number | null
    film: { title: string; poster_path: string | null; ai_brief: { dimensions_v2?: FilmDimensionsV2 } | null } | null
  }
  const byUser = new Map<string, LibEntry[]>()
  for (const e of allEntries as unknown as LibEntry[]) {
    if (!byUser.has(e.user_id)) byUser.set(e.user_id, [])
    byUser.get(e.user_id)!.push(e)
  }
  console.log(`  ${byUser.size} users with library entries\n`)

  // 3. Per-user analysis
  for (const [userId, lib] of byUser) {
    const ratedWithDims = lib.filter(
      e => e.list === 'watched' && e.my_stars != null && e.film?.ai_brief?.dimensions_v2
    )
    const totalWatched = lib.filter(e => e.list === 'watched' && e.my_stars != null).length

    if (ratedWithDims.length < MATCH_SCORE_MIN_FILMS) {
      console.log(`User ${userId.slice(0,8)}: only ${ratedWithDims.length} rated films with dims (need ${MATCH_SCORE_MIN_FILMS}) — skipping`)
      continue
    }

    const tasteCodeFilms: RatedFilmEntry[] = ratedWithDims.map(e => ({
      film_id: e.film_id,
      title: e.film?.title ?? '',
      poster_path: e.film?.poster_path ? posterUrl(e.film.poster_path, 'w185') : null,
      stars: e.my_stars as number,
      dimensions_v2: e.film!.ai_brief!.dimensions_v2 as FilmDimensionsV2,
    }))
    const tc = computeTasteCode(tasteCodeFilms)
    if (!tc) continue

    // Compute scores for all films (taste + quality-adjusted)
    type FilmRow = typeof films extends (infer T)[] | null ? T : never
    type ScoredFilm = { film: FilmRow; tasteScore: number; matchScore: number }
    const scored: ScoredFilm[] = []
    for (const f of films!) {
      const dims = (f as any).ai_brief?.dimensions_v2
      if (!dims) continue
      const tasteScore = computeMatchScore(tc, dims)
      const compositeQuality = computeCompositeQuality({
        tmdbVoteAverage: (f as any).tmdb_vote_average,
        tmdbVoteCount:   (f as any).tmdb_vote_count,
        imdbRating:      (f as any).imdb_rating,
        rtScore:         (f as any).rt_score,
        metacritic:      (f as any).metacritic,
      })
      const matchScore = applyQualityMultiplier(tasteScore, compositeQuality)
      scored.push({ film: f, tasteScore, matchScore })
    }

    const tasteScores  = scored.map(s => s.tasteScore)
    const matchScores  = scored.map(s => s.matchScore)
    const st = stats(tasteScores)
    const sm = stats(matchScores)

    console.log(`━━━ User ${userId.slice(0,8)} ━━━`)
    console.log(`  Rated: ${ratedWithDims.length} films with dims (${totalWatched} total watched)`)
    console.log(`  Taste code: ${tc.letters}`)
    console.log(`  Top dims by gap:`)
    for (const e of tc.entries) {
      console.log(`    ${e.letter}/${e.oppLetter} gap=${e.gap.toFixed(1)} (${e.label} vs ${e.oppLabel})`)
    }
    console.log(`\n  Taste score (pure):     min=${st.min}  median=${st.median}  max=${st.max}  σ=${st.stddev}`)
    console.log(`  Match score (×quality): min=${sm.min}  median=${sm.median}  max=${sm.max}  σ=${sm.stddev}`)
    console.log(`\n  Final match score distribution (what users see):`)
    console.log(`\n${histogram(matchScores)}`)

    // Show top-10 and bottom-5 by final match score
    const sortedByMatch = [...scored].sort((a, b) => b.matchScore - a.matchScore)

    console.log(`\n  Top 10 matches:`)
    for (const { film, tasteScore, matchScore } of sortedByMatch.slice(0, 10)) {
      console.log(`    ${matchScore}% (taste ${tasteScore}%)  ${film.title} (${(film as any).year ?? '?'})`)
    }
    console.log(`\n  Bottom 5 matches:`)
    for (const { film, tasteScore, matchScore } of sortedByMatch.slice(-5)) {
      console.log(`    ${matchScore}% (taste ${tasteScore}%)  ${film.title} (${(film as any).year ?? '?'})`)
    }
    console.log()
  }
}

main().catch(console.error)
