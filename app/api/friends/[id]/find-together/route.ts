import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { TasteDimensions, computeTasteVector } from '@/lib/prompts/taste-profile'
import { FilmBrief } from '@/lib/prompts/film-brief'
import { posterUrl } from '@/lib/types'

const DIMS = ['pace', 'story_engine', 'tone', 'warmth', 'complexity', 'style'] as const

function dotScore(filmDims: Record<string, number>, target: TasteDimensions): number {
  return DIMS.reduce((s, d) => s + (1 - Math.abs((filmDims[d] ?? 0) - target[d])) / 2, 0) / DIMS.length
}

export async function POST(
  req: NextRequest,
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

  const { excludeFilmIds = [] }: { excludeFilmIds: string[] } = await req.json()
  const admin = createAdminClient()

  // Fetch both users' watched entries for taste vectors
  const [{ data: myEntries }, { data: theirEntries }] = await Promise.all([
    admin.from('library_entries').select('my_stars, film:films(ai_brief)').eq('user_id', user.id).eq('list', 'watched'),
    admin.from('library_entries').select('my_stars, film:films(ai_brief)').eq('user_id', friendId).eq('list', 'watched'),
  ])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const toEntries = (rows: any[] | null) => (rows ?? []).map(r => ({
    my_stars: r.my_stars as number | null,
    film: { ai_brief: Array.isArray(r.film) ? r.film[0]?.ai_brief : r.film?.ai_brief },
  }))

  const myVec    = computeTasteVector(toEntries(myEntries))
  const theirVec = computeTasteVector(toEntries(theirEntries))

  // Blend: average the two vectors (or use whichever exists)
  const blendVec: TasteDimensions = myVec && theirVec
    ? { pace: (myVec.pace + theirVec.pace) / 2, story_engine: (myVec.story_engine + theirVec.story_engine) / 2,
        tone: (myVec.tone + theirVec.tone) / 2, warmth: (myVec.warmth + theirVec.warmth) / 2,
        complexity: (myVec.complexity + theirVec.complexity) / 2, style: (myVec.style + theirVec.style) / 2 }
    : myVec ?? theirVec ?? { pace: 0, story_engine: 0, tone: 0, warmth: 0, complexity: 0, style: 0 }

  // Fetch candidate films (have ai_brief, not in excluded set)
  const excludeSet = new Set(excludeFilmIds)

  const { data: candidates } = await admin
    .from('films')
    .select('id, title, year, poster_path, director, ai_brief')
    .not('ai_brief', 'is', null)
    .limit(600)

  const scored = (candidates ?? [])
    .filter(f => !excludeSet.has(`movie-${f.id}`) && !excludeSet.has(f.id))
    .map(f => {
      const dims = (f.ai_brief as { dimensions?: Record<string, number> })?.dimensions
      if (!dims) return null
      return { f, score: dotScore(dims, blendVec) }
    })
    .filter(Boolean)
    .sort((a, b) => b!.score - a!.score)
    .slice(0, 8)

  const films = scored.map(item => {
    const { f } = item!
    return {
      film_id: f.id as string,
      title: f.title as string,
      year: (f.year ?? null) as number | null,
      poster_path: f.poster_path ? posterUrl(f.poster_path as string, 'w342') : null,
      director: (f.director ?? null) as string | null,
      genres: [],
      cast: [],
      my_stars: null,
    }
  })

  return NextResponse.json({ films })
}
