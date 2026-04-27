import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getOrCacheFilm } from '@/lib/tmdb'
import { generateFollowUp } from '@/lib/prompts/interview'
import { DEPTH_QUESTIONS, TranscriptEntry } from '@/lib/types'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { answer } = await request.json()
  if (!answer) return NextResponse.json({ error: 'answer required' }, { status: 400 })

  const { data: interview, error: fetchErr } = await supabase
    .from('interviews')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (fetchErr || !interview) return NextResponse.json({ error: 'interview not found' }, { status: 404 })

  const transcript: TranscriptEntry[] = interview.transcript
  transcript.push({ role: 'me', text: answer, at: new Date().toISOString() })

  const totalQuestions = DEPTH_QUESTIONS[interview.depth as keyof typeof DEPTH_QUESTIONS]
  const questionsAsked = transcript.filter(e => e.role === 'interviewer').length

  if (questionsAsked >= totalQuestions) {
    await supabase.from('interviews').update({ transcript }).eq('id', id)
    return NextResponse.json({ done: true })
  }

  const film = await getOrCacheFilm(supabase, interview.film_id)
  const nextQuestion = await generateFollowUp(
    film,
    interview.interviewer,
    interview.depth,
    transcript,
    questionsAsked + 1
  )

  transcript.push({ role: 'interviewer', text: nextQuestion, at: new Date().toISOString() })
  await supabase.from('interviews').update({ transcript }).eq('id', id)

  return NextResponse.json({ nextQuestion })
}
