/**
 * seed-calibration-pool.ts
 *
 * Builds a diverse calibration pool by pulling from multiple TMDB sources:
 *   • top_rated movies & TV (popular anchor)
 *   • discover by decade (1950s–2020s)
 *   • discover by language (French, Japanese, Korean, Spanish, Italian, etc.)
 *   • discover by underrepresented genre (horror, documentary, animation, western, musical)
 *   • "hidden gems" — high rating but low vote count
 *
 * Results are deduplicated before processing so overlap between sources is free.
 *
 * Run with:
 *   npx tsx scripts/seed-calibration-pool.ts
 *
 * Options:
 *   --concurrency N  Films processed in parallel per batch (default 4)
 *   --force          Re-score films that already have dimensions_v2
 *   --dims-only      Skip the narrative brief, only score dimensions (faster, cheaper)
 *   --dry-run        Print what would be fetched without calling OpenAI
 *
 * Safe to stop and restart — already-scored films are skipped automatically.
 */

import * as dotenv from 'dotenv'
import * as path from 'path'
dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

import { createClient } from '@supabase/supabase-js'
import { fetchFilm } from '../lib/tmdb'
import { generateFilmBrief, scoreFilmDimensionsV2 } from '../lib/prompts/film-brief'
import { Film, FilmKind } from '../lib/types'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const TMDB_KEY = process.env.TMDB_API_KEY!
const BASE     = 'https://api.themoviedb.org/3'

// ── CLI args ──────────────────────────────────────────────────────────────────

const args        = process.argv.slice(2)
const _concurrencyIdx = args.indexOf('--concurrency')
const CONCURRENCY = _concurrencyIdx !== -1 ? parseInt(args[_concurrencyIdx + 1]) : 4
const FORCE       = args.includes('--force')
const DIMS_ONLY   = args.includes('--dims-only')
const DRY_RUN     = args.includes('--dry-run')

// ── TMDB genre IDs ────────────────────────────────────────────────────────────

const MOVIE_GENRES: Record<string, number> = {
  horror:       27,
  documentary:  99,
  animation:    16,
  western:      37,
  musical:      10402,
  thriller:     53,
  'sci-fi':     878,
  war:          10752,
  history:      36,
  mystery:      9648,
}

const TV_GENRES: Record<string, number> = {
  animation:    16,
  documentary:  99,
  crime:        80,
  'sci-fi':     10765,
  comedy:       35,
  western:      37,
  mystery:      9648,
  war:          10768,
}

// ── Discovery source definitions ──────────────────────────────────────────────

interface DiscoverySource {
  label: string
  kind:  FilmKind
  endpoint: string          // e.g. '/movie/top_rated' or '/discover/movie'
  params:   Record<string, string>
  pages:    number
}

function movieDiscover(params: Record<string, string>, pages: number, label: string): DiscoverySource {
  return {
    label,
    kind: 'movie',
    endpoint: '/discover/movie',
    params: {
      sort_by: 'vote_average.desc',
      'vote_count.gte': '200',
      include_adult: 'false',
      ...params,
    },
    pages,
  }
}

function tvDiscover(params: Record<string, string>, pages: number, label: string): DiscoverySource {
  return {
    label,
    kind: 'tv',
    endpoint: '/discover/tv',
    params: {
      sort_by: 'vote_average.desc',
      'vote_count.gte': '100',
      ...params,
    },
    pages,
  }
}

