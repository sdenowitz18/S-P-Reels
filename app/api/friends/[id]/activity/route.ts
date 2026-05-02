import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { posterUrl } from '@/lib/types'

export type ActivityType = 'watch' | 'watchlist' | 'now_playing' | 'rec'

export interface ActivityItem {
  id: string
  type: ActivityType
  isMe: boolean
  userName: string
  userId: string
  film: {
    id: string
    title: string
    year: number | null
    poster_path: string | null
    director: string | null
  }
  stars: number | null
  line: string | null
  note: string | null
  date: string
  // rec-only
  recId:       string | null
  toUserName:  string | null
  comments:    { id: string; text: string; created_at: string; user: { id: string; name: string } }[]
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: friendId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  // Verify friendship
  const { data: friendship } = await supabase
    .from('friend_requests')
    .select('id')
    .eq('status', 'accepted')
    .or(`and(from_user_id.eq.${user.id},to_user_id.eq.${friendId}),and(from_user_id.eq.${friendId},to_user_id.eq.${user.id})`)
    .limit(1)
    .maybeSingle()

  if (!friendship) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const admin = createAdminClient()

  // Names
  const [{ data: meRow }, { data: themRow }] = await Promise.all([
    admin.from('users').select('name').eq('id', user.id).single(),
    admin.from('users').select('name').eq('id', friendId).single(),
  ])
  const myName    = (meRow?.name   as string | null) ?? 'You'
  const theirName = (themRow?.name as string | null) ?? 'Them'

  // Library entries — both users
  const [{ data: myEntries }, { data: theirEntries }] = await Promise.all([
    admin
      .from('library_entries')
      .select('id, list, my_stars, my_line, added_at, finished_at, film:films(id, title, year, poster_path, director)')
      .eq('user_id', user.id)
      .in('list', ['watched', 'watchlist', 'now_playing'])
      .order('added_at', { ascending: false })
      .limit(60),
    admin
      .from('library_entries')
      .select('id, list, my_stars, my_line, added_at, finished_at, film:films(id, title, year, poster_path, director)')
      .eq('user_id', friendId)
      .in('list', ['watched', 'watchlist', 'now_playing'])
      .order('added_at', { ascending: false })
      .limit(60),
  ])

  // Recs between the two users
  const { data: recs } = await admin
    .from('recommendations')
    .select('*, film:film_id(id, title, year, poster_path, director), from_user:from_user_id(id, name), to_user:to_user_id(id, name)')
    .or(`and(from_user_id.eq.${user.id},to_user_id.eq.${friendId}),and(from_user_id.eq.${friendId},to_user_id.eq.${user.id})`)
    .order('created_at', { ascending: false })

  // Comments for recs
  const recIds = (recs ?? []).map(r => r.id)
  const commentsByRec = new Map<string, typeof items[0]['comments']>()
  if (recIds.length > 0) {
    const { data: comments } = await admin
      .from('rec_comments')
      .select('*, user:user_id(id, name)')
      .in('rec_id', recIds)
      .order('created_at', { ascending: true })
    for (const c of comments ?? []) {
      if (!commentsByRec.has(c.rec_id)) commentsByRec.set(c.rec_id, [])
      commentsByRec.get(c.rec_id)!.push({
        id: c.id, text: c.text, created_at: c.created_at,
        user: { id: c.user.id, name: c.user.name },
      })
    }
    // Mark notifications read
    await admin.from('notifications').update({ read: true })
      .eq('user_id', user.id).in('rec_id', recIds)
  }

  const items: ActivityItem[] = []

  // Library → activity items
  function entryDate(e: { list: string; added_at: string | null; finished_at: string | null }): string {
    return (e.list === 'watched' ? (e.finished_at ?? e.added_at) : e.added_at) ?? new Date().toISOString()
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function filmFromEntry(e: any) {
    const f = Array.isArray(e.film) ? e.film[0] : e.film
    if (!f) return null
    return {
      id:          f.id as string,
      title:       f.title as string,
      year:        (f.year ?? null) as number | null,
      poster_path: f.poster_path ? posterUrl(f.poster_path as string, 'w92') : null,
      director:    (f.director ?? null) as string | null,
    }
  }

  for (const e of [...(myEntries ?? []), ...(theirEntries ?? [])]) {
    const film = filmFromEntry(e)
    if (!film) continue
    const isMe = !theirEntries?.some(te => te.id === e.id)
    items.push({
      id:          `entry-${e.id}`,
      type:        e.list as ActivityType,
      isMe,
      userName:    isMe ? myName : theirName,
      userId:      isMe ? user.id : friendId,
      film,
      stars:       (e.my_stars ?? null) as number | null,
      line:        (e.my_line  ?? null) as string | null,
      note:        null,
      date:        entryDate(e),
      recId:       null,
      toUserName:  null,
      comments:    [],
    })
  }

  // Recs → activity items
  for (const r of recs ?? []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const f = Array.isArray(r.film) ? (r.film as any[])[0] : r.film
    if (!f) continue
    const isMe = r.from_user_id === user.id
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const toUser = Array.isArray(r.to_user) ? (r.to_user as any[])[0] : r.to_user
    items.push({
      id:          `rec-${r.id}`,
      type:        'rec',
      isMe,
      userName:    isMe ? myName : theirName,
      userId:      isMe ? user.id : friendId,
      film: {
        id:          f.id,
        title:       f.title,
        year:        f.year ?? null,
        poster_path: f.poster_path ? posterUrl(f.poster_path as string, 'w92') : null,
        director:    f.director ?? null,
      },
      stars:       null,
      line:        null,
      note:        (r.note ?? null) as string | null,
      date:        r.created_at as string,
      recId:       r.id as string,
      toUserName:  (toUser?.name ?? null) as string | null,
      comments:    commentsByRec.get(r.id) ?? [],
    })
  }

  // Sort newest first
  items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  return NextResponse.json({ items, myName, theirName })
}
