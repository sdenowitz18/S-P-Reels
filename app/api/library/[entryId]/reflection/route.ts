import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ entryId: string }> }
) {
  const { entryId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  // Find the library entry to get the film_id
  const { data: entry } = await supabase
    .from('library_entries')
    .select('film_id')
    .eq('id', entryId)
    .eq('user_id', user.id)
    .single()

  if (!entry) return NextResponse.json({ reflection: null })

  // Find the most recent interview for this film
  const { data: interview } = await supabase
    .from('interviews')
    .select('reflection, taste_tags')
    .eq('user_id', user.id)
    .eq('film_id', entry.film_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!interview?.reflection) return NextResponse.json({ reflection: null })

  return NextResponse.json({ reflection: interview.reflection })
}