const SOURCES: DiscoverySource[] = [
  // ── Movies: top-rated anchor ──────────────────────────────────────────────
  {
    label:    'Movies: Top Rated (TMDB)',
    kind:     'movie',
    endpoint: '/movie/top_rated',
    params:   {},
    pages:    35,   // ~700 films
  },

  // ── Movies: by decade ─────────────────────────────────────────────────────
  movieDiscover({ 'primary_release_date.gte': '1920-01-01', 'primary_release_date.lte': '1949-12-31', 'vote_count.gte': '100' }, 1, 'Movies: 1920s–1940s'),
  movieDiscover({ 'primary_release_date.gte': '1950-01-01', 'primary_release_date.lte': '1959-12-31', 'vote_count.gte': '100' }, 1, 'Movies: 1950s'),
  movieDiscover({ 'primary_release_date.gte': '1960-01-01', 'primary_release_date.lte': '1969-12-31', 'vote_count.gte': '100' }, 1, 'Movies: 1960s'),
  movieDiscover({ 'primary_release_date.gte': '1970-01-01', 'primary_release_date.lte': '1979-12-31', 'vote_count.gte': '150' }, 1, 'Movies: 1970s'),
  movieDiscover({ 'primary_release_date.gte': '1980-01-01', 'primary_release_date.lte': '1989-12-31', 'vote_count.gte': '200' }, 1, 'Movies: 1980s'),
  movieDiscover({ 'primary_release_date.gte': '1990-01-01', 'primary_release_date.lte': '1999-12-31', 'vote_count.gte': '200' }, 2, 'Movies: 1990s'),
  movieDiscover({ 'primary_release_date.gte': '2000-01-01', 'primary_release_date.lte': '2009-12-31', 'vote_count.gte': '200' }, 2, 'Movies: 2000s'),

  // ── Movies: by language (top 20 each) ────────────────────────────────────
  movieDiscover({ with_original_language: 'fr', 'vote_count.gte': '300' }, 1, 'Movies: French'),
  movieDiscover({ with_original_language: 'ja', 'vote_count.gte': '300' }, 1, 'Movies: Japanese'),
  movieDiscover({ with_original_language: 'ko', 'vote_count.gte': '300' }, 1, 'Movies: Korean'),
  movieDiscover({ with_original_language: 'es', 'vote_count.gte': '300' }, 1, 'Movies: Spanish'),
  movieDiscover({ with_original_language: 'de', 'vote_count.gte': '300' }, 1, 'Movies: German'),

  // ── Movies: by genre (underrepresented in top_rated) ─────────────────────
  movieDiscover({ with_genres: String(MOVIE_GENRES.horror),      'vote_count.gte': '300' }, 2, 'Movies: Horror'),
  movieDiscover({ with_genres: String(MOVIE_GENRES.documentary),  'vote_count.gte': '100' }, 2, 'Movies: Documentary'),
  movieDiscover({ with_genres: String(MOVIE_GENRES.animation),    'vote_count.gte': '200' }, 1, 'Movies: Animation'),
  movieDiscover({ with_genres: String(MOVIE_GENRES.western),      'vote_count.gte': '150' }, 1, 'Movies: Western'),
  movieDiscover({ with_genres: String(MOVIE_GENRES.musical),      'vote_count.gte': '150' }, 1, 'Movies: Musical'),
  movieDiscover({ with_genres: String(MOVIE_GENRES.war),          'vote_count.gte': '200' }, 1, 'Movies: War'),
  movieDiscover({ with_genres: String(MOVIE_GENRES.history),      'vote_count.gte': '200' }, 1, 'Movies: History'),
  movieDiscover({ with_genres: String(MOVIE_GENRES['sci-fi']),    'vote_count.gte': '300' }, 1, 'Movies: Sci-Fi'),

  // ── Movies: hidden gems (high rating, low vote count) ────────────────────
  movieDiscover({ 'vote_count.gte': '50',  'vote_count.lte': '300',  'vote_average.gte': '7.5' }, 3, 'Movies: Hidden Gems (50–300 votes)'),
  movieDiscover({ 'vote_count.gte': '300', 'vote_count.lte': '1000', 'vote_average.gte': '7.5' }, 3, 'Movies: Hidden Gems (300–1000 votes)'),
  movieDiscover({ 'vote_count.gte': '1000','vote_count.lte': '3000', 'vote_average.gte': '7.5' }, 3, 'Movies: Hidden Gems (1k–3k votes)'),

  // ── TV: top-rated anchor ──────────────────────────────────────────────────
  {
    label:    'TV: Top Rated (TMDB)',
    kind:     'tv',
    endpoint: '/tv/top_rated',
    params:   {},
    pages:    7,   // ~140 shows
  },

  // ── TV: by genre ──────────────────────────────────────────────────────────
  tvDiscover({ with_genres: String(TV_GENRES.animation),    'vote_count.gte': '100' }, 1, 'TV: Animation'),
  tvDiscover({ with_genres: String(TV_GENRES.documentary),  'vote_count.gte': '50'  }, 1, 'TV: Documentary'),
  tvDiscover({ with_genres: String(TV_GENRES.crime),        'vote_count.gte': '100' }, 1, 'TV: Crime'),
  tvDiscover({ with_genres: String(TV_GENRES['sci-fi']),    'vote_count.gte': '100' }, 1, 'TV: Sci-Fi & Fantasy'),
  tvDiscover({ with_genres: String(TV_GENRES.comedy),       'vote_count.gte': '100' }, 1, 'TV: Comedy'),
  tvDiscover({ with_genres: String(TV_GENRES.mystery),      'vote_count.gte': '100' }, 1, 'TV: Mystery'),

  // ── TV: by language (top 20 Spanish only) ────────────────────────────────
  tvDiscover({ with_original_language: 'es', 'vote_count.gte': '200' }, 1, 'TV: Spanish'),

  // ── TV: hidden gems ───────────────────────────────────────────────────────
  tvDiscover({ 'vote_count.gte': '30',  'vote_count.lte': '200',  'vote_average.gte': '8.0' }, 3, 'TV: Hidden Gems (30–200 votes)'),
  tvDiscover({ 'vote_count.gte': '200', 'vote_count.lte': '1000', 'vote_average.gte': '8.0' }, 3, 'TV: Hidden Gems (200–1k votes)'),
]

