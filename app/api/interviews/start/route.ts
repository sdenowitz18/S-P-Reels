import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getOrCacheFilm } from '@/lib/tmdb'
import { generateOpeningQuestion } from '@/lib/prompts/interview'
import { InterviewerPersona, InterviewDepth } from '@/lib/types'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { filmId, interviewer, depth } = await request.json() as {
    filmId: string
    interviewer: InterviewerPersona
    depth: InterviewDepth
  }

  if (!filmId || !interviewer || !depth) {
    return NextResponse.json({ error: 'filmId, interviewer, depth required' }, { status: 400 })
  }

  const film = await getOrCacheFilm(supabase, filmId)
  const firstQuestion = await generateOpeningQuestion(film, interviewer)

  const transcript = [{
    role: 'interviewer' as const,
    text: firstQuestion,
    at: new Date().toISOString(),
  }]

  const { data, error } = await supabase
    .from('interviews')
    .insert({
      user_id: user.id,
      film_id: filmId,
      interviewer,
      depth,
      transcript,
    })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ interviewId: data.id, firstQuestion })
}
