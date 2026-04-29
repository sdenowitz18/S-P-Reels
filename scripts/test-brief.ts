/**
 * Test film brief generation on a handful of films.
 * Run with: npx tsx scripts/test-brief.ts
 */
import { createClient } from '@supabase/supabase-js'
import { getOrCacheFilm } from '../lib/tmdb'
import { generateFilmBrief } from '../lib/prompts/film-brief'
import { fetchWikipediaReception } from '../lib/enrichment/wikipedia'
import { fetchRedditDiscourse } from '../lib/enrichment/reddit'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const TEST_FILMS = [
  { id: 'movie-694',    title: 'The Shining' },
  { id: 'movie-769',    title: 'GoodFellas' },
  { id: 'movie-28',     title: 'Apocalypse Now' },
]

async function run() {
  for (const { id, title } of TEST_FILMS) {
    console.log(`\n${'─'.repeat(60)}`)
    console.log(`▶ generating brief for: ${title} (${id})`)
    console.log('─'.repeat(60))

    try {
      const film = await getOrCacheFilm(supabase as any, id)

      // Show what enrichment data we're pulling in
      console.log('\nfetching enrichment sources…')
      const [wiki, reddit] = await Promise.allSettled([
        fetchWikipediaReception(film.title, film.year),
        fetchRedditDiscourse(film.title, film.year),
      ])
      const wikiText = wiki.status === 'fulfilled' ? wiki.value : null
      const redditText = reddit.status === 'fulfilled' ? reddit.value : null
      console.log(`  wikipedia: ${wikiText ? `✓ (${wikiText.length} chars)` : '✗ not found'}`)
      console.log(`  reddit:    ${redditText ? `✓ (${redditText.length} chars)` : '✗ not found'}`)

      const brief = await generateFilmBrief(film)

      if (!brief) {
        console.log('✗ failed — null result')
        continue
      }

      // save to DB
      await supabase
        .from('films')
        .update({ ai_brief: brief, brief_at: new Date().toISOString() })
        .eq('id', id)

      console.log('\nemotional_question:', brief.emotional_question)
      console.log('tone:', brief.tone)
      console.log('\nthemes:')
      brief.themes.forEach(t => console.log(`  • ${t.theme}: ${t.summary}`))
      console.log('\ndiscourse:')
      console.log('  loved:', brief.discourse.loved)
      console.log('  wrestled_with:', brief.discourse.wrestled_with)
      console.log('  debate:', brief.discourse.debate)
      console.log('\nscenes:')
      brief.scenes.forEach(s => console.log(`  • ${s.name}: ${s.hook}`))
      console.log('\ncraft:')
      brief.craft.forEach(c => console.log(`  • ${c}`))
      console.log('\nperformances:')
      brief.performances.forEach(p => console.log(`  • ${p.actor}: ${p.note}`))
      console.log('\nviewer_fit:')
      console.log('  connects:', brief.viewer_fit.connects)
      console.log('  bounces:', brief.viewer_fit.bounces)
      console.log('\ndimensions:', brief.dimensions)
      console.log('\n✓ saved to DB')
    } catch (err) {
      console.error('✗ error:', err)
    }
  }
}

run()
