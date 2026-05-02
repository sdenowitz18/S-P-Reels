/**
 * Tests three viewer taste scoring approaches against real library data.
 *
 * APPROACH A — Bipolar (one score per dimension, 0–100):
 *   Films at both poles pull against each other. Liking both cancels out → 50.
 *
 * APPROACH B — Independent poles, SD-normalized (two scores per dimension):
 *   Each pole scored independently, normalized using personal mean + stddev.
 *
 * APPROACH C — Independent poles, library-range normalized:
 *   Each pole scored independently, scaled so the weakest pole in the whole
 *   library anchors at 0 and the strongest anchors at 100. Uses the full scale.
 *
 * Run with: npx tsx scripts/taste-dimension-test.ts
 * Run for a specific user: npx tsx scripts/taste-dimension-test.ts --email you@example.com
 */
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ── Dimension definitions ────────────────────────────────────────────────────

const DIMS = [
  { key: 'narrative_legibility',    left: 'Legible',      right: 'Opaque'        },
  { key: 'emotional_directness',    left: 'Direct',       right: 'Restrained'    },
  { key: 'plot_vs_character',       left: 'Plot-driven',  right: 'Char-driven'   },
  { key: 'naturalistic_vs_stylized',left: 'Naturalistic', right: 'Stylized'      },
  { key: 'narrative_closure',       left: 'Closure',      right: 'Ambiguous'     },
  { key: 'intimate_vs_epic',        left: 'Intimate',     right: 'Epic'          },
  { key: 'accessible_vs_demanding', left: 'Accessible',   right: 'Demanding'     },
  { key: 'psychological_safety',    left: 'Safe',         right: 'Provocative'   },
  { key: 'moral_clarity',           left: 'Moral clarity',right: 'Morally ambig' },
  { key: 'behavioral_realism',      left: 'Realistic',    right: 'Archetypal'    },
  { key: 'sensory_vs_intellectual', left: 'Sensory',      right: 'Intellectual'  },
  { key: 'kinetic_vs_patient',      left: 'Kinetic',      right: 'Patient'       },
] as const

type DimKey = typeof DIMS[number]['key']

// ── Thresholds ───────────────────────────────────────────────────────────────

const EXTREME_PCT  = 0.20 // top/bottom 20% of library on each dimension = extreme
const MIN_FILMS    = 3    // minimum films per pole to trust the score

// ── Helpers ──────────────────────────────────────────────────────────────────

function stddev(values: number[]): number {
  if (values.length < 2) return 1
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length
  return Math.sqrt(variance) || 1
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v))
}

// Map a star average to 0–100 using the user's mean and stddev as the ruler.
// personal mean → 50; +1 SD → 75; +2 SD → ~95; -1 SD → 25; etc.
function normalizeToScore(avgRating: number, personalMean: number, personalSd: number): number {
  const z = (avgRating - personalMean) / personalSd
  return clamp(Math.round(50 + z * 25), 0, 100)
}

function bar(score: number, width = 20): string {
  const pos = Math.round((score / 100) * width)
  const b = Array(width).fill('─')
  b[clamp(pos, 0, width - 1)] = '●'
  return b.join('')
}

