import { getOpenAI, MODELS } from '../openai'

export interface TasteDimensions {
  pace: number         // -1 patient/slow-burn ↔ +1 kinetic/fast
  story_engine: number // -1 character-driven ↔ +1 plot-driven
  tone: number         // -1 light/comedic ↔ +1 dark/serious
  warmth: number       // -1 cold/detached ↔ +1 warm/emotional
  complexity: number   // -1 accessible ↔ +1 challenging/layered
  style: number        // -1 restrained/minimal ↔ +1 expressive/maximalist
}

const DIM_LABELS: Record<keyof TasteDimensions, [string, string]> = {
  pace:         ['patient',     'kinetic'],
  story_engine: ['character',   'plot-driven'],
  tone:         ['light',       'dark'],
  warmth:       ['cold',        'warm'],
  complexity:   ['accessible',  'complex'],
  style:        ['restrained',  'expressive'],
}

// ── Shared taste vector computation ─────────────────────────────────────────
//
// Uses deviation-from-average weighting instead of absolute star weighting.
// This means two people who watched the same films but rated them differently
// will end up with genuinely distinct vectors.
//
// Mechanics:
//   deviation = stars - userAvg
//   dims[d] = Σ(filmDim[d] * deviation) / Σ|deviation|
//
// A film rated above your average pulls the vector toward its dimensions.
// A film rated below your average pushes the vector away from its dimensions.
// Films rated near your average contribute almost nothing.
//
export const TASTE_DIMS = ['pace', 'story_engine', 'tone', 'warmth', 'complexity', 'style'] as const

export function computeTasteVector(
  entries: { my_stars: number | null; film: { ai_brief: unknown } }[]
): TasteDimensions | null {
  const rated = entries.filter(
    e => e.my_stars != null &&
    (e.film?.ai_brief as { dimensions?: unknown } | null)?.dimensions
  )
  if (rated.length < 3) return null

  // Step 1: compute personal average rating
  const avgStars = rated.reduce((s, e) => s + (e.my_stars as number), 0) / rated.length

  // Step 2: accumulate deviation-weighted dimension signals
  const totals:     Record<string, number> = Object.fromEntries(TASTE_DIMS.map(d => [d, 0]))
  const absWeights: Record<string, number> = Object.fromEntries(TASTE_DIMS.map(d => [d, 0]))

  for (const e of rated) {
    const deviation = (e.my_stars as number) - avgStars
    // Skip films rated very close to average — they don't reveal direction
    if (Math.abs(deviation) < 0.15) continue

    const brief = e.film.ai_brief as { dimensions: Record<string, number> }
    for (const d of TASTE_DIMS) {
      totals[d]     += (brief.dimensions[d] ?? 0) * deviation
      absWeights[d] += Math.abs(deviation)
    }
  }

  // Step 3: normalize — result is in [-1, 1] since film dims are in [-1, 1]
  const safe = (d: string) => absWeights[d] > 0 ? totals[d] / absWeights[d] : 0

  return {
    pace:         safe('pace'),
    story_engine: safe('story_engine'),
    tone:         safe('tone'),
    warmth:       safe('warmth'),
    complexity:   safe('complexity'),
    style:        safe('style'),
  }
}

function describeDimension(key: keyof TasteDimensions, value: number): string {
  const [neg, pos] = DIM_LABELS[key]
  const abs = Math.abs(value)
  const intensity = abs < 0.2 ? 'slightly' : abs < 0.5 ? 'leaning' : abs < 0.75 ? 'clearly' : 'strongly'
  const direction = value >= 0 ? pos : neg
  return `${key}: ${intensity} ${direction} (${value.toFixed(2)})`
}

export async function generateTasteProse(
  dimensions: TasteDimensions,
  topGenres: string[],
  topFilms: { title: string; emotional_question: string }[],
  filmCount: number
): Promise<string | null> {
  const dimLines = (Object.keys(dimensions) as (keyof TasteDimensions)[])
    .map(k => describeDimension(k, dimensions[k]))
    .join('\n')

  const genreList = topGenres.slice(0, 5).join(', ')
  const filmList = topFilms.slice(0, 4)
    .map(f => `"${f.title}" (${f.emotional_question})`)
    .join('\n')

  try {
    const res = await getOpenAI().chat.completions.create({
      model: MODELS.smart,
      max_tokens: 160,
      messages: [
        {
          role: 'system',
          content: `You are writing a one-paragraph taste description for a film viewer, based on their watching history. This appears on their profile page — it should feel like a sharp, honest read of their sensibility, not a horoscope.

Their taste dimensions (scale: -1 to +1):
${dimLines}

Their most-watched genre flavors: ${genreList || 'not enough data'}

Films that define their profile:
${filmList || 'not enough data'}

Total films logged: ${filmCount}

Write 2-3 sentences. Be specific and opinionated — name what they're drawn to and what that reveals about them as a viewer. Lowercase. No hedging ("seems to", "tends to"). No flattery. Make it feel like an observation from someone who knows their taste well.

Output ONLY the prose paragraph.`,
        },
      ],
    })
    return res.choices[0].message.content?.trim() ?? null
  } catch {
    return null
  }
}
