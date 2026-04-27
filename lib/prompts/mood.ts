import { getOpenAI, MODELS } from '../openai'
import { validateFilmTitle } from '../tmdb'

interface MoodInput {
  kind: 'movie' | 'tv' | 'either'
  moods: string[]
  runtime: 'short' | 'medium' | 'long'
  userTags: string[]
  groupTags: string[]
  recentTitles: string[]
  watchedTitles: string[]
}

interface MoodResult {
  filmId: string
  title: string
  year: number
  dir: string
  why: string
}

const RUNTIME_LABELS = { short: 'under 90 min', medium: '90–120 min', long: 'over 120 min' }

export async function recommendMoodFilm(input: MoodInput): Promise<MoodResult | null> {
  const tags = [...new Set([...input.userTags, ...input.groupTags])]

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await getOpenAI().chat.completions.create({
        model: MODELS.quality,
        max_tokens: 150,
        response_format: { type: 'json_object' },
        messages: [{
          role: 'user',
          content: `You are recommending a single film for tonight. Be confident, be specific.

The viewer(s):
- Taste tags: ${tags.join(', ') || 'eclectic'}
- Recently watched: ${input.recentTitles.join(', ') || 'nothing recent'}
- Already saw (avoid): ${input.watchedTitles.slice(0, 30).join(', ') || 'nothing'}

Tonight they want:
- Kind: ${input.kind}
- Mood: ${input.moods.join(', ')}
- Runtime: ${RUNTIME_LABELS[input.runtime]}

Pick ONE title that fits. Not the most-famous one — the right one. Return JSON:
{"title": "...", "year": 1234, "dir": "...", "why": "one short sentence, lowercase, why this is the call."}

ONLY JSON.`,
        }],
      })

      const pick = JSON.parse(res.choices[0].message.content ?? '{}')
      if (!pick.title) continue

      if (input.watchedTitles.includes(pick.title)) continue

      const filmId = await validateFilmTitle(pick.title, pick.year)
      if (!filmId) continue

      return { filmId, title: pick.title, year: pick.year, dir: pick.dir, why: pick.why }
    } catch {
      continue
    }
  }
  return null
}
