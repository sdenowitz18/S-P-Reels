import { Film, InterviewerPersona, InterviewDepth, InterviewTopic, TranscriptEntry, DEPTH_QUESTIONS } from '../types'
import { FilmBrief } from './film-brief'
import { getOpenAI, MODELS } from '../openai'

const PERSONA_NOTES: Record<InterviewerPersona, string> = {
  warm: 'gentle, asks about feeling first',
  blunt: 'direct, asks what worked / didn\'t',
  playful: 'oblique, asks the unexpected angle',
  cinephile: 'technical, asks about craft choices',
}

const TOPIC_PROMPTS: Record<InterviewTopic, string> = {
  'how-it-felt':        'Ask about their emotional response — how the film sat with them, the feeling it left, the mood or atmosphere it created.',
  'what-worked':        'Ask about what landed and what didn\'t. Be direct and analytical. What earned its place, what felt off.',
  'scenes-and-moments': 'Ask about a specific scene or moment from THIS film. Use what you know about the film to name something concrete — a turning point, a key scene, a memorable image. Be specific, not generic.',
  'key-themes':         'Ask about the ideas or themes the film is exploring. What is it really about beneath the surface? What was it trying to say?',
  'the-craft':          'Ask about a filmmaking choice — direction, cinematography, editing, score, structure. Pick something specific to this film, not a generic craft question.',
  'performances':       'Ask about the acting — a specific performance, a character choice, whether anyone stood out or fell flat. Oscar-worthy or not?',
  'surprise-me':        'Ask an unexpected, oblique question that reflects your persona — something they probably haven\'t been asked about this film. Be creative and specific to this film.',
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

function conversationText(transcript: TranscriptEntry[]) {
  return transcript.map(e => `${e.role === 'interviewer' ? 'you' : 'them'}: ${e.text}`).join('\n')
}

function briefContext(brief: FilmBrief | null | undefined): string {
  if (!brief) return ''
  const lines: string[] = ['\n--- film brief (use this to ask specific, grounded questions) ---']
  lines.push(`central question: ${brief.emotional_question}`)
  lines.push(`tone: ${brief.tone}`)
  if (brief.themes?.length) lines.push(`themes: ${brief.themes.map(t => `${t.theme} — ${t.summary}`).join(' | ')}`)
  if (brief.discourse) {
    lines.push(`what audiences loved: ${brief.discourse.loved}`)
    lines.push(`what people wrestled with: ${brief.discourse.wrestled_with}`)
    lines.push(`central debate: ${brief.discourse.debate}`)
  }
  if (brief.scenes?.length) lines.push(`key scenes: ${brief.scenes.map(s => `"${s.name}" (${s.hook})`).join(' | ')}`)
  if (brief.craft?.length) lines.push(`craft: ${brief.craft.join(' | ')}`)
  if (brief.performances?.length) lines.push(`performances: ${brief.performances.map(p => `${p.actor} — ${p.note}`).join(' | ')}`)
  lines.push('--- end brief ---')
  return lines.join('\n')
}

// First question for a chosen topic
export async function generateTopicQuestion(
  film: Film,
  persona: InterviewerPersona,
  topic: InterviewTopic,
  transcript: TranscriptEntry[],
  brief?: FilmBrief | null,
  subTopic?: string | null
): Promise<string> {
  const prior = transcript.length > 0
    ? `\nConversation so far:\n${conversationText(transcript)}\n\nDon't repeat territory already covered above.`
    : ''

  const subTopicLine = subTopic ? `\nThe viewer specifically wants to talk about: "${subTopic}"` : ''

  const res = await getOpenAI().chat.completions.create({
    model: MODELS.fast,
    max_tokens: 80,
    messages: [
      {
        role: 'system',
        content: `You are a ${persona} cinephile in a conversation with a friend who just finished watching a film.

${filmContext(film)}${briefContext(brief)}

Voice: ${VOICE}
Persona: ${PERSONA_NOTES[persona]}

The viewer wants to talk about: ${TOPIC_PROMPTS[topic]}${subTopicLine}

Ask ONE question in this area. Reference the film's specific scenes, characters, or details — not generic questions. If the brief mentions relevant discourse or debate in this area, use it to frame a question with a real position. Max 20 words. Lowercase.${prior}

Output ONLY the question.`,
      },
    ],
  })
  return res.choices[0].message.content?.trim() ?? fallbackQuestion(persona)
}

// Next question in the same topic — don't drill deeper, ask from a fresh angle
export async function generateLateralQuestion(
  film: Film,
  persona: InterviewerPersona,
  topic: InterviewTopic,
  transcript: TranscriptEntry[],
  brief?: FilmBrief | null
): Promise<string> {
  const prior = conversationText(transcript)

  const res = await getOpenAI().chat.completions.create({
    model: MODELS.fast,
    max_tokens: 80,
    messages: [
      {
        role: 'system',
        content: `You are a ${persona} cinephile in a conversation with a friend who just finished watching a film.

${filmContext(film)}${briefContext(brief)}

Voice: ${VOICE}
Persona: ${PERSONA_NOTES[persona]}

Still on the topic of: ${TOPIC_PROMPTS[topic]}

The viewer wants a DIFFERENT question — not going deeper on what's already been said, but a fresh angle within the same territory. Use specific details from the film brief to make it concrete.

Conversation so far:
${prior}

Ask ONE lateral question. Max 20 words. Lowercase.

Output ONLY the question.`,
      },
    ],
  })
  return res.choices[0].message.content?.trim() ?? fallbackQuestion(persona)
}

// Follow-up on an answer — builds on what they just said, or answers their question
export async function generateFollowUp(
  film: Film,
  persona: InterviewerPersona,
  topic: InterviewTopic | undefined,
  transcript: TranscriptEntry[],
  brief?: FilmBrief | null
): Promise<string> {
  const prior = conversationText(transcript)
  const topicContext = topic ? `\nCurrent topic area: ${TOPIC_PROMPTS[topic]}` : ''

  const res = await getOpenAI().chat.completions.create({
    model: MODELS.fast,
    max_tokens: 120,
    messages: [
      {
        role: 'system',
        content: `You are a ${persona} cinephile having a conversation with a friend who just finished watching a film.

${filmContext(film)}${briefContext(brief)}

Voice: ${VOICE}
Persona: ${PERSONA_NOTES[persona]}
${topicContext}

Read the viewer's last message carefully.

— If they are asking for your opinion, perspective, or knowledge about the film (even without a question mark — "tell me what you think", "i wonder what your take is", etc.): answer them directly and specifically first, drawing on the film brief to give a real take. Name actual scenes, characters, or details. Then ask a follow-up question. Max 50 words total.

— If they are just sharing their own thoughts: ask ONE follow-up that builds on what they said. Reference specific film details from the brief. Don't just ask "why" — reframe with something concrete. Max 20 words.

Lowercase. Never dodge a direct question.

Conversation:
${prior}

Output ONLY your response.`,
      },
    ],
  })
  return res.choices[0].message.content?.trim() ?? fallbackQuestion(persona)
}

// Legacy opening question — kept for backwards compat
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

This is the FIRST question — start broad. Ask how they found it overall, whether it landed, how they're feeling about it right now. Max 14 words. Lowercase.

Output ONLY the question. No greeting. No preamble.`,
      },
    ],
  })
  return res.choices[0].message.content?.trim() ?? fallbackQuestion(persona)
}

function fallbackQuestion(persona: InterviewerPersona): string {
  const fallbacks: Record<InterviewerPersona, string> = {
    warm:      'what stayed with you after the credits rolled?',
    blunt:     'what actually worked for you, and what didn\'t?',
    playful:   'if this film were a room, what would be in it?',
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
