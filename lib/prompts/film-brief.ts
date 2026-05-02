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

// ── Legacy dimensions — deprecated, no longer generated ──────────────────────
// Kept as a type only so existing DB records (ai_brief.dimensions) can still
// be read by older consumers. Do not generate these in new enrichments.
// TODO: migrate all consumers (taste-profile.ts, recommendations routes,
//       find-together, profile MiniDimBar) to use dimensions_v2 instead.
export interface FilmBriefDimensions {
  pace: number           // -1 kinetic ↔ 1 slow-burn
  story_engine: number   // -1 plot-driven ↔ 1 character-driven
  tone: number           // -1 comedic/light ↔ 1 serious/bleak
  warmth: number         // -1 cold/detached ↔ 1 warm/sentimental
  complexity: number     // -1 accessible ↔ 1 challenging/layered
  style: number          // -1 restrained/minimal ↔ 1 expressive/maximalist
}

// ── V2 dimensions — 0-100 scale, 12 cinematic attributes ─────────────────────
// 0-35 = strong left pole, 36-64 = genuine middle, 65-100 = strong right pole
export interface FilmDimensionsV2 {
  narrative_legibility:   number  // 0 = legible/clear ↔ 100 = opaque/withheld
  emotional_directness:   number  // 0 = direct/guided ↔ 100 = restrained/withheld
  plot_vs_character:      number  // 0 = plot-driven ↔ 100 = character-driven
  naturalistic_vs_stylized: number // 0 = naturalistic ↔ 100 = stylized
  narrative_closure:      number  // 0 = resolves/closes ↔ 100 = deliberately ambiguous
  intimate_vs_epic:       number  // 0 = intimate/interior ↔ 100 = epic/systemic
  accessible_vs_demanding: number // 0 = fully accessible ↔ 100 = highly demanding
  psychological_safety:   number  // 0 = reassuring/safe ↔ 100 = disturbing/provocative
  moral_clarity:          number  // 0 = clear good/evil ↔ 100 = morally ambiguous
  behavioral_realism:     number  // 0 = psychologically realistic ↔ 100 = archetypal/symbolic
  sensory_vs_intellectual: number // 0 = sensory/visceral ↔ 100 = intellectual/conceptual
  kinetic_vs_patient:     number  // 0 = kinetic/fast ↔ 100 = patient/slow-burn
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
  dimensions?: FilmBriefDimensions   // legacy — may exist in old DB records, no longer generated
  dimensions_v2?: FilmDimensionsV2   // populated by scoreFilmDimensionsV2()
}

