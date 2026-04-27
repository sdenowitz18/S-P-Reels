import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { recommendMoodFilm } from '@/lib/prompts/mood'
import { getOrCacheFilm } from '@/lib/tmdb'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { kind, moods, runtime, audience, count = 3 } = await request.json()

  const { data: userTags } = await supabase
    .from('user_taste_tags')
    .select('tag, weight')
    .eq('user_id', user.id)
    .order('weight', { ascending: false })

  const { data: watched } = await supabase
    .from('library_entries')
    .select('film:films(title)')
    .eq('user_id', user.id)
    .eq('list', 'watched')

  let groupTags: string[] = []
  if (audience && audience !== 'me') {
    const { data: gt } = await supabase
      .from('group_taste_tags')
      .select('tag')
      .eq('group_id', audience)
    groupTags = (gt ?? []).map((t: any) => t.tag)
  }

  const watchedTitles = (watched ?? []).map((e: any) => e.film?.title).filter(Boolean)
  const recentTitles = watchedTitles.slice(0, 10)
  const tasteTagList = (userTags ?? []).map((t: any) => t.tag)

  // Find `count` distinct recommendations sequentially to avoid dupes
  const picks: { film: any; why: string }[] = []
  const excludeTitles = [...watchedTitles]

  for (let i = 0; i < count; i++) {
    const result = await recommendMoodFilm({
      kind,
      moods,
      runtime,
      userTags: tasteTagList,
      groupTags,
      recentTitles,
      watchedTitles: excludeTitles,
    })
    if (!result) continue
    excludeTitles.push(result.title)
    const film = await getOrCacheFilm(supabase, result.filmId)
    picks.push({ film, why: result.why })
  }

  if (picks.length === 0) return NextResponse.json({ error: 'no recommendations found' }, { status: 422 })
  return NextResponse.json({ picks, hasTaste: tasteTagList.length > 0 })
}
