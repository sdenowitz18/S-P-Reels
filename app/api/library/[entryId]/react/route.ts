import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

type Params = { params: Promise<{ entryId: string }> }

export async function POST(request: NextRequest, { params }: Params) {
  const { entryId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const type = 'like'

  const admin = createAdminClient()

  await admin
    .from('activity_reactions')
    .upsert({ entry_id: entryId, user_id: user.id, type }, { onConflict: 'entry_id,user_id,type', ignoreDuplicates: true })

  const { count } = await admin
    .from('activity_reactions')
    .select('*', { count: 'exact', head: true })
    .eq('entry_id', entryId)
    .eq('type', type)

  // Notify entry owner if different user
  const { data: entry } = await admin
    .from('library_entries')
    .select('user_id, film:films(title)')
    .eq('id', entryId)
    .maybeSingle()

  if (entry && entry.user_id !== user.id) {
    const film = Array.isArray(entry.film) ? entry.film[0] : entry.film
    const { data: liker } = await admin
      .from('users')
      .select('name')
      .eq('id', user.id)
      .maybeSingle()

    await admin.from('notifications').insert({
      user_id: entry.user_id,
      type: 'activity_liked',
      payload: {
        likerId: user.id,
        likerName: liker?.name ?? 'Someone',
        filmTitle: film?.title ?? 'a film',
        entryId,
      },
    })
  }

  return NextResponse.json({ count: count ?? 0, liked: true })
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const { entryId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  await admin
    .from('activity_reactions')
    .delete()
    .eq('entry_id', entryId)
    .eq('user_id', user.id)
    .eq('type', 'like')

  const { count } = await admin
    .from('activity_reactions')
    .select('*', { count: 'exact', head: true })
    .eq('entry_id', entryId)
    .eq('type', 'like')

  return NextResponse.json({ count: count ?? 0, liked: false })
}
