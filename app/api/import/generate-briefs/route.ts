import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateFilmBrief, scoreFilmDimensionsV2 } from '@/lib/prompts/film-brief'

// Generates dimensions_v2 for a user's RATED films that don't have it yet.
// Only rated films (stars > 0) affect the taste code — no point enriching
// films the user only marked as watched without a rating.
//
// Processes up to MAX_FILMS in batches of CONCURRENCY to stay fast.
// Stores dimensions_v2 inside ai_brief (consistent with seed script + reveal route).

const CONCURRENCY = 4   // parallel OpenAI calls
const MAX_FILMS   = 80  // cap for initial run — enough for a solid taste code

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  // Only fetch RATED entries (stars > 0) — unrated films don't affect taste code
  const { data: entries } = await supabase
    .from('library_entries')
    .select('film_id')
    .eq('user_id', user.id)
    .gt('stars', 0)

  if (!entries?.length) return NextResponse.json({ generated: 0 })

  const filmIds = [...new Set(entries.map(e => e.film_id))]

  const { data: films } = await supabase
    .from('films')
    .select('*')
    .in('id', filmIds)

  if (!films?.length) return NextResponse.json({ generated: 0 })

  // Only films missing dimensions_v2 inside ai_brief
  const toEnrich = films
    .filter(f => {
      const brief = f.ai_brief as { dimensions_v2?: unknown } | null
      return !brief?.dimensions_v2
    })
    .slice(0, MAX_FILMS)  // cap so first run stays fast

  if (!toEnrich.length) return NextResponse.json({ generated: 0, skipped: films.length })

  let generated    = 0
  let dimensionsOnly = 0
  let failed       = 0

  // Process in parallel batches of CONCURRENCY
  type FilmRow = (typeof films)[0]
  async function processFilm(film: FilmRow) {
    try {
      const existingBrief = (film.ai_brief ?? {}) as Record<string, unknown>

      if (film.ai_brief) {
        // Brief exists — just score dimensions (fast path)
        const dims = await scoreFilmDimensionsV2(film)
        if (dims) {
          await supabase
            .from('films')
            .update({ ai_brief: { ...existingBrief, dimensions_v2: dims } })
            .eq('id', film.id)
          dimensionsOnly++
        } else {
          failed++
        }
      } else {
        // No brief — full enrichment (includes dimensions_v2)
        const brief = await generateFilmBrief(film)
        if (brief) {
          await supabase
            .from('films')
            .update({ ai_brief: brief, brief_at: new Date().toISOString() })
            .eq('id', film.id)
          generated++
        } else {
          failed++
        }
      }
    } catch {
      failed++
    }
  }

  // Run CONCURRENCY films at a time
  for (let i = 0; i < toEnrich.length; i += CONCURRENCY) {
    const batch = toEnrich.slice(i, i + CONCURRENCY)
    await Promise.all(batch.map(processFilm))
  }

  return NextResponse.json({
    generated,
    dimensionsOnly,
    failed,
    total: toEnrich.length,
    cappedAt: toEnrich.length === MAX_FILMS ? MAX_FILMS : undefined,
  })
}