export async function scoreFilmDimensionsV2(film: Film): Promise<FilmDimensionsV2 | null> {
  const cast = (film.cast_json ?? []).slice(0, 5).map(c => c.name).join(', ')

  try {
    const res = await getOpenAI().chat.completions.create({
      model: MODELS.smart,
      max_tokens: 400,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `You are a film scoring system. Score the given film on 12 cinematic dimensions. Each dimension is a bipolar spectrum scored 0–100.

Scale:
- 0–15 = strong left pole
- 16–35 = moderate left pole
- 36–64 = genuinely middle (holds both, or neither strongly)
- 65–84 = moderate right pole
- 85–100 = strong right pole

Do NOT default to the middle. Only use 36–64 when a film genuinely holds both poles in tension.
Score based on the film's dominant viewer experience, not edge cases.

CALIBRATION ANCHORS (use these as reference points):

1. narrative_legibility (0=legible/clear ↔ 100=opaque/withheld)
   Legible: Jurassic Park=5, The Dark Knight=8, Parasite=22
   Middle: Eternal Sunshine=45, Hereditary=42
   Opaque: The Tree of Life=75, Last Year at Marienbad=95, Inland Empire=98

2. emotional_directness (0=direct/guided ↔ 100=restrained/withheld)
   NOTE: measures emotional SIGNALING, not intensity. Whiplash is intense but restrained.
   Direct: The Pursuit of Happyness=3, Forrest Gump=5, Titanic=8, Schindler's List=18
   Middle: Whiplash=38, The Godfather=42
   Restrained: Wendy and Lucy=85, Aftersun=85, Jeanne Dielman=98

3. plot_vs_character (0=plot-driven ↔ 100=character-driven)
   Plot: Die Hard=3, Mad Max: Fury Road=5, Mission Impossible=8
   Middle: No Country for Old Men=45, Hereditary=42
   Character: Boyhood=88, Marriage Story=92, Jeanne Dielman=98

4. naturalistic_vs_stylized (0=naturalistic ↔ 100=stylized)
   Naturalistic: Bicycle Thieves=3, Wendy and Lucy=8, The Florida Project=5
   Middle: Moonlight=40, Her=50, Hereditary=55
   Stylized: The Grand Budapest Hotel=92, Beau Is Afraid=95

5. narrative_closure (0=resolves/closes ↔ 100=deliberately ambiguous)
   Closure: Rocky=3, The Shawshank Redemption=5, most Marvel films=5–10
   Middle: Portrait of a Lady on Fire=58, The Godfather Part II=45
   Ambiguous: No Country for Old Men=90, Caché=95, Blow-Up=92

6. intimate_vs_epic (0=intimate/interior ↔ 100=epic/systemic)
   Intimate: Aftersun=3, Portrait of a Lady on Fire=8, 45 Years=8
   Middle: Parasite=50, No Country for Old Men=48
   Epic: Oppenheimer=85, 2001: A Space Odyssey=90, Lawrence of Arabia=95

7. accessible_vs_demanding (0=fully accessible ↔ 100=highly demanding)
   NOTE: measures viewer demand, NOT popularity or prestige.
   Accessible: The Avengers=3, Jurassic Park=5, Top Gun: Maverick=5
   Middle: Parasite=40, Fargo=38, No Country for Old Men=55
   Demanding: 2001: A Space Odyssey=78, Jeanne Dielman=95, Wavelength=99

8. psychological_safety (0=reassuring/safe ↔ 100=disturbing/provocative)
   Safe: most Marvel films=5, most mainstream biopics=10–20
   Middle: Hereditary=58, Boyhood=28
   Provocative: Caché=85, The Act of Killing=90, Dogtooth=95, Funny Games=98

9. moral_clarity (0=clear good/evil ↔ 100=morally ambiguous)
   Clear: Star Wars=2, Rocky=3, Schindler's List=10
   Middle: The Godfather=50, Whiplash=62
   Ambiguous: Chinatown=85, No Country for Old Men=90, The Act of Killing=95

10. behavioral_realism (0=psychologically realistic ↔ 100=archetypal/symbolic)
    Realistic: Secrets & Lies=3, Marriage Story=5, A Woman Under the Influence=8
    Middle: The Godfather=45, No Country for Old Men=48
    Archetypal: The Dark Knight=75, Star Wars=95

11. sensory_vs_intellectual (0=sensory/visceral ↔ 100=intellectual/conceptual)
    NOTE: 2001 holds BOTH by design (not true middle). Eternal Sunshine is genuinely middle.
    Sensory: Enter the Void=5, Dunkirk=8, Apocalypse Now=10
    Middle: 2001: A Space Odyssey=38 (holds both), Eternal Sunshine=45 (neither)
    Intellectual: My Dinner with Andre=90, essay films generally=80–95

12. kinetic_vs_patient (0=kinetic/fast-paced ↔ 100=patient/slow-burn)
    Kinetic: Mad Max: Fury Road=2, Speed=5, Die Hard=8, The Dark Knight=15
    Middle: The Godfather=45, Parasite=42, No Country for Old Men=50
    Patient: Jeanne Dielman=97, Tarkovsky films=85–95, Aftersun=80, Kelly Reichardt films=78

Film to score: "${film.title}" (${film.year ?? 'unknown year'}, dir. ${film.director ?? 'unknown'})
Synopsis: ${film.synopsis ?? 'no synopsis available'}
Notable cast: ${cast || 'unknown'}

Output ONLY valid JSON with exactly these 12 keys and integer values 0–100:
{
  "narrative_legibility": 0,
  "emotional_directness": 0,
  "plot_vs_character": 0,
  "naturalistic_vs_stylized": 0,
  "narrative_closure": 0,
  "intimate_vs_epic": 0,
  "accessible_vs_demanding": 0,
  "psychological_safety": 0,
  "moral_clarity": 0,
  "behavioral_realism": 0,
  "sensory_vs_intellectual": 0,
  "kinetic_vs_patient": 0
}`,
        },
      ],
    })

    const raw = (res.choices[0].message.content?.trim() ?? '')
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/, '')
      .trim()
    const parsed = JSON.parse(raw) as FilmDimensionsV2

    // clamp all values to [0, 100]
    const keys = Object.keys(parsed) as (keyof FilmDimensionsV2)[]
    for (const k of keys) {
      parsed[k] = Math.max(0, Math.min(100, Math.round(parsed[k])))
    }

    return parsed
  } catch (err) {
    console.error('scoreFilmDimensionsV2 error:', err)
    return null
  }
}

export async function generateFilmBrief(film: Film): Promise<FilmBrief | null> {
  const cast = (film.cast_json ?? []).slice(0, 8).map(c => c.name).join(', ')
  const keywords = (film.keywords ?? []).slice(0, 15).join(', ')
  const tmdbGenres = (film.tmdb_genres ?? []).join(', ')

  // Fetch enrichment sources + v2 dimension scores in parallel — failures are non-fatal
  const [wikipedia, reddit, dimensionsV2Result] = await Promise.allSettled([
    fetchWikipediaReception(film.title, film.year),
    fetchRedditDiscourse(film.title, film.year),
    scoreFilmDimensionsV2(film),
  ])

  const wikipediaText = wikipedia.status === 'fulfilled' ? wikipedia.value : null
  const redditText = reddit.status === 'fulfilled' ? reddit.value : null
  const dimensionsV2 = dimensionsV2Result.status === 'fulfilled' ? dimensionsV2Result.value : null

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
  }
}

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

    // attach v2 dimension scores if available
    if (dimensionsV2) {
      parsed.dimensions_v2 = dimensionsV2
    }

    return parsed
  } catch (err) {
    console.error('generateFilmBrief error:', err)
    return null
  }
}