// ── TMDB fetch helpers ────────────────────────────────────────────────────────

async function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}

async function tmdbGet(endpoint: string, params: Record<string, string> = {}): Promise<Record<string, unknown>> {
  const url = new URL(`${BASE}${endpoint}`)
  url.searchParams.set('api_key', TMDB_KEY)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const res = await fetch(url.toString())
  if (!res.ok) throw new Error(`TMDB ${endpoint} → ${res.status}`)
  return res.json()
}

interface QueueItem { kind: FilmKind; id: number; sourceLabel: string }

async function fetchSourceIds(source: DiscoverySource): Promise<QueueItem[]> {
  const items: QueueItem[] = []
  process.stdout.write(`  Fetching: ${source.label} (${source.pages}p)`)
  for (let page = 1; page <= source.pages; page++) {
    try {
      const data = await tmdbGet(source.endpoint, { ...source.params, page: String(page) })
      for (const m of (data.results as Array<{ id: number }>) ?? []) {
        items.push({ kind: source.kind, id: m.id, sourceLabel: source.label })
      }
    } catch (err) {
      process.stdout.write(` [p${page} err]`)
    }
    await sleep(120)
  }
  console.log(` → ${items.length}`)
  return items
}

// ── Per-film processing ───────────────────────────────────────────────────────

interface ProcessResult {
  status: 'skipped' | 'scored' | 'failed'
  title?: string
  error?: string
}

