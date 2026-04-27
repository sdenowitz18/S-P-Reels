import { Film, ReflectionResult, SimilarFilm } from '../types'
import { getOpenAI, MODELS } from '../openai'
import { validateFilmTitle } from '../tmdb'

export async function generateReflection(
  film: Film,
  userAnswers: string[],
  existingTags: string[],
  recentTitles: string[]
): Promise<ReflectionResult> {
  const answersText = userAnswers.join('\n\n')

  // fire 3 parallel calls
  const [tagsResult, shiftsResult, similarResult] = await Promise.all([
    generateTasteRead(film, answersText),
    generateShifts(film, answersText, existingTags, recentTitles),
    generateSimilar(film, recentTitles),
  ])

  return {
    taste_tags: tagsResult.tags,
    taste_note: tagsResult.note,
    shifts: shiftsResult,
    similar: similarResult,
  }
}

async function generateTasteRead(film: Film, answersText: string): Promise<{ tags: string[], note: string }> {
  try {
    const res = await getOpenAI().chat.completions.create({
      model: MODELS.fast,
      max_tokens: 150,
      response_format: { type: 'json_object' },
      messages: [{
        role: 'user',
        content: `A user just finished "${film.title}" (${film.year ?? 'unknown year'}, dir. ${film.director ?? 'unknown'}). Their answers in a short reflective interview were:

${answersText}

Identify 2-4 short taste tags (lowercase, hyphen-separated, 1-3 words each) that this engagement reveals about their cinematic taste. Examples: "slow-burn", "painterly", "character-study", "dialogue-driven".

Then write ONE short sentence (lowercase, plain, no flourish) reflecting back what kind of viewer this engagement reveals.

Return JSON:
{"tags": ["tag-one", "tag-two"], "note": "one short reflection sentence."}

ONLY JSON, no markdown.`,
      }],
    })
    return JSON.parse(res.choices[0].message.content ?? '{}')
  } catch {
    return { tags: ['attentive-viewer'], note: 'you watch with care and look for what lingers.' }
  }
}

async function generateShifts(
  film: Film,
  answersText: string,
  existingTags: string[],
  recentTitles: string[]
): Promise<string> {
  try {
    const res = await getOpenAI().chat.completions.create({
      model: MODELS.fast,
      max_tokens: 60,
      messages: [{
        role: 'user',
        content: `A user just finished "${film.title}" (${film.year ?? 'unknown year'}, dir. ${film.director ?? 'unknown'}).

Their existing taste tags: ${existingTags.join(', ') || 'none yet'}.
Recently watched: ${recentTitles.join(', ') || 'nothing recent'}.

Their answers in the reflection: ${answersText}

In ONE short sentence (lowercase, plain, 12-24 words), describe how this film fits into or expands their existing taste. Concrete — e.g. "this widens your taste for X" or "this confirms what you already love about Y." No throat-clearing, no "interesting", just the read. Output ONLY the sentence.`,
      }],
    })
    return res.choices[0].message.content?.trim() ?? 'this one fits into what you already love.'
  } catch {
    return 'this one fits into what you already love.'
  }
}

async function generateSimilar(film: Film, recentTitles: string[]): Promise<SimilarFilm[]> {
  try {
    const res = await getOpenAI().chat.completions.create({
      model: MODELS.fast,
      max_tokens: 300,
      response_format: { type: 'json_object' },
      messages: [{
        role: 'user',
        content: `A user just finished "${film.title}" (${film.year ?? 'unknown year'}, dir. ${film.director ?? 'unknown'}).

Suggest exactly THREE other films they would likely love, based on this one. For each: title, year, director, one-short-sentence reason (lowercase, plain, no flourish, max 14 words).

Avoid the obvious. Don't suggest the same director's most-famous adjacent film if there's a better, less-on-the-nose pick. Don't suggest anything in: ${recentTitles.join(', ') || 'nothing to avoid'}.

Return JSON:
{"films": [{"title":"...", "year": 1234, "dir":"...", "why":"..."}]}

ONLY JSON, no markdown.`,
      }],
    })
    const parsed = JSON.parse(res.choices[0].message.content ?? '{}')
    const candidates: SimilarFilm[] = parsed.films ?? []

    // validate each title exists in TMDB
    const validated: SimilarFilm[] = []
    for (const c of candidates) {
      const id = await validateFilmTitle(c.title, c.year)
      if (id) validated.push(c)
      if (validated.length === 3) break
    }
    return validated
  } catch {
    return []
  }
}
