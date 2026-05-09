/**
 * GET /api/films/[id]/trailer
 *
 * Returns the YouTube trailer URL for a film.
 * Looks up the film's tmdb_id, calls TMDB /videos, returns best trailer.
 *
 * Returns: { url: string } or { url: null }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fetchTrailerKey } from '@/lib/tmdb'
import type { FilmKind } from '@/lib/types'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: filmId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  // Pull tmdb_id from the films table
  const { data: film } = await supabase
    .from('films')
    .select('id, tmdb_id')
    .eq('id', filmId)
    .single()

  if (!film?.tmdb_id) return NextResponse.json({ url: null })

  // Film ID format: "movie-123" or "tv-456"
  const kind = filmId.startsWith('tv-') ? 'tv' : 'movie' as FilmKind

  const key = await fetchTrailerKey(kind, film.tmdb_id)
  const url = key ? `https://www.youtube.com/watch?v=${key}` : null

  return NextResponse.json({ url })
}
