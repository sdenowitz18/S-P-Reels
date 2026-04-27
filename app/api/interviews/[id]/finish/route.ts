import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getOrCacheFilm } from '@/lib/tmdb'
import { generateReflection } from '@/lib/prompts/reflection'
import { TranscriptEntry } from '@/lib/types'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = await request.json()
  const { myStars, myLine } = body

  const { data: interview, error: fetchErr } = await supabase
    .from('interviews')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (fetchErr || !interview) return NextResponse.json({ error: 'interview not found' }, { status: 404 })

  if (interview.reflection) {
    return NextResponse.json({ interview, ...interview.reflection })
  }

  const film = await getOrCacheFilm(supabase, interview.film_id)

  const userAnswers = (interview.transcript as TranscriptEntry[])
    .filter(e => e.role === 'me')
    .map(e => e.text)

  const { data: tags } = await supabase
    .from('user_taste_tags')
    .select('tag')
    .eq('user_id', user.id)

  const { data: recentWatched } = await supabase
    .from('library_entries')
    .select('film:films(title)')
    .eq('user_id', user.id)
    .eq('list', 'watched')
    .order('finished_at', { ascending: false })
    .limit(20)

  const existingTags = (tags ?? []).map((t: any) => t.tag)
  const recentTitles = (recentWatched ?? []).map((e: any) => e.film?.title).filter(Boolean)

  const reflection = await generateReflection(film, userAnswers, existingTags, recentTitles)

  // persist reflection and update taste tags
  await supabase.from('interviews').update({
    transcript: interview.transcript,
    taste_tags: reflection.taste_tags,
    reflection,
  }).eq('id', id)

  for (const tag of reflection.taste_tags) {
    await supabase.from('user_taste_tags').upsert(
      { user_id: user.id, tag, weight: 1 },
      { onConflict: 'user_id,tag', ignoreDuplicates: false }
    )
    await supabase.rpc('increment_taste_tag', { p_user_id: user.id, p_tag: tag })
  }

  // update library entry with rating/line if provided
  if (myStars !== undefined || myLine !== undefined) {
    await supabase
      .from('library_entries')
      .update({ my_stars: myStars, my_line: myLine })
      .eq('user_id', user.id)
      .eq('film_id', interview.film_id)
      .eq('list', 'watched')
  }

  return NextResponse.json({ interview: { ...interview, reflection }, ...reflection })
}
