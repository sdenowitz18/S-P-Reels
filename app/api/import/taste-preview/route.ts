/**
 * GET /api/import/taste-preview
 *
 * Returns a partial taste code computed from however many of the user's
 * rated films already have dimensions_v2 in the DB. Called repeatedly
 * during Letterboxd import to power the live letter animation.
 *
 * Response:
 *   {
 *     letters: string[]        // locked letters so far (up to 4)
 *     lockedCount: number      // how many of 12 dimensions have strong signal
 *     filmCount: number        // how many rated+dimensioned films used
 *   }
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { computeTasteCode, RatedFilmEntry } from '@/lib/taste-code'
import { FilmDimensionsV2 } from '@/lib/prompts/film-brief'
import { posterUrl } from '@/lib/types'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { data: entries } = await supabase
    .from('library_entries')
    .select('film_id, my_stars, films(id, title, poster_path, ai_brief)')
    .eq('user_id', user.id)
    .gt('my_stars', 0)

  if (!entries?.length) return NextResponse.json({ letters: [], lockedCount: 0, filmCount: 0 })

  type RawFilm = { id: string; title: string; poster_path: string | null; ai_brief: unknown }
  type RawEntry = { film_id: string; my_stars: number; films: RawFilm | RawFilm[] | null }

  const ratedFilms: RatedFilmEntry[] = (entries as unknown as RawEntry[])
    .filter(e => {
      const film = Array.isArray(e.films) ? e.films[0] : e.films
      return film && (film.ai_brief as { dimensions_v2?: unknown } | null)?.dimensions_v2
    })
    .map(e => {
      const film = (Array.isArray(e.films) ? e.films[0] : e.films) as RawFilm
      return {
        film_id:       e.film_id,
        title:         film.title,
        poster_path:   film.poster_path ? posterUrl(film.poster_path, 'w185') : null,
        stars:         e.my_stars,
        dimensions_v2: (film.ai_brief as { dimensions_v2: FilmDimensionsV2 }).dimensions_v2,
      }
    })

  if (ratedFilms.length < 4) {
    return NextResponse.json({ letters: [], lockedCount: 0, filmCount: ratedFilms.length })
  }

  const tasteCode = computeTasteCode(ratedFilms)

  if (!tasteCode) {
    return NextResponse.json({ letters: [], lockedCount: 0, filmCount: ratedFilms.length })
  }

  // "Locked" = strong signal (gap ≥ 35)
  const STRONG_GAP = 35
  const lockedEntries = tasteCode.allEntries.filter(e => e.gap >= STRONG_GAP)

  return NextResponse.json({
    letters:     tasteCode.entries.map(e => e.letter),
    allLetters:  tasteCode.allEntries.map(e => ({ letter: e.letter, gap: e.gap, locked: e.gap >= STRONG_GAP })),
    lockedCount: lockedEntries.length,
    filmCount:   ratedFilms.length,
  })
}
