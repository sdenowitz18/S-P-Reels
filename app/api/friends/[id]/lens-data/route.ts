import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { computeTasteCode, RatedFilmEntry } from '@/lib/taste-code'
import { FilmDimensionsV2 } from '@/lib/prompts/film-brief'
import { posterUrl } from '@/lib/types'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: friendId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  // Verify friendship
  const { data: friendship } = await supabase
    .from('friend_requests')
    .select('id')
    .eq('status', 'accepted')
    .or(
      `and(from_user_id.eq.${user.id},to_user_id.eq.${friendId}),and(from_user_id.eq.${friendId},to_user_id.eq.${user.id})`
    )
    .limit(1)
    .maybeSingle()

  if (!friendship) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const admin = createAdminClient()

  const { data: entries, error } = await admin
    .from('library_entries')
    .select('film_id, my_stars, film:films(poster_path, title, ai_brief)')
    .eq('user_id', friendId)
    .eq('list', 'watched')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const seenFilmIds: Record<string, number | null> = {}
  for (const e of entries ?? []) {
    seenFilmIds[e.film_id as string] = (e.my_stars ?? null) as number | null
  }

  type FilmRow = {
    poster_path: string | null
    title: string | null
    ai_brief: { dimensions_v2?: FilmDimensionsV2 } | null
  }

  // Compute taste code from friend's rated films that have dimensions_v2
  const tasteCodeFilms: RatedFilmEntry[] = (entries ?? [])
    .filter(e => {
      const film = e.film as unknown as FilmRow | null
      return e.my_stars != null && film?.ai_brief?.dimensions_v2
    })
    .map(e => {
      const film = e.film as unknown as FilmRow
      return {
        film_id:       e.film_id as string,
        title:         film.title ?? '',
        poster_path:   film.poster_path ? posterUrl(film.poster_path, 'w185') : null,
        stars:         e.my_stars as number,
        dimensions_v2: film.ai_brief!.dimensions_v2!,
      }
    })

  const tasteCode = computeTasteCode(tasteCodeFilms)

  return NextResponse.json({ seenFilmIds, tasteCode })
}
