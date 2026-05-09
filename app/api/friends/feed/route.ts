/**
 * GET /api/friends/feed
 *
 * Returns a combined activity feed for all of the current user's friends,
 * sorted newest-first. Used on the home page friends section.
 *
 * Returns:
 *   {
 *     friends: Array<{ id, name }>          — all accepted friends (for filter chips)
 *     items:   Array<FeedItem>              — combined activity, newest first
 *   }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { posterUrl } from '@/lib/types'

export interface FeedItem {
  id: string
  type: 'watch' | 'watchlist' | 'now_playing' | 'rec'
  userId: string
  userName: string
  film: {
    id: string
    title: string
    year: number | null
    poster_path: string | null
    director: string | null
  }
  stars: number | null
  line:  string | null
  note:  string | null
  date:  string
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  // Optional ?days= param (default 7)
  const days = parseInt(req.nextUrl.searchParams.get('days') ?? '7', 10)
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

  const admin = createAdminClient()

  // ── Fetch accepted friends ───────────────────────────────────────────────────
  const [{ data: sent }, { data: received }] = await Promise.all([
    admin.from('friend_requests').select('friend:to_user_id(id, name)').eq('from_user_id', user.id).eq('status', 'accepted'),
    admin.from('friend_requests').select('friend:from_user_id(id, name)').eq('to_user_id', user.id).eq('status', 'accepted'),
  ])

  const friends: { id: string; name: string }[] = [
    ...(sent   ?? []).map((r: any) => r.friend),
    ...(received ?? []).map((r: any) => r.friend),
  ].filter((f): f is { id: string; name: string } => !!f?.id)

  if (friends.length === 0) {
    return NextResponse.json({ friends: [], items: [] })
  }

  const friendIds = friends.map(f => f.id)
  const nameMap = new Map(friends.map(f => [f.id, f.name]))

  // ── Fetch recent library entries for all friends ─────────────────────────────
  const { data: entries } = await admin
    .from('library_entries')
    .select('id, user_id, list, my_stars, my_line, added_at, finished_at, film:films(id, title, year, poster_path, director)')
    .in('user_id', friendIds)
    .in('list', ['watched', 'watchlist', 'now_playing'])
    .gte('added_at', since)
    .order('added_at', { ascending: false })
    .limit(120)

  const items: FeedItem[] = []

  for (const e of entries ?? []) {
    const f = Array.isArray(e.film) ? e.film[0] : e.film
    if (!f) continue
    const date = (e.list === 'watched' ? (e.finished_at ?? e.added_at) : e.added_at) ?? new Date().toISOString()
    items.push({
      id:       `entry-${e.id}`,
      type:     e.list as FeedItem['type'],
      userId:   e.user_id,
      userName: nameMap.get(e.user_id) ?? 'Friend',
      film: {
        id:          f.id,
        title:       f.title,
        year:        f.year ?? null,
        poster_path: f.poster_path ? posterUrl(f.poster_path, 'w185') : null,
        director:    f.director ?? null,
      },
      stars: e.my_stars ?? null,
      line:  e.my_line  ?? null,
      note:  null,
      date,
    })
  }

  // Sort newest first
  items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  return NextResponse.json({ friends, items })
}