async function processFilm(item: QueueItem, index: number, total: number): Promise<ProcessResult> {
  const filmId = `${item.kind}-${item.id}`
  const tag    = `[${String(index).padStart(4, ' ')}/${total}]`

  try {
    const { data: existing } = await supabase
      .from('films')
      .select('id, title, year, ai_brief')
      .eq('id', filmId)
      .single()

    const hasDims = !!(existing?.ai_brief as Record<string, unknown> | null)?.dimensions_v2

    if (hasDims && !FORCE) {
      process.stdout.write(`${tag} SKIP  ${existing?.title ?? filmId}\n`)
      return { status: 'skipped', title: existing?.title }
    }

    let film: Film
    if (existing && existing.title) {
      film = existing as unknown as Film
    } else {
      film = await fetchFilm(item.kind, item.id)
      await supabase.from('films').upsert(film)
    }

    const label = `${film.title} (${film.year ?? '?'})`

    if (DIMS_ONLY) {
      const dims = await scoreFilmDimensionsV2(film)
      if (!dims) {
        console.log(`${tag} ✗ DIM  ${label} — scoring returned null`)
        return { status: 'failed', title: film.title, error: 'dims null' }
      }
      const existingBrief = (existing?.ai_brief ?? {}) as Record<string, unknown>
      await supabase
        .from('films')
        .update({ ai_brief: { ...existingBrief, dimensions_v2: dims }, brief_at: new Date().toISOString() })
        .eq('id', filmId)
      console.log(`${tag} ✓ DIM  ${label}`)
      return { status: 'scored', title: film.title }
    }

    const brief = await generateFilmBrief(film)
    if (!brief) {
      console.log(`${tag} ✗ BRIEF ${label} — returned null`)
      return { status: 'failed', title: film.title, error: 'brief null' }
    }

    await supabase
      .from('films')
      .update({ ai_brief: brief, brief_at: new Date().toISOString() })
      .eq('id', filmId)

    const dimsMark = brief.dimensions_v2 ? '✓ dims' : '✗ no dims'
    console.log(`${tag} ✓ BRIEF ${label}  [${dimsMark}]  "${brief.tone}"`)
    return { status: 'scored', title: film.title }

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    if ((err as { code?: string })?.code === 'insufficient_quota' || msg.includes('quota')) {
      throw new Error('QUOTA_EXHAUSTED')
    }
    console.log(`${tag} ✗ ERR  ${filmId}: ${msg}`)
    return { status: 'failed', error: msg }
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('  S&P Reels — calibration pool seeder (diverse)')
  console.log(`  mode:        ${DIMS_ONLY ? 'dimensions only (fast)' : 'full brief + dimensions'}`)
  console.log(`  sources:     ${SOURCES.length} discovery sources`)
  console.log(`  concurrency: ${CONCURRENCY} at a time`)
  console.log(`  force:       ${FORCE}`)
  console.log(`  dry-run:     ${DRY_RUN}`)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

  // Collect IDs from all sources
  console.log('Fetching IDs from TMDB discovery sources...\n')
  const seen = new Set<string>()
  const queue: QueueItem[] = []

  for (const source of SOURCES) {
    const items = await fetchSourceIds(source)
    for (const item of items) {
      const key = `${item.kind}-${item.id}`
      if (!seen.has(key)) {
        seen.add(key)
        queue.push(item)
      }
    }
    await sleep(300)
  }

  const movieCount = queue.filter(i => i.kind === 'movie').length
  const tvCount    = queue.filter(i => i.kind === 'tv').length

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
  console.log(`  Unique items after dedup: ${queue.length}`)
  console.log(`  Movies: ${movieCount}  |  TV shows: ${tvCount}`)
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`)

  if (DRY_RUN) {
    console.log('--dry-run: stopping here. No OpenAI calls made.\n')
    return
  }

  const total = queue.length
  let scored  = 0
  let skipped = 0
  let failed  = 0
  const startTime = Date.now()

  for (let i = 0; i < total; i += CONCURRENCY) {
    const batch  = queue.slice(i, i + CONCURRENCY)
    const offset = i

    try {
      const results = await Promise.allSettled(
        batch.map((item, j) => processFilm(item, offset + j + 1, total))
      )

      for (const r of results) {
        if (r.status === 'fulfilled') {
          if (r.value.status === 'scored')  scored++
          if (r.value.status === 'skipped') skipped++
          if (r.value.status === 'failed')  failed++
        } else {
          if (r.reason?.message === 'QUOTA_EXHAUSTED') {
            console.error('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
            console.error('  ✗ OpenAI quota exhausted.')
            console.error('  Add credits at: platform.openai.com/settings/billing')
            console.error('  Re-run to resume — already-scored items are skipped.')
            console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
            printSummary(scored, skipped, failed, startTime)
            process.exit(1)
          }
          failed++
        }
      }
    } catch {
      failed += batch.length
    }

    if ((i + CONCURRENCY) % 20 === 0) {
      const elapsed = Math.round((Date.now() - startTime) / 1000)
      const done    = scored + skipped + failed
      const rate    = done > 0 ? Math.round((elapsed / done) * (total - done)) : '?'
      process.stdout.write(`\n  → ${done}/${total} | ${scored} scored | ${skipped} skipped | ${failed} failed | ~${rate}s left\n\n`)
    }

    if (i + CONCURRENCY < total) await sleep(800)
  }

  printSummary(scored, skipped, failed, startTime)
}

function printSummary(scored: number, skipped: number, failed: number, startTime: number) {
  const elapsed = Math.round((Date.now() - startTime) / 1000)
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(`  Done in ${elapsed}s`)
  console.log(`  Scored:  ${scored}`)
  console.log(`  Skipped: ${skipped} (already had dimensions_v2)`)
  console.log(`  Failed:  ${failed}`)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
}

main().catch(err => {
  console.error('\nFatal error:', err)
  process.exit(1)
})
