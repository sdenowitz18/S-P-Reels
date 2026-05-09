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
  entryId: string
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
  reactionCount: number
  hasLiked: boolean
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
      entryId:  e.id,
      type:     (e.list === 'watched' ? 'watch' : e.list) as FeedItem['type'],
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
      reactionCount: 0,
      hasLiked: false,
    })
  }

  // ── Fetch recent recommendations involving friends ───────────────────────────
  const { data: recs } = await admin
    .from('recommendations')
    .select('id, from_user_id, to_user_id, note, created_at, film:film_id(id, title, year, poster_path, director)')
    .in('from_user_id', friendIds)
    .eq('to_user_id', user.id)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(60)

  for (const r of recs ?? []) {
    const f = Array.isArray(r.film) ? r.film[0] : r.film
    if (!f) continue
    items.push({
      id:       `rec-${r.id}`,
      entryId:  r.id,
      type:     'rec',
      userId:   r.from_user_id,
      userName: nameMap.get(r.from_user_id) ?? 'Friend',
      film: {
        id:          f.id,
        title:       f.title,
        year:        f.year ?? null,
        poster_path: f.poster_path ? posterUrl(f.poster_path, 'w185') : null,
        director:    f.director ?? null,
      },
      stars: null,
      line:  null,
      note:  r.note ?? null,
      date:  r.created_at,
      reactionCount: 0,
      hasLiked: false,
    })
  }

  // Batch-fetch reaction counts and current user's likes (library entries only)
  if (items.length > 0) {
    const entryIds = items.filter(item => item.type !== 'rec').map(item => item.entryId)
    const [{ data: reactions }, { data: myReactions }] = await Promise.all([
      admin.from('activity_reactions').select('entry_id').in('entry_id', entryIds).eq('type', 'like'),
      admin.from('activity_reactions').select('entry_id').in('entry_id', entryIds).eq('user_id', user.id).eq('type', 'like'),
    ])

    const countMap = new Map<string, number>()
    for (const r of reactions ?? []) {
      countMap.set(r.entry_id, (countMap.get(r.entry_id) ?? 0) + 1)
    }
    const likedSet = new Set((myReactions ?? []).map((r: any) => r.entry_id))

    for (const item of items) {
      item.reactionCount = countMap.get(item.entryId) ?? 0
      item.hasLiked = likedSet.has(item.entryId)
    }
  }

  // Sort newest first
  items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  return NextResponse.json({ friends, items })
}
