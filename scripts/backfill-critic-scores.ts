/**
 * Backfills IMDb ID (via TMDB external_ids), then fetches
 * IMDb rating, Rotten Tomatoes %, and Metacritic score from OMDB.
 *
 * Run: npx tsx scripts/backfill-critic-scores.ts
 * Dry run: npx tsx scripts/backfill-critic-scores.ts --dry
 */
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const TMDB_KEY  = process.env.TMDB_API_KEY!
const OMDB_KEY  = process.env.OMDB_API_KEY!
const DRY       = process.argv.includes('--dry')
const TMDB_BASE = 'https://api.themoviedb.org/3'
const OMDB_BASE = 'https://www.omdbapi.com'

async function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

async function tmdbExternalIds(kind: string, tmdbId: number): Promise<string | null> {
  const path = kind === 'movie' ? `/movie/${tmdbId}/external_ids` : `/tv/${tmdbId}/external_ids`
  const url = `${TMDB_BASE}${path}?api_key=${TMDB_KEY}`
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const data = await res.json()
    return data.imdb_id ?? null
  } catch { return null }
}

type OmdbResult = {
  imdbRating: number | null
  rtScore:    number | null
  metacritic: number | null
}

async function fetchOmdb(imdbId: string): Promise<OmdbResult> {
  const url = `${OMDB_BASE}?apikey=${OMDB_KEY}&i=${imdbId}&tomatoes=true`
  try {
    const res  = await fetch(url)
    const data = await res.json()
    if (data.Response === 'False') return { imdbRating: null, rtScore: null, metacritic: null }

    const imdbRating = parseFloat(data.imdbRating) || null

    // Ratings array: [{Source, Value}, ...]
    const ratings: {Source: string; Value: string}[] = data.Ratings ?? []

    const rt = ratings.find(r => r.Source === 'Rotten Tomatoes')
    const rtScore = rt ? parseInt(rt.Value.replace('%', '')) || null : null

    const mc = parseInt(data.Metascore) || null

    return { imdbRating, rtScore, metacritic: mc }
  } catch { return { imdbRating: null, rtScore: null, metacritic: null } }
}

async function main() {
  if (!OMDB_KEY) {
    console.error('Missing OMDB_API_KEY in .env.local — get a free key at https://www.omdbapi.com/apikey.aspx')
    process.exit(1)
  }

  // Fetch films that haven't been scored yet
  const { data: films, error } = await sb
    .from('films')
    .select('id, kind, tmdb_id, title, year, imdb_id')
    .is('scores_fetched_at', null)
    .not('tmdb_id', 'is', null)
    .limit(2000)

  if (error) throw error
  if (!films || films.length === 0) {
    console.log('All films already have critic scores.')
    return
  }

  console.log(`${DRY ? '[DRY RUN] ' : ''}Processing ${films.length} films...\n`)

  let success = 0, noImdb = 0, noOmdb = 0

  for (let i = 0; i < films.length; i++) {
    const f = films[i] as {
      id: string; kind: string; tmdb_id: number
      title: string; year: number | null; imdb_id: string | null
    }

    process.stdout.write(`[${i + 1}/${films.length}] ${f.title} (${f.year ?? '?'})... `)

    // Step 1: get IMDb ID if we don't have it
    let imdbId = f.imdb_id
    if (!imdbId) {
      imdbId = await tmdbExternalIds(f.kind, f.tmdb_id)
      await sleep(30)  // TMDB rate limit
    }

    if (!imdbId) {
      console.log('no IMDb ID')
      noImdb++
      if (!DRY) {
        await sb.from('films')
          .update({ scores_fetched_at: new Date().toISOString() })
          .eq('id', f.id)
      }
      continue
    }

    // Step 2: fetch OMDB
    const scores = await fetchOmdb(imdbId)
    await sleep(60)  // OMDB rate limit (1000 req/day on free tier)

    const parts: string[] = [`imdb_id=${imdbId}`]
    if (scores.imdbRating) parts.push(`IMDb=${scores.imdbRating}`)
    if (scores.rtScore)    parts.push(`RT=${scores.rtScore}%`)
    if (scores.metacritic) parts.push(`MC=${scores.metacritic}`)

    if (!scores.imdbRating && !scores.rtScore && !scores.metacritic) {
      console.log(`no OMDB data`)
      noOmdb++
    } else {
      console.log(parts.join('  '))
      success++
    }

    if (!DRY) {
      await sb.from('films').update({
        imdb_id:           imdbId,
        imdb_rating:       scores.imdbRating,
        rt_score:          scores.rtScore,
        metacritic:        scores.metacritic,
        scores_fetched_at: new Date().toISOString(),
      }).eq('id', f.id)
    }

    // Pause every 50 to be safe
    if ((i + 1) % 50 === 0) {
      console.log(`\n  — ${i + 1} done, pausing 2s —\n`)
      await sleep(2000)
    }
  }

  console.log(`\nDone. ${success} scored, ${noImdb} no IMDb ID, ${noOmdb} no OMDB data.`)
}

main().catch(console.error)
