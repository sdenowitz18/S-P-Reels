/**
 * POST /api/mood/save-film
 *
 * Saves a film to the watchlist of one or more room members.
 * - Current user: saves directly via their own session.
 * - Friends in memberIds: verified against accepted friend_requests,
 *   then saved on their behalf using the admin client.
 *
 * Body: { filmId: string, memberIds: string[] }
 * Returns: { ok: true, saved: string[] } — IDs that were saved successfully.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { filmId, memberIds }: { filmId: string; memberIds: string[] } = await req.json()
  if (!filmId || !Array.isArray(memberIds) || memberIds.length === 0) {
    return NextResponse.json({ error: 'bad request' }, { status: 400 })
  }

  const admin = createAdminClient()
  const saved: string[] = []

  await Promise.allSettled(
    memberIds.map(async (memberId) => {
      if (memberId === user.id) {
        // Save to own watchlist — use the user's session (respects RLS)
        const { error } = await supabase.from('library_entries').upsert({
          user_id: user.id,
          film_id: filmId,
          list: 'watchlist',
          audience: ['me'],
        }, { onConflict: 'user_id,film_id,list', ignoreDuplicates: true })
        if (!error) saved.push(memberId)
      } else {
        // Verify accepted friendship before writing to another user's library
        const { data: friendship } = await admin
          .from('friend_requests')
          .select('id')
          .eq('status', 'accepted')
          .or(
            `and(from_user_id.eq.${user.id},to_user_id.eq.${memberId}),` +
            `and(from_user_id.eq.${memberId},to_user_id.eq.${user.id})`
          )
          .maybeSingle()

        if (!friendship) return  // skip — not friends

        const { error } = await admin.from('library_entries').upsert({
          user_id: memberId,
          film_id: filmId,
          list: 'watchlist',
          audience: ['me'],
        }, { onConflict: 'user_id,film_id,list', ignoreDuplicates: true })
        if (!error) saved.push(memberId)
      }
    })
  )

  return NextResponse.json({ ok: true, saved })
}
