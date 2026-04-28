import { Film, InterviewerPersona, InterviewDepth, TranscriptEntry, DEPTH_QUESTIONS } from '../types'
import { getOpenAI, MODELS } from '../openai'

const PERSONA_NOTES: Record<InterviewerPersona, string> = {
  warm: 'gentle, asks about feeling first',
  blunt: 'direct, asks what worked / didn\'t',
  playful: 'oblique, asks the unexpected angle',
  cinephile: 'technical, asks about craft choices',
}

const VOICE = `lowercase as default. sentence-case sentences feel too formal. capitalize proper nouns. plain language — no "fascinating", "intriguing", "wonderful", no "i'd love to hear…". concrete over abstract. curious, not therapeutic. never break character.`

function filmContext(film: Film) {
  const cast = (film.cast_json ?? []).slice(0, 5).map(c => c.name).join(', ')
  const keywords = (film.keywords ?? []).slice(0, 10).join(', ')
  return `Film: "${film.title}" (${film.year ?? 'unknown year'}, dir. ${film.director ?? 'unknown'}).
Synopsis: ${film.synopsis ?? 'no synopsis available'}
Notable cast: ${cast || 'unknown'}
Themes/keywords: ${keywords || 'unknown'}`
}

export async function generateOpeningQuestion(
  film: Film,
  persona: InterviewerPersona
): Promise<string> {
  const res = await getOpenAI().chat.completions.create({
    model: MODELS.fast,
    max_tokens: 80,
    messages: [
      {
        role: 'system',
        content: `You are a ${persona} cinephile opening a short conversation with a friend who just finished watching a film. Your job is to ask ONE warm, open first question that invites their overall reaction — not a deep dive yet.

${filmContext(film)}

Voice: ${VOICE}
Persona: ${PERSONA_NOTES[persona]}

This is the FIRST question — start broad. Ask how they found it overall, whether it landed, how they're feeling about it right now. Something like "how did you find it?" or "did it land for you?" — but in your persona's voice. Max 14 words. Lowercase. NOT specific about a scene or character yet — save that for follow-ups.

Output ONLY the question. No greeting. No preamble.`,
      },
    ],
  })
  return res.choices[0].message.content?.trim() ?? fallbackQuestion(persona)
}

export async function generateFollowUp(
  film: Film,
  persona: InterviewerPersona,
  depth: InterviewDepth,
  transcript: TranscriptEntry[],
  questionNumber: number
): Promise<string> {
  const total = DEPTH_QUESTIONS[depth]
  const conversationText = transcript
    .map(e => `${e.role === 'interviewer' ? 'you' : 'them'}: ${e.text}`)
    .join('\n')

  const res = await getOpenAI().chat.completions.create({
    model: MODELS.fast,
    max_tokens: 80,
    messages: [
      {
        role: 'system',
        content: `You are a ${persona} cinephile having a short conversation with a friend who just finished watching a film.

${filmContext(film)}

Voice: ${VOICE}
Persona: ${PERSONA_NOTES[persona]}

You're on question ${questionNumber} of ${total}. Below is what's been said. Ask ONE follow-up that builds on what they just told you. If they brushed past something interesting, dig in. If they were thorough, pivot.

Conversation:
${conversationText}

Output ONLY the next question.`,
      },
    ],
  })
  return res.choices[0].message.content?.trim() ?? fallbackQuestion(persona)
}

function fallbackQuestion(persona: InterviewerPersona): string {
  const fallbacks: Record<InterviewerPersona, string> = {
    warm: 'what stayed with you after the credits rolled?',
    blunt: 'what actually worked for you, and what didn\'t?',
    playful: 'if this film were a room, what would be in it?',
    cinephile: 'what formal choice do you think defined the whole thing?',
  }
  return fallbacks[persona]
}

export async function generateRatingSuggestion(
  film: Film,
  transcript: TranscriptEntry[]
): Promise<{ stars: number; reasoning: string } | null> {
  if (!transcript.length) return null
  const conversationText = transcript
    .map(e => `${e.role === 'interviewer' ? 'interviewer' : 'viewer'}: ${e.text}`)
    .join('\n')

  try {
    const res = await getOpenAI().chat.completions.create({
      model: MODELS.fast,
      max_tokens: 120,
      messages: [
        {
          role: 'system',
          content: `You are a perceptive film critic reading a conversation between an interviewer and someone who just watched a film. Based ONLY on what the viewer said — their enthusiasm, complaints, nuance — estimate what star rating (out of 5, half-stars allowed) they'd give it.

${filmContext(film)}

Conversation:
${conversationText}

Respond with ONLY valid JSON: {"stars": 3.5, "reasoning": "one short sentence explaining your read"}
No markdown. No extra keys.`,
        },
      ],
    })
    const raw = res.choices[0].message.content?.trim() ?? ''
    const parsed = JSON.parse(raw)
    if (typeof parsed.stars !== 'number' || typeof parsed.reasoning !== 'string') return null
    parsed.stars = Math.round(parsed.stars * 2) / 2 // clamp to half-star increments
    parsed.stars = Math.max(0.5, Math.min(5, parsed.stars))
    return parsed
  } catch {
    return null
  }
}

export async function generateSentimentTags(
  film: Film,
  transcript: TranscriptEntry[],
  keywords: string[]
): Promise<{ liked: string[]; disliked: string[] }> {
  const conversationText = transcript
    .map(e => `${e.role === 'interviewer' ? 'interviewer' : 'viewer'}: ${e.text}`)
    .join('\n')

  const keywordList = keywords.slice(0, 20).join(', ')

  try {
    const res = await getOpenAI().chat.completions.create({
      model: MODELS.fast,
      max_tokens: 200,
      messages: [
        {
          role: 'system',
          content: `You are reading a conversation about a film. Based on what the viewer said, classify these film keywords/themes into what they seemed to respond positively to vs negatively to. Only include a keyword if there's clear signal from the conversation — don't guess. Max 5 per list.

${filmContext(film)}

Keywords to classify: ${keywordList}

Conversation:
${conversationText}

Respond with ONLY valid JSON: {"liked": ["tag1", "tag2"], "disliked": ["tag3"]}
Use the exact keyword strings from the input list. No markdown. No extra keys.`,
        },
      ],
    })
    const raw = res.choices[0].message.content?.trim() ?? ''
    const parsed = JSON.parse(raw)
    return {
      liked: Array.isArray(parsed.liked) ? parsed.liked.slice(0, 5) : [],
      disliked: Array.isArray(parsed.disliked) ? parsed.disliked.slice(0, 5) : [],
    }
  } catch {
    return { liked: [], disliked: [] }
  }
}
