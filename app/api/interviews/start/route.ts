import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getOrCacheFilm } from '@/lib/tmdb'
import { InterviewerPersona } from '@/lib/types'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { filmId, interviewer } = await request.json() as {
    filmId: string
    interviewer: InterviewerPersona
  }

  if (!filmId || !interviewer) {
    return NextResponse.json({ error: 'filmId and interviewer required' }, { status: 400 })
  }

  // ensure film is cached in DB before creating the interview (FK constraint)
  // also fires brief generation in background if not yet done
  await getOrCacheFilm(supabase, filmId)

  const { data, error } = await supabase
    .from('interviews')
    .insert({
      user_id: user.id,
      film_id: filmId,
      interviewer,
      depth: 'medium', // kept for DB compat, no longer drives question count
      transcript: [],
    })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // return brief if already generated — powers sub-bubble drill-down in the UI
  const { data: filmRow } = await supabase.from('films').select('ai_brief').eq('id', filmId).single()
  const brief = filmRow?.ai_brief ?? null

  return NextResponse.json({ interviewId: data.id, brief })
}
