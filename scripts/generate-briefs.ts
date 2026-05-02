/**
 * Generates ai_brief for every film in the library that doesn't have one yet.
 * Run with: npx tsx scripts/generate-briefs.ts
 *
 * Safe to re-run — skips films that already have a brief.
 * Processes one at a time to avoid OpenAI rate limits.
 */
import * as dotenv from 'dotenv'
import * as path from 'path'
dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

import { createClient } from '@supabase/supabase-js'
import { generateFilmBrief } from '../lib/prompts/film-brief'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function run() {
  // Get all distinct film_ids in library_entries
  const { data: entries, error: entriesErr } = await supabase
    .from('library_entries')
    .select('film_id')

  if (entriesErr || !entries) {
    console.error('failed to fetch library entries:', entriesErr)
    process.exit(1)
  }

  const filmIds = [...new Set(entries.map(e => e.film_id))]
  console.log(`\nfound ${filmIds.length} unique films in library`)

  // --force flag regenerates all briefs even if they already exist
  const force = process.argv.includes('--force')

  // Fetch films — skip those with a brief unless --force
  const filmsQuery = supabase.from('films').select('*').in('id', filmIds)
  if (!force) filmsQuery.is('ai_brief', null)
  const { data: films, error: filmsErr } = await filmsQuery

  if (filmsErr || !films) {
    console.error('failed to fetch films:', filmsErr)
    process.exit(1)
  }

  if (films.length === 0) {
    console.log('✓ all films already have briefs — run with --force to regenerate\n')
    return
  }

  console.log(`${films.length} film(s) to process${force ? ' (--force: regenerating all)' : ''}:\n`)
  films.forEach(f => console.log(`  · ${f.title} (${f.year ?? '?'})`))
  console.log()

  let succeeded = 0
  let failed = 0

  for (const film of films) {
    console.log(`─────────────────────────────────────────`)
    console.log(`▶ ${film.title} (${film.year ?? 'unknown'})`)

    try {
      const brief = await generateFilmBrief(film)

      if (!brief) {
        console.log(`  ✗ null result — skipping`)
        failed++
        continue
      }

      const { error: saveErr } = await supabase
        .from('films')
        .update({ ai_brief: brief, brief_at: new Date().toISOString() })
        .eq('id', film.id)

      if (saveErr) {
        console.log(`  ✗ save failed: ${saveErr.message}`)
        failed++
        continue
      }

      console.log(`  ✓ done — tone: ${brief.tone}`)
      console.log(`          genres: ${(brief.genres ?? []).join(', ')}`)
      console.log(`          question: ${brief.emotional_question}`)
      succeeded++
    } catch (err: unknown) {
      // Quota exhausted — no point continuing, every call will fail
      const isQuotaError = (err as { code?: string })?.code === 'insufficient_quota'
      if (isQuotaError) {
        console.error(`\n  ✗ OpenAI quota exhausted — add credits at platform.openai.com/settings/billing`)
        console.error(`    re-run this script after adding credits to resume (already-completed briefs are saved)\n`)
        break
      }
      console.error(`  ✗ error:`, err)
      failed++
    }

    // Small pause between calls to be gentle on the OpenAI rate limit
    await new Promise(r => setTimeout(r, 500))
  }

  console.log(`\n─────────────────────────────────────────`)
  console.log(`done. ${succeeded} succeeded, ${failed} failed.\n`)
}

run()
