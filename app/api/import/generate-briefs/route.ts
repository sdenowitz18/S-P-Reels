import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateFilmBrief } from '@/lib/prompts/film-brief'

// Generates briefs for all films in the user's library that don't have one yet.
// Called automatically after Letterboxd import. Runs sequentially to avoid rate limits.
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  // Get all distinct film_ids in this user's library
  const { data: entries } = await supabase
    .from('library_entries')
    .select('film_id')
    .eq('user_id', user.id)

  if (!entries?.length) return NextResponse.json({ generated: 0 })

  const filmIds = [...new Set(entries.map(e => e.film_id))]

  // Only films missing a brief
  const { data: films } = await supabase
    .from('films')
    .select('*')
    .in('id', filmIds)
    .is('ai_brief', null)

  if (!films?.length) return NextResponse.json({ generated: 0, skipped: filmIds.length })

  let generated = 0
  let failed = 0

  for (const film of films) {
    try {
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
    } catch {
      failed++
    }
    // Small pause between calls
    await new Promise(r => setTimeout(r, 400))
  }

  return NextResponse.json({ generated, failed, total: films.length })
}
