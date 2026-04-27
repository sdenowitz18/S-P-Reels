import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = await request.json()
  const { action, text } = body

  if (action === 'note') {
    const { data: entry } = await supabase
      .from('library_entries')
      .select('live_notes')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    const notes = Array.isArray(entry?.live_notes) ? entry.live_notes : []
    notes.push({ at: new Date().toISOString(), text })

    const { data, error } = await supabase
      .from('library_entries')
      .update({ live_notes: notes })
      .eq('id', id)
      .eq('user_id', user.id)
      .select('*')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }

  // finish → move to watched
  const { data, error } = await supabase
    .from('library_entries')
    .update({ list: 'watched', finished_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.id)
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ entry: data, readyForInterview: true })
}
