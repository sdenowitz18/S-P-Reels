/**
 * Seeds Paola Juan's library with ~130 watched films.
 * Run with: npx tsx scripts/seed-paola.ts
 *
 * Safe to re-run — uses upsert with conflict on (user_id, film_id, list).
 */
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const POOL = [2.5, 3, 3, 3, 3.5, 3.5, 3.5, 3.5, 4, 4, 4, 4, 4, 4.5, 4.5, 5]

const MY_LINES = [
  'loved every frame of this',
  'not for everyone but I was completely absorbed',
  'exactly what I needed',
  'surprisingly moving',
  'felt long but worth it',
  'one of my favorites',
  "can't stop thinking about it",
  'perfect Sunday film',
  'makes me want to rewatch',
  'cried in the best way',
  'unsettling in all the right ways',
  'overhyped but still enjoyed it',
  'slow start but beautiful ending',
  'the performances carry everything',
  'a bit chaotic but charming',
  'stayed with me for days',
  'not what I expected — in the best way',
  'genuinely funny throughout',
  'a masterclass in tension',
  'warm and specific',
]

const MOODS = [
  'cozy',
  'intense',
  'thought-provoking',
  'emotional',
  'funny',
  'dark',
  'inspiring',
  'nostalgic',
  'slow-burn',
  'mind-bending',
]

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

async function run() {
  // ── Find Paola's user ────────────────────────────────────────────────────────
  const { data: usersPage, error: listErr } = await supabase.auth.admin.listUsers({
    perPage: 1000,
  })
  if (listErr || !usersPage) {
    console.error('failed to list users:', listErr)
    process.exit(1)
  }

  const paola = usersPage.users.find(u => u.email === 'steven@transcendeducation.org')
  if (!paola) {
    console.error('user steven@transcendeducation.org not found')
    process.exit(1)
  }
  console.log(`found user: ${paola.id} (${paola.email})`)

  // ── Fetch films with ai_brief ────────────────────────────────────────────────
  const { data: films, error: filmsErr } = await supabase
    .from('films')
    .select('id')
    .not('ai_brief', 'is', null)
    .limit(500)

  if (filmsErr || !films) {
    console.error('failed to fetch films:', filmsErr)
    process.exit(1)
  }
  console.log(`fetched ${films.length} films with ai_brief`)

  const selected = shuffle(films).slice(0, 130)
  console.log(`seeding ${selected.length} films for Paola...`)

  const now = new Date().toISOString()

  let successCount = 0
  let errorCount = 0

  for (const film of selected) {
    const stars = pick(POOL)

    const useMyLine = Math.random() < 0.2
    const my_line = useMyLine ? pick(MY_LINES) : null

    const useMoods = Math.random() < 0.35
    let moods: string[] | null = null
    if (useMoods) {
      const shuffledMoods = shuffle(MOODS)
      const count = Math.random() < 0.5 ? 1 : 2
      moods = shuffledMoods.slice(0, count)
    }

    const row = {
      user_id: paola.id,
      film_id: film.id,
      list: 'watched',
      my_stars: stars,
      my_line,
      moods,
      finished_at: now,
      added_at: now,
    }

    const { error } = await supabase
      .from('library_entries')
      .upsert(row, { onConflict: 'user_id,film_id,list' })

    if (error) {
      console.error(`  ERROR film ${film.id}:`, error.message)
      errorCount++
    } else {
      console.log(`  OK film ${film.id} — ${stars}★${my_line ? ` "${my_line}"` : ''}${moods ? ` [${moods.join(', ')}]` : ''}`)
      successCount++
    }
  }

  console.log(`\ndone. ${successCount} upserted, ${errorCount} errors.`)
}

run().catch(err => {
  console.error('unexpected error:', err)
  process.exit(1)
})
