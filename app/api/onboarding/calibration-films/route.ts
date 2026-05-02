/**
 * GET /api/onboarding/calibration-films?ids=329,1018,...
 *
 * Returns poster URLs for the calibration film set.
 * Calls getOrCacheFilm for each, which populates the films table on first access.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getOrCacheFilm } from '@/lib/tmdb'
import { posterUrl } from '@/lib/types'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const idsParam = req.nextUrl.searchParams.get('ids') ?? ''
  const ids = idsParam.split(',').map(s => s.trim()).filter(Boolean)
  if (!ids.length) return NextResponse.json({ films: [] })

  const results = await Promise.allSettled(
    ids.map(id => getOrCacheFilm(supabase, id))
  )

  const films = results
    .map((r, i) => {
      if (r.status === 'rejected') return { tmdb_id: ids[i], poster_url: null, title: null, year: null }
      const film = r.value
      return {
        tmdb_id:    film.id,
        poster_url: film.poster_path ? posterUrl(film.poster_path, 'w342') : null,
        title:      film.title ?? null,
        year:       film.year ?? null,
      }
    })

  return NextResponse.json({ films })
}
