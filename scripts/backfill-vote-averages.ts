/**
 * Backfills tmdb_vote_average and tmdb_vote_count for all films
 * that don't already have them.
 *
 * Run: npx tsx scripts/backfill-vote-averages.ts
 */
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
const TMDB_KEY = process.env.TMDB_API_KEY!
const BASE = 'https://api.themoviedb.org/3'

async function fetchTmdbRating(kind: string, tmdbId: number): Promise<{ vote_average: number | null; vote_count: number | null }> {
  const path = kind === 'movie' ? `/movie/${tmdbId}` : `/tv/${tmdbId}`
  const url = `${BASE}${path}?api_key=${TMDB_KEY}`
  const res = await fetch(url)
  if (!res.ok) return { vote_average: null, vote_count: null }
  const data = await res.json()
  return {
    vote_average: data.vote_average ?? null,
    vote_count:   data.vote_count   ?? null,
  }
}

async function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

async function main() {
  // Fetch films missing vote data
  const { data: films, error } = await sb
    .from('films')
    .select('id, kind, tmdb_id, title')
    .is('tmdb_vote_average', null)
    .not('tmdb_id', 'is', null)
    .limit(2000)

  if (error) throw error
  if (!films || films.length === 0) {
    console.log('All films already have vote averages.')
    return
  }

  console.log(`Backfilling ${films.length} films...\n`)

  let success = 0
  let failed = 0

  for (let i = 0; i < films.length; i++) {
    const f = films[i] as { id: string; kind: string; tmdb_id: number; title: string }
    process.stdout.write(`[${i + 1}/${films.length}] ${f.title}... `)

    const { vote_average, vote_count } = await fetchTmdbRating(f.kind, f.tmdb_id)
    if (vote_average == null) {
      console.log('not found')
      failed++
    } else {
      const { error: upErr } = await sb
        .from('films')
        .update({ tmdb_vote_average: vote_average, tmdb_vote_count: vote_count })
        .eq('id', f.id)
      if (upErr) {
        console.log(`error: ${upErr.message}`)
        failed++
      } else {
        console.log(`★${vote_average} (${vote_count} votes)`)
        success++
      }
    }

    // Respect TMDB rate limits (~40 req/s)
    if ((i + 1) % 35 === 0) await sleep(1100)
  }

  console.log(`\nDone. ${success} updated, ${failed} failed.`)
}

main().catch(console.error)
