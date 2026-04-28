import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const BASE = 'https://api.themoviedb.org/3'

async function tmdbFetch(path: string) {
  const url = new URL(`${BASE}${path}`)
  url.searchParams.set('api_key', process.env.TMDB_API_KEY!)
  const res = await fetch(url.toString(), { next: { revalidate: 3600 } })
  if (!res.ok) throw new Error(`TMDB ${res.status}`)
  return res.json()
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  // id format: "movie-12345" or "tv-12345"
  const dashIdx = id.indexOf('-')
  if (dashIdx === -1) return NextResponse.json({ similar: [] })
  const kind = id.slice(0, dashIdx) as 'movie' | 'tv'
  const tmdbId = id.slice(dashIdx + 1)

  try {
    const data = await tmdbFetch(`/${kind}/${tmdbId}/recommendations`)
    const results = (data.results ?? []).slice(0, 12)

    const similar = results.map((r: any) => ({
      id: `${kind}-${r.id}`,
      title: r.title ?? r.name ?? 'Unknown',
      year: r.release_date
        ? new Date(r.release_date).getFullYear()
        : r.first_air_date
        ? new Date(r.first_air_date).getFullYear()
        : null,
      poster_path: r.poster_path ?? null,
      overview: r.overview ?? null,
    }))

    return NextResponse.json({ similar })
  } catch {
    return NextResponse.json({ similar: [] })
  }
}
