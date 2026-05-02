import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ALL_POLES, RatedFilmEntry } from '@/lib/taste-code'
import { FilmDimensionsV2 } from '@/lib/prompts/film-brief'
import { posterUrl } from '@/lib/types'

const EXTREME_PCT = 0.20
const MIN_FILMS   = 4

// Human-readable axis label for each dimension
const DIM_AXIS: Record<string, string> = {
  narrative_legibility:    'Legible ↔ Opaque',
  emotional_directness:    'Vivid ↔ Subtle',
  plot_vs_character:       'Plot ↔ Character',
  naturalistic_vs_stylized:'Naturalistic ↔ Theatrical',
  narrative_closure:       'Whole ↔ Questioning',
  intimate_vs_epic:        'Intimate ↔ Epic',
  accessible_vs_demanding: 'Familiar ↔ Demanding',
  psychological_safety:    'Hopeful ↔ Unsettling',
  moral_clarity:           'Just ↔ Ambiguous',
  behavioral_realism:      'Realistic ↔ Archetypal',
  sensory_vs_intellectual: 'Gut ↔ Mind',
  kinetic_vs_patient:      'Kinetic ↔ Zen',
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { data: entries, error } = await supabase
    .from('library_entries')
    .select('*, film:films(*)')
    .eq('user_id', user.id)
    .eq('list', 'watched')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const allWatched = entries ?? []

  // Same filter as computeTasteCode — only films with dimensions_v2 + a star rating
  const films: RatedFilmEntry[] = allWatched
    .filter(e => e.my_stars != null && (e.film?.ai_brief as { dimensions_v2?: unknown } | null)?.dimensions_v2)
    .map(e => ({
      film_id:       e.film_id as string,
      title:         (e.film?.title ?? '') as string,
      poster_path:   e.film?.poster_path ? posterUrl(e.film.poster_path, 'w185') : null,
      stars:         e.my_stars as number,
      dimensions_v2: (e.film.ai_brief as { dimensions_v2: FilmDimensionsV2 }).dimensions_v2,
    }))

  if (films.length < MIN_FILMS * 2) {
    return NextResponse.json({ error: 'not enough rated films' }, { status: 400 })
  }

  // For each dimension, compute extreme quartile for both poles
  const dimKeys = [...new Set(ALL_POLES.map(p => p.dimKey))]

  // Compute global normalization (same as computeTasteCode) so we can report
  // normalized scores alongside the raw dim scores
  const poleAvgs: Map<string, { avg: number; films: RatedFilmEntry[] }> = new Map()
  for (const dimKey of dimKeys) {
    const sorted  = [...films].sort((a, b) => a.dimensions_v2[dimKey] - b.dimensions_v2[dimKey])
    const cutoff  = Math.max(MIN_FILMS, Math.floor(sorted.length * EXTREME_PCT))
    const leftFs  = sorted.slice(0, cutoff)
    const rightFs = sorted.slice(sorted.length - cutoff)
    poleAvgs.set(`${dimKey}:left`,  { avg: leftFs.reduce((s, f)  => s + f.stars, 0) / leftFs.length,  films: leftFs })
    poleAvgs.set(`${dimKey}:right`, { avg: rightFs.reduce((s, f) => s + f.stars, 0) / rightFs.length, films: rightFs })
  }
  const allAvgs  = [...poleAvgs.values()].map(v => v.avg)
  const gMin     = Math.min(...allAvgs)
  const gMax     = Math.max(...allAvgs)
  const gRange   = gMax - gMin
  const normalize = (avg: number) => gRange === 0 ? 50 : Math.round(((avg - gMin) / gRange) * 100)

  // Compute gaps so we can rank dimensions and note dominant pole
  const dimGaps = dimKeys.map(dimKey => {
    const lv = poleAvgs.get(`${dimKey}:left`)!
    const rv = poleAvgs.get(`${dimKey}:right`)!
    const ls = normalize(lv.avg)
    const rs = normalize(rv.avg)
    const gap = Math.abs(ls - rs)
    const dominant: 'left' | 'right' = rs >= ls ? 'right' : 'left'
    return { dimKey, gap, dominant, leftScore: ls, rightScore: rs, leftFilms: lv.films, rightFilms: rv.films }
  }).sort((a, b) => b.gap - a.gap)

  // ── Build CSV ────────────────────────────────────────────────────────────────
  const csvRows: string[] = [
    // Header
    [
      'Rank', 'Dimension', 'Axis', 'Pole', 'Is Dominant Pole',
      'Pole Score (0-100)', 'Opposite Score (0-100)', 'Gap', 'Extreme Quartile Cutoff',
      'Film', 'Your Stars', 'Dim Score (0-100)',
    ].join(','),
  ]

  for (let i = 0; i < dimGaps.length; i++) {
    const { dimKey, gap, dominant, leftScore, rightScore, leftFilms, rightFilms } = dimGaps[i]
    const rank = i + 1
    const axis = DIM_AXIS[dimKey] ?? dimKey
    const cutoff = Math.max(MIN_FILMS, Math.floor(films.length * EXTREME_PCT))

    const leftPole  = ALL_POLES.find(p => p.dimKey === dimKey && p.pole === 'left')!
    const rightPole = ALL_POLES.find(p => p.dimKey === dimKey && p.pole === 'right')!

    // Sort each group: dominant pole → highest stars first; opposite pole → lowest stars first
    // This makes the data self-explanatory: dominant pole shows what you love, opposite shows what dragged opposite avg down
    const sortedLeft  = [...leftFilms].sort((a, b) =>
      dominant === 'left' ? b.stars - a.stars : a.stars - b.stars
    )
    const sortedRight = [...rightFilms].sort((a, b) =>
      dominant === 'right' ? b.stars - a.stars : a.stars - b.stars
    )

    const emitFilms = (
      filmList: RatedFilmEntry[],
      poleName: string,
      isDominant: boolean,
      poleScore: number,
      oppScore: number,
    ) => {
      for (const f of filmList) {
        const dimRaw = Math.round(f.dimensions_v2[dimKey])
        csvRows.push([
          rank,
          `"${dimKey}"`,
          `"${axis}"`,
          `"${poleName}"`,
          isDominant ? 'YES' : 'no',
          poleScore,
          oppScore,
          gap,
          cutoff,
          `"${f.title.replace(/"/g, '""')}"`,
          f.stars.toFixed(1),
          dimRaw,
        ].join(','))
      }
    }

    emitFilms(sortedLeft,  leftPole.label,  dominant === 'left',  leftScore,  rightScore)
    emitFilms(sortedRight, rightPole.label, dominant === 'right', rightScore, leftScore)

    // Blank separator row between dimensions for readability
    csvRows.push('')
  }

  const csv = csvRows.join('\n')

  return new NextResponse(csv, {
    headers: {
      'Content-Type':        'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="taste-dimensions-export.csv"',
    },
  })
}
