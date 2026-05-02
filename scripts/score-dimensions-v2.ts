/**
 * Backfills dimensions_v2 for all films that have an ai_brief but no dimensions_v2.
 * Scores each film on the 12 new cinematic dimensions (0–100 scale).
 *
 * Run with: npx tsx scripts/score-dimensions-v2.ts
 *
 * Safe to re-run — skips films that already have dimensions_v2.
 * Use --force to re-score all films.
 * Use --film "Title" to score a single film by title (partial match, case-insensitive).
 * Use --sample to print a side-by-side comparison of old and new dimensions for the first 3 films.
 */
import * as dotenv from 'dotenv'
import * as path from 'path'
dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

import { createClient } from '@supabase/supabase-js'
import { scoreFilmDimensionsV2, FilmDimensionsV2 } from '../lib/prompts/film-brief'
import { Film } from '../lib/types'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const DIM_V2_LABELS: Record<keyof FilmDimensionsV2, string> = {
  narrative_legibility:    'Narrative Legibility   (0=legible    ↔ 100=opaque)',
  emotional_directness:    'Emotional Directness   (0=direct     ↔ 100=restrained)',
  plot_vs_character:       'Plot vs Character      (0=plot       ↔ 100=character)',
  naturalistic_vs_stylized:'Naturalistic/Stylized  (0=natural    ↔ 100=stylized)',
  narrative_closure:       'Narrative Closure      (0=closes     ↔ 100=ambiguous)',
  intimate_vs_epic:        'Intimate vs Epic       (0=intimate   ↔ 100=epic)',
  accessible_vs_demanding: 'Accessible/Demanding   (0=accessible ↔ 100=demanding)',
  psychological_safety:    'Psychological Safety   (0=safe       ↔ 100=provocative)',
  moral_clarity:           'Moral Clarity          (0=clear      ↔ 100=ambiguous)',
  behavioral_realism:      'Behavioral Realism     (0=realistic  ↔ 100=archetypal)',
  sensory_vs_intellectual: 'Sensory/Intellectual   (0=sensory    ↔ 100=intellectual)',
  kinetic_vs_patient:      'Kinetic vs Patient     (0=kinetic    ↔ 100=patient)',
}

const DIM_V1_LABELS: Record<string, string> = {
  pace:         'Pace         (-1=kinetic  ↔ +1=slow-burn)',
  story_engine: 'Story Engine (-1=plot     ↔ +1=character)',
  tone:         'Tone         (-1=comedic  ↔ +1=serious)',
  warmth:       'Warmth       (-1=cold     ↔ +1=warm)',
  complexity:   'Complexity   (-1=simple   ↔ +1=layered)',
  style:        'Style        (-1=restrained ↔ +1=expressive)',
}

function renderBar(score: number, scale: 'v1' | 'v2'): string {
  const WIDTH = 20
  if (scale === 'v1') {
    // -1 to +1, center at 10
    const pos = Math.round(((score + 1) / 2) * WIDTH)
    const bar = Array(WIDTH).fill('─')
    bar[10] = '┼'
    bar[Math.min(WIDTH - 1, Math.max(0, pos))] = '●'
    return `[${bar.join('')}] ${score >= 0 ? '+' : ''}${score.toFixed(2)}`
  } else {
    // 0 to 100
    const pos = Math.round((score / 100) * WIDTH)
    const bar = Array(WIDTH).fill('─')
    bar[Math.min(WIDTH - 1, Math.max(0, pos))] = '●'
    return `[${bar.join('')}] ${score}`
  }
}

