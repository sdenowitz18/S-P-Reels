import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getOrCacheFilm } from '@/lib/tmdb'
import { generateFilmBrief } from '@/lib/prompts/film-brief'

// GET — return existing brief (or null if not generated yet)
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const { data } = await supabase
    .from('films')
    .select('ai_brief, brief_at')
    .eq('id', id)
    .single()

  return NextResponse.json({ brief: data?.ai_brief ?? null, brief_at: data?.brief_at ?? null })
}

// POST — generate (or regenerate) a brief for this film
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const film = await getOrCacheFilm(supabase, id)
  if (!film) return NextResponse.json({ error: 'film not found' }, { status: 404 })

  const brief = await generateFilmBrief(film)
  if (!brief) return NextResponse.json({ error: 'brief generation failed' }, { status: 500 })

  await supabase
    .from('films')
    .update({ ai_brief: brief, brief_at: new Date().toISOString() })
    .eq('id', id)

  return NextResponse.json({ brief })
}
