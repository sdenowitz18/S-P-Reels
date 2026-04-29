import { Film } from '../types'
import { getOpenAI, MODELS } from '../openai'
import { fetchWikipediaReception } from '../enrichment/wikipedia'
import { fetchRedditDiscourse } from '../enrichment/reddit'

export interface FilmBriefScene {
  name: string
  hook: string
}

export interface FilmBriefPerformance {
  actor: string
  note: string
}

export interface FilmBriefTheme {
  theme: string
  summary: string
}

export interface FilmBriefDiscourse {
  loved: string
  wrestled_with: string
  debate: string
}

export interface FilmBriefDimensions {
  pace: number           // -1 kinetic ↔ 1 slow-burn
  story_engine: number   // -1 plot-driven ↔ 1 character-driven
  tone: number           // -1 comedic/light ↔ 1 serious/bleak
  warmth: number         // -1 cold/detached ↔ 1 warm/sentimental
  complexity: number     // -1 accessible ↔ 1 challenging/layered
  style: number          // -1 restrained/minimal ↔ 1 expressive/maximalist
}

export interface FilmBrief {
  emotional_question: string
  tone: string
  genres: string[]
  themes: FilmBriefTheme[]
  discourse: FilmBriefDiscourse
  scenes: FilmBriefScene[]
  craft: string[]
  performances: FilmBriefPerformance[]
  viewer_fit: { connects: string; bounces: string }
  dimensions: FilmBriefDimensions
}

export async function generateFilmBrief(film: Film): Promise<FilmBrief | null> {
  const cast = (film.cast_json ?? []).slice(0, 8).map(c => c.name).join(', ')
  const keywords = (film.keywords ?? []).slice(0, 15).join(', ')
  const tmdbGenres = (film.tmdb_genres ?? []).join(', ')

  // Fetch enrichment sources in parallel — failures are non-fatal
  const [wikipedia, reddit] = await Promise.allSettled([
    fetchWikipediaReception(film.title, film.year),
    fetchRedditDiscourse(film.title, film.year),
  ])

  const wikipediaText = wikipedia.status === 'fulfilled' ? wikipedia.value : null
  const redditText = reddit.status === 'fulfilled' ? reddit.value : null

  const enrichmentBlock = [
    wikipediaText ? `\n--- wikipedia critical reception ---\n${wikipediaText}\n--- end wikipedia ---` : '',
    redditText ? `\n--- reddit viewer discourse ---\n${redditText}\n--- end reddit ---` : '',
  ].filter(Boolean).join('\n')

  try {
    const res = await getOpenAI().chat.completions.create({
      model: MODELS.smart,
      max_tokens: 1200,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `You are a film critic and cultural analyst building a reference brief for a film discussion app. Your output will be used to generate specific, intelligent interview questions and to map this film to viewer taste profiles.

Film: "${film.title}" (${film.year ?? 'unknown year'}, dir. ${film.director ?? 'unknown'})
Synopsis: ${film.synopsis ?? 'no synopsis available'}
Notable cast: ${cast || 'unknown'}
TMDB broad genres (context only): ${tmdbGenres || 'none'}
TMDB keywords (context only, do not copy into output): ${keywords || 'none'}${enrichmentBlock}

Generate a structured brief. If wikipedia or reddit data is provided above, use it as primary source material — prioritize real critical reception and actual viewer discourse over your training knowledge. If no enrichment data is provided, rely on your training knowledge.

Output ONLY valid JSON — no markdown, no extra text:

{
  "emotional_question": "the central human tension this film explores — not the plot, but the underlying question about life/relationships/society it is asking. one sentence.",
  "tone": "the tonal register in 3-6 words (e.g. 'melancholic but hopeful', 'darkly comedic throughout', 'bleak and unrelenting')",
  "genres": ["nuanced subgenre label", "second label if needed"],
  "themes": [
    { "theme": "theme name 2-3 words", "summary": "how this theme manifests specifically in this film. 1-2 sentences." }
  ],
  "discourse": {
    "loved": "what audiences and critics most responded to positively. 1-2 sentences.",
    "wrestled_with": "what audiences found challenging, divisive, or hard to sit with. 1-2 sentences.",
    "debate": "the one ongoing debate or question people argue about when discussing this film. 1 sentence."
  },
  "scenes": [
    { "name": "specific scene name or description", "hook": "why this scene is the most discussable — what it reveals, subverts, or makes the viewer feel. 1 sentence." }
  ],
  "craft": [
    "specific filmmaking choice that defines this film — name the technique and what it does, not generic praise"
  ],
  "performances": [
    { "actor": "actor name", "note": "what is specifically notable about this performance and why it matters to the film" }
  ],
  "viewer_fit": {
    "connects": "what kind of viewer tends to connect strongly — be specific about sensibility, not demographics",
    "bounces": "what kind of viewer tends to bounce off it — be specific about what they find frustrating"
  },
  "dimensions": {
    "pace": 0.0,
    "story_engine": 0.0,
    "tone": 0.0,
    "warmth": 0.0,
    "complexity": 0.0,
    "style": 0.0
  }
}

Dimension scoring (-1.0 to 1.0):
- pace: -1 = extremely kinetic/fast-paced, +1 = extremely slow-burn/patient
- story_engine: -1 = pure plot-driven, +1 = pure character-driven
- tone: -1 = purely comedic/light, +1 = purely serious/bleak
- warmth: -1 = cold/detached/clinical, +1 = warm/sentimental/emotional
- complexity: -1 = fully accessible/crowd-pleasing, +1 = highly challenging/layered/demanding
- style: -1 = extremely restrained/minimalist, +1 = extremely expressive/maximalist/stylized

Rules:
- Be specific to THIS film — no observations that could apply to any film in the genre
- genres: 1-3 nuanced subgenre labels. NOT broad TMDB categories like "Drama" or "Comedy" in isolation. Instead, use compound or qualified labels that capture the actual experience: "psychological horror", "slow-burn sci-fi", "dark comedy", "domestic noir", "coming-of-age drama", "heist thriller", "romantic comedy", "arthouse horror", "political satire", "neo-noir crime", "body horror", "survival thriller", etc. These will be aggregated across a user's film library to show their taste profile — make them specific enough to be meaningful.
- themes: 2-4 entries
- scenes: 3-5 most discussable moments, named specifically (not "a key scene")
- craft: 2-4 entries, each naming a specific technique and its effect
- performances: only genuinely notable ones, 1-4 max
- If you have limited knowledge of this film, be conservative and rely on the synopsis
- All text lowercase except proper nouns`,
        },
      ],
    })

    const raw = (res.choices[0].message.content?.trim() ?? '')
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/, '')
      .trim()
    const parsed = JSON.parse(raw) as FilmBrief

    // clamp all dimension values to [-1, 1]
    if (parsed.dimensions) {
      for (const k of Object.keys(parsed.dimensions) as (keyof FilmBriefDimensions)[]) {
        parsed.dimensions[k] = Math.max(-1, Math.min(1, parsed.dimensions[k]))
      }
    }

    return parsed
  } catch (err) {
    console.error('generateFilmBrief error:', err)
    return null
  }
}
