import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getOpenAI, MODELS } from '@/lib/openai'
import { searchFilms } from '@/lib/tmdb'

const DIMS = ['pace', 'story_engine', 'tone', 'warmth', 'complexity', 'style'] as const
const STALE_MS = 12 * 60 * 60 * 1000 // 12 hours

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
  const intensity = abs < 0.15 ? 'neutral on' : abs < 0.4 ? 'leaning' : abs < 0.7 ? 'clearly' : 'strongly'
  return `${key}: ${intensity} ${value >= 0 ? pos : neg} (${value.toFixed(2)})`
}

type FilmResult = {
  id: string; title: string; year: number | null; director: string | null
  poster_path: string | null; tone: string | null; genres: string[]
}

async function generate(supabase: Awaited<ReturnType<typeof createClient>>, userId: string): Promise<FilmResult[]> {
  // Get user's full library (watched + watchlist) for exclusion
  const { data: entries } = await supabase
    .from('library_entries')
    .select('film_id, my_stars, list, film:films(title, ai_brief)')
    .eq('user_id', userId)

  type RawEntry = {
    film_id: string; my_stars: number | null; list: string
    film: { title: string; ai_brief: { dimensions?: Record<string, number>; genres?: string[] } | null } | null
  }
  const allEntries = (entries ?? []) as unknown as RawEntry[]

  // Exclude EVERYTHING in the library — watched AND watchlist
  const libraryFilmIds = new Set(allEntries.map(e => e.film_id))
  const watchedTitles = allEntries.map(e => e.film?.title).filter(Boolean) as string[]

  // Need rated films with briefs to compute taste vector
  const rated = allEntries.filter(e => e.my_stars != null && e.film?.ai_brief?.dimensions)
  if (rated.length < 3) return []

  // Weighted taste vector
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
  const topGenres = Object.entries(genreScores).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([g]) => g)

  // Top + bottom rated films for GPT context
  const sortedByRating = [...rated].sort((a, b) => (b.my_stars as number) - (a.my_stars as number))
  const topFilms = sortedByRating.slice(0, 8).map(e => e.film!.title)
  const lowFilms = sortedByRating.slice(-4).map(e => e.film!.title)

  const dimDesc = DIMS.map(d => describeDim(d, userDims[d])).join('\n')

  // Ask GPT for personalized suggestions
  let suggestions: { title: string; year: number }[] = []
  try {
    const res = await getOpenAI().chat.completions.create({
      model: MODELS.fast,
      max_tokens: 600,
      response_format: { type: 'json_object' },
      messages: [{
        role: 'system',
        content: `You are a film recommendation engine. Based on a viewer's taste profile, suggest films they'll likely love that they haven't already seen.

VIEWER TASTE PROFILE:
${dimDesc}

Top genres they enjoy: ${topGenres.join(', ') || 'unknown'}

Films they rated highly: ${topFilms.join(', ')}
Films they rated poorly: ${lowFilms.join(', ') || 'none'}

Films already in their library — DO NOT recommend any of these (watched + saved):
${watchedTitles.slice(0, 250).join(', ')}

Suggest exactly 18 films. Prioritize films that genuinely match their taste dimensions. Vary by era (mix classic and contemporary). Include well-known and less-obvious picks. No documentaries or short films.

Output ONLY valid JSON: { "films": [{ "title": "...", "year": 2010 }, ...] }`
      }]
    })
    const parsed = JSON.parse(res.choices[0].message.content?.trim() ?? '{}')
    suggestions = (parsed.films ?? []).slice(0, 18) as { title: string; year: number }[]
  } catch {
    return []
  }

  if (!suggestions.length) return []

  // Search TMDB for each suggestion in parallel
  const tmdbResults = await Promise.allSettled(
    suggestions.map(async ({ title, year }) => {
      try {
        const hits = await searchFilms(title, 'movie')
        if (!hits.length) return null
        const match =
          hits.find(h => h.title.toLowerCase() === title.toLowerCase() && h.year === year) ??
          hits.find(h => h.title.toLowerCase() === title.toLowerCase()) ??
          hits[0]
        if (!match) return null
        if (libraryFilmIds.has(match.id)) return null  // double-check exclusion
        return {
          id: match.id, title: match.title, year: match.year,
          director: match.director, poster_path: match.poster_path,
          tone: null as string | null, genres: [] as string[],
        } satisfies FilmResult
      } catch {
        return null
      }
    })
  )

  const films: FilmResult[] = tmdbResults
    .filter(r => r.status === 'fulfilled' && r.value !== null)
    .map(r => (r as PromiseFulfilledResult<FilmResult>).value)
    .filter((v, i, arr) => arr.findIndex(x => x.id === v.id) === i)
    .slice(0, 16)

  // Enrich with brief data for already-cached films
  if (films.length > 0) {
    const { data: cached } = await supabase
      .from('films')
      .select('id, ai_brief')
      .in('id', films.map(f => f.id))

    const briefMap = new Map(
      ((cached ?? []) as { id: string; ai_brief: { tone?: string; genres?: string[] } | null }[])
        .map(c => [c.id, c.ai_brief])
    )
    for (const film of films) {
      const brief = briefMap.get(film.id)
      if (brief) { film.tone = brief.tone ?? null; film.genres = brief.genres ?? [] }
    }
  }

  return films
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const forceRefresh = req.nextUrl.searchParams.get('refresh') === '1'

  // Check cache
  const { data: cached } = await supabase
    .from('taste_recommendations')
    .select('films, generated_at')
    .eq('user_id', user.id)
    .single()

  const cacheAge = cached ? Date.now() - new Date(cached.generated_at).getTime() : Infinity
  const cacheExists = cached && Array.isArray(cached.films) && cached.films.length > 0

  // Return cache immediately if fresh enough and not forced refresh
  if (cacheExists && !forceRefresh && cacheAge < STALE_MS) {
    return NextResponse.json({ films: cached.films, cached: true })
  }

  // Return stale cache immediately, kick off background refresh
  if (cacheExists && !forceRefresh && cacheAge >= STALE_MS) {
    // Fire background regeneration without awaiting
    generate(supabase, user.id).then(films => {
      if (films.length > 0) {
        supabase.from('taste_recommendations').upsert({
          user_id: user.id, films, generated_at: new Date().toISOString(),
        })
      }
    }).catch(() => {})

    return NextResponse.json({ films: cached.films, cached: true, stale: true })
  }

  // No cache or forced refresh — generate now
  const films = await generate(supabase, user.id)

  if (films.length > 0) {
    await supabase.from('taste_recommendations').upsert({
      user_id: user.id, films, generated_at: new Date().toISOString(),
    })
  }

  return NextResponse.json({ films, cached: false })
}
