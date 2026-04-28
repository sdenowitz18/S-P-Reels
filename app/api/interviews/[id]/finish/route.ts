import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getOrCacheFilm } from '@/lib/tmdb'
import { generateReflection } from '@/lib/prompts/reflection'
import { generateRatingSuggestion, generateSentimentTags } from '@/lib/prompts/interview'
import { TranscriptEntry } from '@/lib/types'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))

  const { data: interview, error: fetchErr } = await supabase
    .from('interviews')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (fetchErr || !interview) return NextResponse.json({ error: 'interview not found' }, { status: 404 })

  if (interview.reflection) {
    return NextResponse.json({
      interview,
      ...interview.reflection,
      aiRating: (interview as any).ai_rating ?? null,
      sentimentTags: (interview as any).sentiment_tags ?? null,
    })
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

  const filmKeywords = film.keywords ?? []

  // run all AI calls in parallel
  const [reflection, aiRating, sentimentTags] = await Promise.all([
    generateReflection(film, userAnswers, existingTags, recentTitles),
    generateRatingSuggestion(film, interview.transcript as TranscriptEntry[]),
    generateSentimentTags(film, interview.transcript as TranscriptEntry[], filmKeywords),
  ])

  // persist reflection, ai_rating, sentiment_tags and update taste tags
  await supabase.from('interviews').update({
    transcript: interview.transcript,
    taste_tags: reflection.taste_tags,
    reflection,
    ai_rating: aiRating,
    sentiment_tags: sentimentTags,
  }).eq('id', id)

  for (const tag of reflection.taste_tags) {
    await supabase.from('user_taste_tags').upsert(
      { user_id: user.id, tag, weight: 1 },
      { onConflict: 'user_id,tag', ignoreDuplicates: false }
    )
    await supabase.rpc('increment_taste_tag', { p_user_id: user.id, p_tag: tag })
  }

  return NextResponse.json({
    interview: { ...interview, reflection, ai_rating: aiRating, sentiment_tags: sentimentTags },
    ...reflection,
    aiRating,
    sentimentTags,
  })
}
