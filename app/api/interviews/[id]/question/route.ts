import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getOrCacheFilm } from '@/lib/tmdb'
import { generateTopicQuestion, generateLateralQuestion } from '@/lib/prompts/interview'
import { InterviewTopic, TranscriptEntry } from '@/lib/types'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { topic, action, subTopic } = await request.json() as {
    topic: InterviewTopic
    action: 'topic' | 'lateral'
    subTopic?: string
  }

  if (!topic || !action) {
    return NextResponse.json({ error: 'topic and action required' }, { status: 400 })
  }

  const { data: interview, error: fetchErr } = await supabase
    .from('interviews')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (fetchErr || !interview) return NextResponse.json({ error: 'interview not found' }, { status: 404 })

  const film = await getOrCacheFilm(supabase, interview.film_id)
  const transcript: TranscriptEntry[] = interview.transcript

  // fetch brief if available
  const { data: filmRow } = await supabase.from('films').select('ai_brief').eq('id', interview.film_id).single()
  const brief = filmRow?.ai_brief ?? null

  const question = action === 'lateral'
    ? await generateLateralQuestion(film, interview.interviewer, topic, transcript, brief)
    : await generateTopicQuestion(film, interview.interviewer, topic, transcript, brief, subTopic)

  transcript.push({ role: 'interviewer', text: question, at: new Date().toISOString() })
  await supabase.from('interviews').update({ transcript }).eq('id', id)

  return NextResponse.json({ question })
}
