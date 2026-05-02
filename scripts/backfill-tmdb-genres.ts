/**
 * Backfill tmdb_genres for all films that have a null tmdb_genres column.
 *
 * Run with: npx tsx scripts/backfill-tmdb-genres.ts
 *
 * Fetches each film's genre list from TMDB and updates the films table.
 * Rate-limited to ~40 req/s (TMDB allows 40/10s).
 */
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const TMDB_KEY = process.env.TMDB_API_KEY!
const BASE = 'https://api.themoviedb.org/3'

async function tmdbGenres(kind: string, tmdbId: number): Promise<string[]> {
  const path = kind === 'movie' ? `/movie/${tmdbId}` : `/tv/${tmdbId}`
  const url = `${BASE}${path}?api_key=${TMDB_KEY}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`TMDB ${path} → ${res.status}`)
  const data = await res.json()
  return (data.genres ?? []).map((g: { name: string }) => g.name)
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

async function run() {
  // Fetch all films missing tmdb_genres
  const { data: films, error } = await supabase
    .from('films')
    .select('id, kind, tmdb_id, title')
    .is('tmdb_genres', null)
    .limit(2000)

  if (error || !films) { console.error('fetch error:', error); process.exit(1) }
  console.log(`${films.length} films need tmdb_genres backfill`)

  let ok = 0, err = 0

  for (let i = 0; i < films.length; i++) {
    const film = films[i]
    try {
      const genres = await tmdbGenres(film.kind ?? 'movie', film.tmdb_id as number)
      const { error: upErr } = await supabase
        .from('films')
        .update({ tmdb_genres: genres })
        .eq('id', film.id)

      if (upErr) throw upErr
      console.log(`  ✓ [${i + 1}/${films.length}] ${film.title} → [${genres.join(', ')}]`)
      ok++
    } catch (e: unknown) {
      console.error(`  ✗ ${film.title}:`, e instanceof Error ? e.message : e)
      err++
    }

    // Stay under TMDB rate limit: 40 req/10s → ~260ms gap
    if (i % 38 === 37) {
      console.log('  (rate limit pause…)')
      await sleep(10_000)
    } else {
      await sleep(260)
    }
  }

  console.log(`\ndone. ${ok} updated, ${err} errors.`)
}

run().catch(e => { console.error(e); process.exit(1) })