function label(score: number, leftLabel: string, rightLabel: string): string {
  if (score <= 35) return `leans ${leftLabel}`
  if (score >= 65) return `leans ${rightLabel}`
  return 'middle'
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function run() {
  const emailArg = process.argv.find((a, i) => process.argv[i - 1] === '--email')

  // Find user
  let userId: string
  if (emailArg) {
    const { data: users } = await sb.auth.admin.listUsers()
    const match = users?.users?.find(u => u.email === emailArg)
    if (!match) { console.error(`user not found: ${emailArg}`); process.exit(1) }
    userId = match.id
  } else {
    // Default: first user with library entries
    const { data: entries } = await sb.from('library_entries').select('user_id').limit(1)
    if (!entries?.length) { console.error('no library entries found'); process.exit(1) }
    userId = entries[0].user_id
  }

  const { data: userRow } = await sb.from('users').select('name, email').eq('id', userId).single()
  console.log(`\nUser: ${userRow?.name ?? userRow?.email ?? userId}`)

  // Fetch rated library entries with dimensions_v2
  const { data: entries } = await sb
    .from('library_entries')
    .select('my_stars, film:films(title, year, ai_brief)')
    .eq('user_id', userId)
    .eq('list', 'watched')
    .not('my_stars', 'is', null)

  if (!entries?.length) { console.error('no rated entries'); process.exit(1) }

  // Filter to those with dimensions_v2
  const rated = entries.filter(e => (e.film as any)?.ai_brief?.dimensions_v2)
  const allStars = rated.map(e => e.my_stars as number)
  const personalMean = allStars.reduce((a, b) => a + b, 0) / allStars.length
  const personalSd = stddev(allStars)

  console.log(`Rated films with v2 dimensions: ${rated.length}`)
  console.log(`Personal mean: ${personalMean.toFixed(2)}★  SD: ${personalSd.toFixed(2)}★\n`)

  // ── Compute both approaches ──────────────────────────────────────────────

  console.log('═'.repeat(80))
  console.log('APPROACH A — BIPOLAR (one score per dimension)')
  console.log('Films at both poles pull against each other. Liking both → ~50.')
  console.log('═'.repeat(80))

  for (const dim of DIMS) {
    // Sort by dimension score, take top/bottom 20% of library
    const sorted = [...rated].sort((a, b) =>
      (a.film as any).ai_brief.dimensions_v2[dim.key] - (b.film as any).ai_brief.dimensions_v2[dim.key]
    )
    const cutoff = Math.max(MIN_FILMS, Math.floor(sorted.length * EXTREME_PCT))
    const leftFilms  = sorted.slice(0, cutoff)           // most left-pole
    const rightFilms = sorted.slice(sorted.length - cutoff) // most right-pole

    // Deviation-weighted: each film contributes its deviation × how extreme it is
    // Normalized dim value: 0→-1, 50→0, 100→+1
    let numerator = 0
    let denominator = 0

    for (const e of rated) {
      const dimScore = (e.film as any).ai_brief.dimensions_v2[dim.key] as number
      const stars = e.my_stars as number
      const deviation = stars - personalMean
      if (Math.abs(deviation) < 0.1) continue  // skip near-average ratings
      const normalized = (dimScore - 50) / 50  // -1 to +1
      numerator += deviation * normalized
      denominator += Math.abs(deviation)
    }

    const rawScore = denominator > 0 ? numerator / denominator : 0  // -1 to +1
    const viewerScore = clamp(Math.round(50 + rawScore * 50), 0, 100)
    const lbl = label(viewerScore, dim.left, dim.right)

    const filmNote = `(top ${Math.round(EXTREME_PCT*100)}%: ${leftFilms.length} ${dim.left} / ${rightFilms.length} ${dim.right})`

    console.log(`\n${dim.left.padEnd(14)} ←→ ${dim.right}`)
    console.log(`  [${bar(viewerScore)}] ${viewerScore}  ${lbl}  ${filmNote}`)

    // Show top-rated sample films at each pole
    const showFilms = (films: typeof rated, pole: string) => {
      if (!films.length) return
      const top = [...films]
        .sort((a, b) => (b.my_stars as number) - (a.my_stars as number))
        .slice(0, 3)
        .map(e => `${(e.film as any).title} (${(e.my_stars as number)}★)`)
        .join(', ')
      console.log(`  ${pole}: ${top}`)
    }
    showFilms(leftFilms, dim.left)
    showFilms(rightFilms, dim.right)
  }

  // ── Pre-compute all pole averages for Approaches B and C ───────────────────

  type PoleData = {
    dim: typeof DIMS[number]
    leftFilms: typeof rated
    rightFilms: typeof rated
    leftAvg: number | null
    rightAvg: number | null
  }

  const poleData: PoleData[] = DIMS.map(dim => {
    const sorted = [...rated].sort((a, b) =>
      (a.film as any).ai_brief.dimensions_v2[dim.key] - (b.film as any).ai_brief.dimensions_v2[dim.key]
    )
    const cutoff = Math.max(MIN_FILMS, Math.floor(sorted.length * EXTREME_PCT))
    const leftFilms  = sorted.slice(0, cutoff)
    const rightFilms = sorted.slice(sorted.length - cutoff)
    const avg = (films: typeof rated) =>
      films.length >= MIN_FILMS
        ? films.reduce((s, e) => s + (e.my_stars as number), 0) / films.length
        : null
    return { dim, leftFilms, rightFilms, leftAvg: avg(leftFilms), rightAvg: avg(rightFilms) }
  })

  // For Approach C: find the global min and max average across all poles
  const allAvgs = poleData.flatMap(p => [p.leftAvg, p.rightAvg]).filter((v): v is number => v != null)
  const globalMin = Math.min(...allAvgs)
  const globalMax = Math.max(...allAvgs)
  const rangeScale = (avg: number) =>
    globalMax === globalMin ? 50 : Math.round(((avg - globalMin) / (globalMax - globalMin)) * 100)

  // ── Interpretation helper (shared) ──────────────────────────────────────────

  function interpret(leftScore: number | null, rightScore: number | null, dim: typeof DIMS[number], threshold: number): string {
    if (leftScore == null || rightScore == null) return 'insufficient data'
    const bothHigh = leftScore >= 60 && rightScore >= 60
    const bothLow  = leftScore <= 40 && rightScore <= 40
    const gap      = Math.abs(leftScore - rightScore)
    if (bothHigh)          return '⟷  responds to both (split)'
    if (bothLow)           return '·   indifferent to both extremes'
    if (gap >= threshold)  return rightScore > leftScore
      ? `→  prefers ${dim.right}`
      : `←  prefers ${dim.left}`
    return '~   lean'
  }

  // ── Approach B — SD-normalized ───────────────────────────────────────────────

  console.log('\n\n' + '═'.repeat(80))
  console.log('APPROACH B — INDEPENDENT POLES, SD-NORMALIZED')
  console.log(`Personal mean ${personalMean.toFixed(2)}★ → 50. Each SD (${personalSd.toFixed(2)}★) = 25 points.`)
  console.log('═'.repeat(80))

  for (const { dim, leftFilms, rightFilms, leftAvg, rightAvg } of poleData) {
    const leftScore  = leftAvg  != null ? normalizeToScore(leftAvg,  personalMean, personalSd) : null
    const rightScore = rightAvg != null ? normalizeToScore(rightAvg, personalMean, personalSd) : null
    const interp = interpret(leftScore, rightScore, dim, 15)

    const fmt = (score: number | null, avg: number | null, n: number) =>
      score != null
        ? `${score.toString().padStart(3)}  [${bar(score)}]  ${avg!.toFixed(2)}★  (${n} films)`
        : '  —  (too few films)'

    console.log(`\n${dim.left.padEnd(14)} ←→ ${dim.right}`)
    console.log(`  ${dim.left.padEnd(14)}: ${fmt(leftScore, leftAvg, leftFilms.length)}`)
    console.log(`  ${dim.right.padEnd(14)}: ${fmt(rightScore, rightAvg, rightFilms.length)}`)
    console.log(`  ${interp}`)
  }

  // ── Approach C — Library-range normalized ────────────────────────────────────

  console.log('\n\n' + '═'.repeat(80))
  console.log('APPROACH C — INDEPENDENT POLES, LIBRARY-RANGE NORMALIZED')
  console.log(`Worst avg in library (${globalMin.toFixed(2)}★) → 0. Best avg (${globalMax.toFixed(2)}★) → 100.`)
  console.log('Full scale used. Differences are amplified relative to your actual range.')
  console.log('═'.repeat(80))

  for (const { dim, leftFilms, rightFilms, leftAvg, rightAvg } of poleData) {
    const leftScore  = leftAvg  != null ? rangeScale(leftAvg)  : null
    const rightScore = rightAvg != null ? rangeScale(rightAvg) : null
    const interp = interpret(leftScore, rightScore, dim, 15)

    const fmt = (score: number | null, avg: number | null, n: number) =>
      score != null
        ? `${score.toString().padStart(3)}  [${bar(score)}]  ${avg!.toFixed(2)}★  (${n} films)`
        : '  —  (too few films)'

    console.log(`\n${dim.left.padEnd(14)} ←→ ${dim.right}`)
    console.log(`  ${dim.left.padEnd(14)}: ${fmt(leftScore, leftAvg, leftFilms.length)}`)
    console.log(`  ${dim.right.padEnd(14)}: ${fmt(rightScore, rightAvg, rightFilms.length)}`)
    console.log(`  ${interp}`)
  }

  console.log('\n')
}

run().catch(console.error)
