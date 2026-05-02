/**
 * GET /api/onboarding/session/[id]/reveal
 *
 * Returns the data needed for the post-interview reveal flow.
 * Recomputes the taste code from the user's rated library at the time of call,
 * since the session itself only stores contradictions (not the full TasteCode).
 *
 * The session must belong to the authenticated user and be in 'completed' status.
 *
 * Response shape:
 * {
 *   tasteCode: TasteCode | null,  // null if not enough rated+dimensioned films
 *   filmCount: number,            // total rated films with dimensions_v2 used
 * }
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { computeTasteCode, RatedFilmEntry } from '@/lib/taste-code'
import { FilmDimensionsV2 } from '@/lib/prompts/film-brief'
import { posterUrl } from '@/lib/types'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { id } = await params

  // Verify session exists and belongs to this user.
  // We don't gate on status — the taste code is computed from library_entries,
  // so it's available regardless of whether the interview was fully completed.
  const { data: session } = await supabase
    .from('taste_interview_sessions')
    .select('id, status')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!session) return NextResponse.json({ error: 'not found' }, { status: 404 })

  // Fetch all rated library entries — filter for dimensions_v2 client-side.
  // The .not() filter on a nested JSON column in a joined table is unreliable in Supabase.
  const { data: entries, error } = await supabase
    .from('library_entries')
    .select('film_id, my_stars, films(id, title, poster_path, ai_brief)')
    .eq('user_id', user.id)
    .gt('my_stars', 0)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Map raw rows to RatedFilmEntry shape expected by computeTasteCode
  type RawFilm = {
    id: string
    title: string
    poster_path: string | null
    ai_brief: unknown
  }

  type RawEntry = {
    film_id: string
    my_stars: number
    films: RawFilm | RawFilm[] | null
  }

  const rawEntries = (entries ?? []) as unknown as RawEntry[]

  const tasteCodeFilms: RatedFilmEntry[] = rawEntries
    .filter(e => {
      const film = Array.isArray(e.films) ? e.films[0] : e.films
      return film != null && (film.ai_brief as { dimensions_v2?: unknown } | null)?.dimensions_v2
    })
    .map(e => {
      const film = (Array.isArray(e.films) ? e.films[0] : e.films) as RawFilm
      return {
        film_id:      e.film_id,
        title:        film.title ?? '',
        poster_path:  film.poster_path ? posterUrl(film.poster_path, 'w185') : null,
        stars:        e.my_stars,
        dimensions_v2: (film.ai_brief as { dimensions_v2: FilmDimensionsV2 }).dimensions_v2,
      }
    })

  const tasteCode = computeTasteCode(tasteCodeFilms)

  return NextResponse.json({
    tasteCode,
    filmCount: tasteCodeFilms.length,
  })
}
