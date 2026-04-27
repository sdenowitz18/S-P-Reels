import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: recId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { text } = await request.json()
  if (!text?.trim()) return NextResponse.json({ error: 'text required' }, { status: 400 })

  const admin = createAdminClient()

  const { data: comment, error } = await admin.from('rec_comments').insert({
    rec_id: recId,
    user_id: user.id,
    text: text.trim(),
  }).select('*, user:user_id(id, name)').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Notify the other person in the thread
  const { data: rec } = await admin.from('recommendations').select('from_user_id, to_user_id').eq('id', recId).single()
  if (rec) {
    const notifyId = rec.from_user_id === user.id ? rec.to_user_id : rec.from_user_id
    await admin.from('notifications').insert({
      user_id: notifyId,
      type: 'rec_comment',
      rec_id: recId,
      from_user_id: user.id,
    })
  }

  return NextResponse.json({ ok: true, comment })
}
