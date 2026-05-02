import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { searchFilms, getOrCacheFilm } from '@/lib/tmdb'

interface ImportFilm {
  title: string
  year: number | null
  stars: number | null
}

async function findTmdbMatch(title: string, year: number | null) {
  try {
    const results = await searchFilms(title, 'movie')
    if (!results.length) return null

    // Prefer exact title + exact year match
    if (year) {
      const exact = results.find(r =>
        r.title.toLowerCase() === title.toLowerCase() && r.year === year
      )
      if (exact) return exact

      // Accept year ±1 with title match
      const close = results.find(r =>
        r.title.toLowerCase() === title.toLowerCase() && r.year != null && Math.abs(r.year - year) <= 1
      )
      if (close) return close
    }

    // Fall back to first result if title is close enough
    const first = results[0]
    if (first.title.toLowerCase() === title.toLowerCase()) return first

    return null
  } catch {
    return null
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { films } = await request.json() as { films: ImportFilm[] }
  if (!Array.isArray(films)) return NextResponse.json({ error: 'films array required' }, { status: 400 })

  // Fetch existing library entries so we don't overwrite ratings the user set in sp-reels
  const { data: existing } = await supabase
    .from('library_entries')
    .select('film_id, my_stars')
    .eq('user_id', user.id)
    .eq('list', 'watched')

  const alreadyRated = new Set((existing ?? []).filter(e => e.my_stars != null).map(e => e.film_id))

  const results = {
    imported:       0,
    skipped:        0,
    notFound:       0,
    failed:         0,
    notFoundTitles: [] as string[],
  }

  // Process all films in this chunk concurrently — each does a TMDB search + DB
  // upsert independently, so there's no reason to serialize them.
  // TMDB allows 40 req/10s; a chunk of 15 is well within limits.
  await Promise.all(films.map(async film => {
    try {
      const match = await findTmdbMatch(film.title, film.year)
      if (!match) {
        results.notFound++
        results.notFoundTitles.push(`${film.title} (${film.year ?? '?'})`)
        return
      }

      // Skip if user already has this film rated in sp-reels
      if (alreadyRated.has(match.id)) {
        results.skipped++
        return
      }

      // Cache the film (fetches from TMDB if not already in DB)
      await getOrCacheFilm(supabase, match.id)

      // Upsert library entry — use Letterboxd rating if we have one
      const entry = {
        user_id:     user.id,
        film_id:     match.id,
        list:        'watched',
        audience:    ['me'],
        my_stars:    film.stars ?? null,
        finished_at: film.stars != null ? new Date().toISOString() : null,
      }

      const { error } = await supabase
        .from('library_entries')
        .upsert(entry, { onConflict: 'user_id,film_id,list' })

      if (error) {
        results.failed++
      } else {
        results.imported++
      }
    } catch {
      results.failed++
    }
  }))

  return NextResponse.json(results)
}
