import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getOpenAI, MODELS } from '@/lib/openai'
import { getOrCacheFilm } from '@/lib/tmdb'

const DIMS = ['pace', 'story_engine', 'tone', 'warmth', 'complexity', 'style'] as const

const DIM_LABELS: Record<string, [string, string]> = {
  pace:         ['patient/slow-burn', 'kinetic/fast-paced'],
  story_engine: ['character-driven',  'plot-driven'],
  tone:         ['light/comedic',     'dark/serious'],
  warmth:       ['cold/detached',     'warm/emotional'],
  complexity:   ['accessible',        'complex/challenging'],
  style:        ['restrained/minimal','expressive/maximalist'],
}

function describeDim(key: string, value: number): string {
  const [neg, pos] = DIM_LABELS[key] ?? [key, key]
  const abs = Math.abs(value)
  const intensity = abs < 0.15 ? 'neutral' : abs < 0.4 ? 'leaning' : abs < 0.7 ? 'clearly' : 'strongly'
  return `${key}: ${intensity} ${value >= 0 ? pos : neg} (${value.toFixed(2)})`
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ filmId: string }> }
) {
  const { filmId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  // Fetch the film — cache from TMDB if not already in DB
  let film: Awaited<ReturnType<typeof getOrCacheFilm>> | null = null
  try {
    film = await getOrCacheFilm(supabase, filmId)
  } catch {
    // fall through — we'll still generate a match from GPT's knowledge
  }

  // Compute user's taste vector
  const { data: entries } = await supabase
    .from('library_entries')
    .select('my_stars, film:films(title, ai_brief)')
    .eq('user_id', user.id)
    .eq('list', 'watched')

  type RawEntry = { my_stars: number | null; film: { title: string; ai_brief: { dimensions?: Record<string, number>; genres?: string[] } | null } | null }
  const rated = ((entries ?? []) as unknown as RawEntry[]).filter(e => e.my_stars != null && e.film?.ai_brief?.dimensions)

  if (rated.length < 3) {
    return NextResponse.json({ match: null, reason: 'not_enough_data' })
  }

  const dimTotals: Record<string, number> = Object.fromEntries(DIMS.map(d => [d, 0]))
  const dimWeights: Record<string, number> = Object.fromEntries(DIMS.map(d => [d, 0]))

  for (const entry of rated) {
    const dims = entry.film!.ai_brief!.dimensions as Record<string, number>
    const w = (entry.my_stars as number) / 5
    for (const d of DIMS) {
      dimTotals[d] += (dims[d] ?? 0) * w
      dimWeights[d] += w
    }
  }

  const userDims = Object.fromEntries(
    DIMS.map(d => [d, dimWeights[d] > 0 ? dimTotals[d] / dimWeights[d] : 0])
  )

  // Top genres
  const genreScores: Record<string, number> = {}
  for (const entry of rated) {
    const genres: string[] = entry.film?.ai_brief?.genres ?? []
    const w = (entry.my_stars as number) / 5
    for (const g of genres) genreScores[g] = (genreScores[g] ?? 0) + w
  }
  const topGenres = Object.entries(genreScores)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([g]) => g)

  // Top rated films for context
  const topFilms = [...rated]
    .sort((a, b) => (b.my_stars as number) - (a.my_stars as number))
    .slice(0, 5)
    .map(e => e.film!.title)

  const userDimLines = DIMS.map(d => describeDim(d, userDims[d])).join('\n')

  // Build film context — use brief if available, fall back to TMDB data + GPT knowledge
  type BriefShape = {
    tone?: string; genres?: string[]; discourse?: { loved?: string; wrestled_with?: string }
    viewer_fit?: { connects?: string; bounces?: string }; emotional_question?: string
    dimensions?: Record<string, number>
  }
  const brief = (film?.ai_brief ?? null) as BriefShape | null

  let filmDimLines = ''
  if (brief?.dimensions) {
    filmDimLines = `\nFilm dimensions:\n${DIMS.map(d => describeDim(d, (brief.dimensions as Record<string, number>)[d] ?? 0)).join('\n')}`
  }

  const filmContext = film ? [
    `Film: "${film.title}" (${film.year ?? '?'}, dir. ${film.director ?? 'unknown'})`,
    film.synopsis ? `Synopsis: ${film.synopsis}` : null,
    (film.tmdb_genres as string[] | null)?.length ? `Broad genres: ${(film.tmdb_genres as string[]).join(', ')}` : null,
    brief?.tone ? `Tone: ${brief.tone}` : null,
    brief?.genres?.length ? `Nuanced genres: ${brief.genres.join(', ')}` : null,
    brief?.discourse?.loved ? `What audiences loved: ${brief.discourse.loved}` : null,
    brief?.discourse?.wrestled_with ? `What audiences wrestled with: ${brief.discourse.wrestled_with}` : null,
    brief?.viewer_fit?.connects ? `Connects with: ${brief.viewer_fit.connects}` : null,
    brief?.viewer_fit?.bounces ? `Bounces off: ${brief.viewer_fit.bounces}` : null,
    brief?.emotional_question ? `Emotional question: ${brief.emotional_question}` : null,
    filmDimLines,
  ].filter(Boolean).join('\n') : `Film ID: ${filmId} (no data cached yet)`

  try {
    const filmTitle = film?.title ?? filmId
    const filmYear = film?.year ?? null

    const res = await getOpenAI().chat.completions.create({
      model: MODELS.smart,
      max_tokens: 160,
      messages: [{
        role: 'system',
        content: `You're helping a film viewer decide whether to watch "${filmTitle}"${filmYear ? ` (${filmYear})` : ''} by comparing their taste profile to the film's qualities.

VIEWER'S TASTE PROFILE:
${userDimLines}

Top genres they enjoy: ${topGenres.join(', ') || 'not enough data'}
Films they love: ${topFilms.join(', ')}

FILM:
${filmContext}

${!brief ? `Note: No detailed brief exists yet for this film — draw on your knowledge of "${filmTitle}"${filmYear ? ` (${filmYear})` : ''} to inform your assessment.` : ''}

Write 2-3 sentences giving a direct, honest opinion on whether this viewer will connect with this film. Reference specific qualities from BOTH the viewer's profile AND this film. If there's a real mismatch, say so. Start with "you" not "this viewer". Lowercase. No hedging ("might", "could", "perhaps"). Make it feel like a knowledgeable friend who knows their taste.

Output ONLY the 2-3 sentence assessment.`
      }]
    })

    const match = res.choices[0].message.content?.trim() ?? null
    return NextResponse.json({ match })
  } catch {
    return NextResponse.json({ error: 'generation failed' }, { status: 500 })
  }
}
