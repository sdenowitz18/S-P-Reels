/**
 * Re-rates Paola's library entries so her ratings correlate strongly with
 * a specific taste profile — creating a genuinely distinct radar from Steven's.
 *
 * Paola's target: light/comedic, warm/emotional, accessible, kinetic, expressive
 * (designed to diverge clearly on tone, complexity, warmth from a darker/slower viewer)
 *
 * Algorithm:
 *   fitScore = dot product of film dimensions with target vector (normalised)
 *   stars    = clamp(round_half(3.5 + 2.0 * fitScore + noise), 2.0, 5.0)
 *
 * Films that match her profile → 4.5–5★
 * Neutral films               → 3–3.5★
 * Films that oppose her       → 2–2.5★
 *
 * Run with: npx tsx scripts/reseed-paola-taste.ts
 */
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Paola's taste target — deliberately distinct from a darker/slower/complex profile
const TARGET = {
  tone:         -0.65,  // strongly light / comedic (not dark)
  warmth:       +0.70,  // very warm / emotionally open
  complexity:   -0.55,  // accessible, not demanding
  pace:         +0.45,  // kinetic, forward-moving
  story_engine: -0.35,  // leans character-driven
  style:        +0.40,  // expressive / visually engaged
}

const DIMS = Object.keys(TARGET) as (keyof typeof TARGET)[]

/** Cosine-ish dot product — both vectors assumed to be in [-1,1] */
function fitScore(filmDims: Record<string, number>): number {
  let dot = 0
  let norm = 0
  for (const d of DIMS) {
    dot  += (filmDims[d] ?? 0) * TARGET[d]
    norm += Math.abs(TARGET[d])
  }
  return norm > 0 ? dot / norm : 0  // result in [-1, 1]
}

/** Round to nearest 0.5 */
function roundHalf(n: number): number {
  return Math.round(n * 2) / 2
}

/** Map fit score to a star rating with small noise */
function scoreToStars(score: number): number {
  // score in [-1, 1] → raw stars in [1.5, 5.5]
  const noise = (Math.random() - 0.5) * 0.6   // ±0.3 noise
  const raw   = 3.5 + 2.0 * score + noise
  return Math.min(5, Math.max(2, roundHalf(raw)))
}

async function run() {
  // ── Find Paola's user ────────────────────────────────────────────────────────
  const { data: usersPage, error: listErr } = await supabase.auth.admin.listUsers({ perPage: 1000 })
  if (listErr || !usersPage) { console.error('failed to list users:', listErr); process.exit(1) }

  const paola = usersPage.users.find(u => u.email === 'steven@transcendeducation.org')
  if (!paola) { console.error('user steven@transcendeducation.org not found'); process.exit(1) }
  console.log(`found user: ${paola.id} (${paola.email})`)

  // ── Fetch films with ai_brief dimensions ──────────────────────────────────────
  const { data: films, error: filmsErr } = await supabase
    .from('films')
    .select('id, title, ai_brief')
    .not('ai_brief', 'is', null)
    .limit(600)

  if (filmsErr || !films) { console.error('failed to fetch films:', filmsErr); process.exit(1) }

  // Only keep films that have actual dimension data
  const withDims = films.filter(f => {
    const dims = (f.ai_brief as { dimensions?: Record<string, number> } | null)?.dimensions
    return dims && Object.keys(dims).length >= 4
  })
  console.log(`${withDims.length} films have dimension data`)

  // ── Score every film against Paola's target ────────────────────────────────
  const scored = withDims.map(f => {
    const dims = (f.ai_brief as { dimensions: Record<string, number> }).dimensions
    return { id: f.id, title: f.title as string, score: fitScore(dims) }
  }).sort((a, b) => b.score - a.score)

  // ── Select 130 films: spread across the spectrum for richness ─────────────
  // Top 60 (good fits), middle 40 (neutral), bottom 30 (bad fits) — Paola has
  // seen things she doesn't love, which makes the vector more distinctive.
  const top    = scored.slice(0, 60)
  const middle = scored.slice(Math.floor(scored.length / 2) - 20, Math.floor(scored.length / 2) + 20)
  const bottom = scored.slice(-30)
  const selected = [...top, ...middle, ...bottom]
  console.log(`selected ${selected.length} films (60 good-fit, 40 neutral, 30 poor-fit)`)

  const now = new Date().toISOString()
  let ok = 0, err = 0

  for (const film of selected) {
    const stars = scoreToStars(film.score)

    const { error } = await supabase
      .from('library_entries')
      .upsert({
        user_id:     paola.id,
        film_id:     film.id,
        list:        'watched',
        my_stars:    stars,
        my_line:     null,
        moods:       null,
        finished_at: now,
        added_at:    now,
      }, { onConflict: 'user_id,film_id,list' })

    if (error) {
      console.error(`  ERROR ${film.title}:`, error.message)
      err++
    } else {
      const bar = '█'.repeat(Math.round((film.score + 1) * 5)) + '░'.repeat(10 - Math.round((film.score + 1) * 5))
      console.log(`  ${stars}★  [${bar}] ${film.score.toFixed(2)}  ${film.title}`)
      ok++
    }
  }

  console.log(`\ndone. ${ok} upserted, ${err} errors.`)
  console.log(`\nPaola's target profile:`)
  for (const [d, v] of Object.entries(TARGET)) {
    const bar = v > 0
      ? `${'·'.repeat(5)}${'█'.repeat(Math.round(v * 5))}`
      : `${'█'.repeat(Math.round(Math.abs(v) * 5))}${'·'.repeat(5)}`
    console.log(`  ${d.padEnd(14)} ${bar}  ${v > 0 ? '+' : ''}${v.toFixed(2)}`)
  }
}

run().catch(err => { console.error('unexpected error:', err); process.exit(1) })
