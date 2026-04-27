import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: friendId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  const [{ data: friend }, { data: myUser }] = await Promise.all([
    admin.from('users').select('id, name, email').eq('id', friendId).single(),
    admin.from('users').select('name').eq('id', user.id).single(),
  ])

  if (!friend) return NextResponse.json({ error: 'friend not found' }, { status: 404 })

  // Fetch all library entries for both users
  const [{ data: myEntries }, { data: theirEntries }] = await Promise.all([
    admin.from('library_entries').select('film_id, list, my_stars, my_line, moods, finished_at').eq('user_id', user.id),
    admin.from('library_entries').select('film_id, list, my_stars, my_line, moods, finished_at').eq('user_id', friendId),
  ])

  // Build maps per list
  const myByList: Record<string, Map<string, any>> = { watched: new Map(), now_playing: new Map(), watchlist: new Map() }
  const theirByList: Record<string, Map<string, any>> = { watched: new Map(), now_playing: new Map(), watchlist: new Map() }
  for (const e of myEntries ?? []) myByList[e.list]?.set(e.film_id, e)
  for (const e of theirEntries ?? []) theirByList[e.list]?.set(e.film_id, e)

  // Find crossover film ids per list
  const watchedIds = [...myByList.watched.keys()].filter(id => theirByList.watched.has(id))
  const watchingIds = [...myByList.now_playing.keys()].filter(id => theirByList.now_playing.has(id))
  const wantIds = [...myByList.watchlist.keys()].filter(id => theirByList.watchlist.has(id))
  const allIds = [...new Set([...watchedIds, ...watchingIds, ...wantIds])]

  // Fetch film metadata for all crossover films
  const films: Record<string, any> = {}
  if (allIds.length > 0) {
    const { data: filmRows } = await admin.from('films').select('id, title, year, poster_path, director').in('id', allIds)
    for (const f of filmRows ?? []) films[f.id] = f
  }

  const buildCrossover = (ids: string[], myMap: Map<string, any>, theirMap: Map<string, any>) =>
    ids.filter(id => films[id]).map(id => ({ film: films[id], me: myMap.get(id), them: theirMap.get(id) }))

  const bothWatched = buildCrossover(watchedIds, myByList.watched, theirByList.watched)
  const bothWatching = buildCrossover(watchingIds, myByList.now_playing, theirByList.now_playing)
  const bothWant = buildCrossover(wantIds, myByList.watchlist, theirByList.watchlist)

  // Shared taste tags from interviews
  const [{ data: myInterviews }, { data: theirInterviews }] = await Promise.all([
    admin.from('interviews').select('taste_tags').eq('user_id', user.id),
    admin.from('interviews').select('taste_tags').eq('user_id', friendId),
  ])
  const myTags = new Set((myInterviews ?? []).flatMap(i => i.taste_tags ?? []))
  const theirTags = new Set((theirInterviews ?? []).flatMap(i => i.taste_tags ?? []))
  const sharedTastes = [...myTags].filter(t => theirTags.has(t)).slice(0, 6)

  // Discussion prompt for both-watched crossovers
  let prompt: string | null = null
  if (bothWatched.length > 0) {
    const myName = myUser?.name ?? 'you'
    const filmSummaries = bothWatched.slice(0, 5).map(c =>
      `"${c.film.title}" — ${myName}: ${c.me?.my_stars ?? '?'}★${c.me?.my_line ? ` "${c.me.my_line}"` : ''} | ${friend.name}: ${c.them?.my_stars ?? '?'}★${c.them?.my_line ? ` "${c.them.my_line}"` : ''}`
    ).join('\n')
    try {
      const res = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        max_tokens: 100,
        messages: [{
          role: 'system',
          content: 'Write one short film discussion question (1–2 sentences, lowercase, warm, curious) referencing the actual films. No preamble.'
        }, {
          role: 'user',
          content: `${myName} and ${friend.name} both watched:\n${filmSummaries}\nWrite one discussion prompt.`
        }]
      })
      prompt = res.choices[0]?.message?.content?.trim() ?? null
    } catch { prompt = null }
  }

  return NextResponse.json({ friend, myName: myUser?.name, bothWatched, bothWatching, bothWant, sharedTastes, prompt })
}