async function run() {
  const force = process.argv.includes('--force')
  const sampleMode = process.argv.includes('--sample')
  const filmArg = process.argv.find((a, i) => process.argv[i - 1] === '--film')

  // Fetch films with ai_brief
  let query = supabase.from('films').select('*').not('ai_brief', 'is', null)

  if (filmArg) {
    query = query.ilike('title', `%${filmArg}%`)
  }

  const { data: films, error } = await query

  if (error || !films) {
    console.error('failed to fetch films:', error)
    process.exit(1)
  }

  // Filter to those missing dimensions_v2 unless --force
  const toProcess = force || filmArg
    ? films
    : films.filter(f => {
        const brief = f.ai_brief as { dimensions_v2?: unknown } | null
        return !brief?.dimensions_v2
      })

  if (toProcess.length === 0) {
    console.log('✓ all films already have dimensions_v2 — run with --force to re-score\n')
    return
  }

  console.log(`\nfound ${toProcess.length} film(s) to score${force ? ' (--force: re-scoring all)' : ''}:\n`)
  toProcess.slice(0, 10).forEach(f => console.log(`  · ${f.title} (${f.year ?? '?'})`))
  if (toProcess.length > 10) console.log(`  · ... and ${toProcess.length - 10} more`)
  console.log()

  let succeeded = 0
  let failed = 0
  const limit = sampleMode ? 3 : toProcess.length

  for (const film of toProcess.slice(0, limit)) {
    console.log(`─────────────────────────────────────────────────────`)
    console.log(`▶ ${film.title} (${film.year ?? 'unknown'}, dir. ${film.director ?? 'unknown'})`)

    try {
      const v2 = await scoreFilmDimensionsV2(film as Film)

      if (!v2) {
        console.log(`  ✗ null result — skipping`)
        failed++
        continue
      }

      if (sampleMode) {
        // Print side-by-side comparison — do NOT save in sample mode
        const brief = film.ai_brief as { dimensions?: Record<string, number> } | null
        const v1 = brief?.dimensions

        console.log(`\n  ── OLD (6 dimensions, −1 to +1) ──`)
        if (v1) {
          for (const [k, label] of Object.entries(DIM_V1_LABELS)) {
            const val = v1[k] ?? 0
            console.log(`    ${label}`)
            console.log(`    ${renderBar(val, 'v1')}`)
          }
        } else {
          console.log('    (no v1 dimensions)')
        }

        console.log(`\n  ── NEW (12 dimensions, 0 to 100) ──`)
        for (const [k, label] of Object.entries(DIM_V2_LABELS)) {
          const val = v2[k as keyof FilmDimensionsV2]
          console.log(`    ${label}`)
          console.log(`    ${renderBar(val, 'v2')}`)
        }
        console.log()
        succeeded++
        continue  // skip save in sample mode
      }

      // Compact log
      const summary = Object.entries(v2)
        .map(([k, v]) => `${k.split('_')[0]}:${v}`)
        .join(' ')
      console.log(`  scores: ${summary}`)

      // Save dimensions_v2 into existing ai_brief
      const existingBrief = (film.ai_brief ?? {}) as Record<string, unknown>
      const updatedBrief = { ...existingBrief, dimensions_v2: v2 }

      const { error: saveErr } = await supabase
        .from('films')
        .update({ ai_brief: updatedBrief })
        .eq('id', film.id)

      if (saveErr) {
        console.log(`  ✗ save failed: ${saveErr.message}`)
        failed++
        continue
      }

      console.log(`  ✓ saved`)
      succeeded++
    } catch (err: unknown) {
      const isQuotaError = (err as { code?: string })?.code === 'insufficient_quota'
      if (isQuotaError) {
        console.error(`\n  ✗ OpenAI quota exhausted — add credits at platform.openai.com/settings/billing`)
        console.error(`    re-run after adding credits to resume (already-saved scores are preserved)\n`)
        break
      }
      console.error(`  ✗ error:`, err)
      failed++
    }

    // Gentle pause between calls
    await new Promise(r => setTimeout(r, 600))
  }

  console.log(`\n─────────────────────────────────────────────────────`)
  if (sampleMode) {
    console.log(`sample complete. ${succeeded} films scored (not all saved in sample mode — rerun without --sample to process all).\n`)
  } else {
    console.log(`done. ${succeeded} succeeded, ${failed} failed.\n`)
  }
}

run()
