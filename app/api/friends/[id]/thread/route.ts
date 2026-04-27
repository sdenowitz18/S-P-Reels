import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: friendId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  // Get all recs between these two users in either direction
  const { data: recs } = await admin
    .from('recommendations')
    .select('*, film:film_id(id, title, year, poster_path, director), from_user:from_user_id(id, name), to_user:to_user_id(id, name)')
    .or(`and(from_user_id.eq.${user.id},to_user_id.eq.${friendId}),and(from_user_id.eq.${friendId},to_user_id.eq.${user.id})`)
    .order('created_at', { ascending: false })

  if (!recs?.length) return NextResponse.json({ thread: [] })

  // Get comments for all recs
  const recIds = recs.map(r => r.id)
  const { data: comments } = await admin
    .from('rec_comments')
    .select('*, user:user_id(id, name)')
    .in('rec_id', recIds)
    .order('created_at', { ascending: true })

  // Mark notifications as read for received recs
  await admin
    .from('notifications')
    .update({ read: true })
    .eq('user_id', user.id)
    .in('rec_id', recIds)

  const commentsByRec = new Map<string, any[]>()
  for (const c of comments ?? []) {
    if (!commentsByRec.has(c.rec_id)) commentsByRec.set(c.rec_id, [])
    commentsByRec.get(c.rec_id)!.push(c)
  }

  const thread = recs.map(r => ({
    ...r,
    comments: commentsByRec.get(r.id) ?? [],
    isFromMe: r.from_user_id === user.id,
  }))

  return NextResponse.json({ thread })
}
