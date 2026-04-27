import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: filmId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  // Get accepted friend ids in both directions
  const [{ data: sent }, { data: received }] = await Promise.all([
    admin.from('friend_requests').select('to_user_id').eq('from_user_id', user.id).eq('status', 'accepted'),
    admin.from('friend_requests').select('from_user_id').eq('to_user_id', user.id).eq('status', 'accepted'),
  ])

  const friendIds = [
    ...(sent ?? []).map((r: any) => r.to_user_id),
    ...(received ?? []).map((r: any) => r.from_user_id),
  ].filter(Boolean)

  if (!friendIds.length) return NextResponse.json({ friends: [] })

  const { data: entries } = await admin
    .from('library_entries')
    .select('user_id, list, my_stars, my_line, user:user_id(id, name)')
    .eq('film_id', filmId)
    .in('user_id', friendIds)

  return NextResponse.json({ friends: entries ?? [] })
}
