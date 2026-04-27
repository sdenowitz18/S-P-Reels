import { NextRequest, NextResponse } from 'next/server'
import { searchFilms } from '@/lib/tmdb'

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q')
  const kind = (request.nextUrl.searchParams.get('kind') ?? 'both') as 'movie' | 'tv' | 'both'

  if (!q) return NextResponse.json({ error: 'q required' }, { status: 400 })

  const results = await searchFilms(q, kind)
  return NextResponse.json(results)
}
