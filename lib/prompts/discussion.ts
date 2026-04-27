import { getOpenAI, MODELS } from '../openai'
import { Film } from '../types'

interface MemberReflection {
  name: string
  my_line: string | null
  my_stars: number | null
  moods: string[] | null
}

export async function generateDiscussionPrompts(
  film: Film,
  memberA: MemberReflection,
  memberB: MemberReflection
): Promise<string[]> {
  try {
    const res = await getOpenAI().chat.completions.create({
      model: MODELS.quality,
      max_tokens: 200,
      response_format: { type: 'json_object' },
      messages: [{
        role: 'user',
        content: `${memberA.name} and ${memberB.name} both watched "${film.title}" (${film.year ?? 'unknown year'}, dir. ${film.director ?? 'unknown'}).

${memberA.name}'s reflection: ${memberA.my_line ?? 'no note'}, rated ${memberA.my_stars ?? '?'}/5, moods: ${memberA.moods?.join(', ') ?? 'unspecified'}
${memberB.name}'s reflection: ${memberB.my_line ?? 'no note'}, rated ${memberB.my_stars ?? '?'}/5, moods: ${memberB.moods?.join(', ') ?? 'unspecified'}

Generate 3 discussion prompts that would help them actually talk about the film together — not generic ("what did you think?") but specific to where their reflections diverge or converge. Each prompt: one sentence, lowercase, max 18 words.

Return JSON: {"prompts": ["prompt one", "prompt two", "prompt three"]}

ONLY JSON.`,
      }],
    })
    const parsed = JSON.parse(res.choices[0].message.content ?? '{}')
    return parsed.prompts ?? FALLBACK_PROMPTS
  } catch {
    return FALLBACK_PROMPTS
  }
}

const FALLBACK_PROMPTS = [
  'what hit you hardest?',
  'what would you change?',
  'would you watch it again?',
]
