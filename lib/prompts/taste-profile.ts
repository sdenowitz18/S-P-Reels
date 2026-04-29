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
