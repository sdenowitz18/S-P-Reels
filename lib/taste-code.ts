/**
 * Taste Code — computes a user's 4-letter cinematic identity code.
 *
 * Each letter represents the dominant pole of one cinematic dimension,
 * derived from how the user rates the most extreme films in their library.
 *
 * Algorithm (Approach C):
 *   1. For each of 12 dimensions, sort rated films by that dimension's v2 score.
 *   2. Take top 20% as left-pole films, top 20% as right-pole films.
 *   3. Compute avg star rating on each group.
 *   4. Normalize all 24 pole scores to 0–100 using the library's actual min/max avg.
 *   5. Rank dimensions by gap between their two pole scores.
 *   6. Pick top 4 dimensions — for each, the higher-scoring pole wins its letter.
 */

import { FilmDimensionsV2 } from './prompts/film-brief'

// ── Pole definitions ─────────────────────────────────────────────────────────

export interface PoleDefinition {
  dimKey:              keyof FilmDimensionsV2
  letter:              string
  label:               string
  pole:                'left' | 'right'   // left = low score (0), right = high score (100)
  description:         string             // affirmative — used when this is a strong signal
  negativeDescription: string             // skeptical — used in dislikes view or weak signal context
  dimDescription:      string             // what this spectrum actually measures — shown in interview UI
}

export const ALL_POLES: PoleDefinition[] = [
  // 1. Narrative Legibility
  {
    dimKey: 'narrative_legibility', letter: 'L', label: 'Legible', pole: 'left',
    dimDescription: "how clearly a film communicates what's happening and why — from transparent storytelling to deliberately withheld meaning",
    description: "You like films that are clear about what's happening and why — oriented, not withholding.",
    negativeDescription: "The most narratively transparent films don't particularly excite you — clarity alone isn't what draws you in.",
  },
  {
    dimKey: 'narrative_legibility', letter: 'O', label: 'Opaque', pole: 'right',
    dimDescription: "how clearly a film communicates what's happening and why — from transparent storytelling to deliberately withheld meaning",
    description: "You're drawn to films that deliberately withhold meaning and ask you to construct it yourself.",
    negativeDescription: "Films that perform mystery without paying it off tend to frustrate you more than they intrigue — you want withholding to be earned.",
  },
  // 2. Emotional Directness
  {
    dimKey: 'emotional_directness', letter: 'V', label: 'Vivid', pole: 'left',
    dimDescription: "how a film signals its emotional stakes — from guiding you directly to feeling, to leaving you to arrive there alone (note: this is about signaling, not intensity)",
    description: "You respond to films that make their emotional stakes clear — the feeling is right on the surface.",
    negativeDescription: "Emotionally direct films that put feeling right on the surface can feel overwrought — you need the emotion to be earned, not announced.",
  },
  {
    dimKey: 'emotional_directness', letter: 'S', label: 'Subtle', pole: 'right',
    dimDescription: "how a film signals its emotional stakes — from guiding you directly to feeling, to leaving you to arrive there alone (note: this is about signaling, not intensity)",
    description: "You prefer films that trust you to arrive at feeling on your own — internalized, not telegraphed.",
    negativeDescription: "Films that bury their emotion can leave you unmoved — you need something to hold onto, not just space to project into.",
  },
  // 3. Plot vs Character
  {
    dimKey: 'plot_vs_character', letter: 'P', label: 'Plot', pole: 'left',
    dimDescription: "what drives the film forward — following a chain of events vs. inhabiting a person's interior life",
    description: "You're engaged by narrative momentum — what happens next is the central question.",
    negativeDescription: "Pure plot-drive without depth tends to feel hollow — when the story ends, there's not much left to sit with.",
  },
  {
    dimKey: 'plot_vs_character', letter: 'C', label: 'Character', pole: 'right',
    dimDescription: "what drives the film forward — following a chain of events vs. inhabiting a person's interior life",
    description: "You want to deeply understand one person — their psychology, their contradictions, their interior life.",
    negativeDescription: "Deep character studies without narrative momentum can lose you — you want stakes alongside interiority.",
  },
  // 4. Naturalistic vs Theatrical
  {
    dimKey: 'naturalistic_vs_stylized', letter: 'N', label: 'Naturalistic', pole: 'left',
    dimDescription: "how a film presents itself visually and tonally — concealing its own construction vs. announcing it",
    description: "You prefer films that present themselves as observed reality — artifice hidden, world believable.",
    negativeDescription: "Cinema that hides its own craft can feel inert — you want a film to have a distinct sensibility, not just observe.",
  },
  {
    dimKey: 'naturalistic_vs_stylized', letter: 'T', label: 'Theatrical', pole: 'right',
    dimDescription: "how a film presents itself visually and tonally — concealing its own construction vs. announcing it",
    description: "You respond to films that announce their own construction — heightened, self-conscious, made.",
    negativeDescription: "Heightened stylization can tip into self-consciousness for you — you want the world to feel lived-in, not constructed.",
  },
  // 5. Narrative Closure
  {
    dimKey: 'narrative_closure', letter: 'W', label: 'Whole', pole: 'left',
    dimDescription: "whether a film resolves its questions — from tying things up to deliberately leaving them open",
    description: "You want a film to complete itself — questions answered, arcs finished, something resolved.",
    negativeDescription: "Films that tie everything up neatly can ring false — life doesn't resolve this cleanly, and you notice when stories pretend it does.",
  },
  {
    dimKey: 'narrative_closure', letter: 'Q', label: 'Questioning', pole: 'right',
    dimDescription: "whether a film resolves its questions — from tying things up to deliberately leaving them open",
    description: "You're drawn to films that open rather than close — meaning withheld, endings that linger.",
    negativeDescription: "Open endings that refuse resolution tend to leave you unsatisfied — you want a film to do the work, not hand the ambiguity back to you.",
  },
  // 6. Intimate vs Epic
  {
    dimKey: 'intimate_vs_epic', letter: 'I', label: 'Intimate', pole: 'left',
    dimDescription: "the scale of the film's world — one person's interior life up close vs. forces larger than any individual",
    description: "You want to inhabit one or two lives closely — small emotional universe, up close.",
    negativeDescription: "Small-scale character pieces, however well-crafted, don't pull you as strongly — you want cinema to stretch beyond the personal.",
  },
  {
    dimKey: 'intimate_vs_epic', letter: 'E', label: 'Epic', pole: 'right',
    dimDescription: "the scale of the film's world — one person's interior life up close vs. forces larger than any individual",
    description: "You're drawn to films that encompass history, systems, or forces larger than any one person.",
    negativeDescription: "Grand-scale filmmaking can feel impersonal — the sweep and spectacle tends to leave you colder than human-scale stakes.",
  },
  // 7. Accessible vs Demanding
  {
    dimKey: 'accessible_vs_demanding', letter: 'F', label: 'Familiar', pole: 'left',
    dimDescription: "how much the film asks of you as a viewer — meets you where you are vs. requires real effort, patience, or prior knowledge",
    description: "You prefer films that meet you where you are — no prior knowledge or patience required.",
    negativeDescription: "Accessible, crowd-pleasing filmmaking tends not to leave a lasting mark — you want cinema to ask something of you.",
  },
  {
    dimKey: 'accessible_vs_demanding', letter: 'D', label: 'Demanding', pole: 'right',
    dimDescription: "how much the film asks of you as a viewer — meets you where you are vs. requires real effort, patience, or prior knowledge",
    description: "You seek out films that require something from you — effort, patience, tolerance for the unconventional.",
    negativeDescription: "Films that push difficulty as a virtue can feel unrewarding — you want the challenge to be worth the effort, and it often isn't.",
  },
  // 8. Psychological Safety
  {
    dimKey: 'psychological_safety', letter: 'H', label: 'Hopeful', pole: 'left',
    dimDescription: "how the film leaves you feeling — from ultimately reassuring and intact to genuinely disturbed or destabilized",
    description: "You gravitate toward films that ultimately reassure — the world makes sense, you leave intact.",
    negativeDescription: "Films that lean toward reassurance can ring false — the world is harder than that, and clean resolutions can feel dishonest.",
  },
  {
    dimKey: 'psychological_safety', letter: 'U', label: 'Unsettling', pole: 'right',
    dimDescription: "how the film leaves you feeling — from ultimately reassuring and intact to genuinely disturbed or destabilized",
    description: "You're drawn to films that disturb or destabilize — the discomfort is intentional and unresolved.",
    negativeDescription: "Deliberate discomfort without clear payoff tends to wear on you — darkness for its own sake isn't enough.",
  },
  // 9. Moral Clarity
  {
    dimKey: 'moral_clarity', letter: 'J', label: 'Just', pole: 'left',
    dimDescription: "whether the film has a legible moral landscape — from clear good and evil to genuine ethical ambiguity with no verdict",
    description: "You prefer films with a legible moral landscape — right and wrong are ultimately knowable.",
    negativeDescription: "Clear moral resolution can feel too convenient — real ethical weight is messier than this, and the tidiness can ring hollow.",
  },
  {
    dimKey: 'moral_clarity', letter: 'A', label: 'Ambiguous', pole: 'right',
    dimDescription: "whether the film has a legible moral landscape — from clear good and evil to genuine ethical ambiguity with no verdict",
    description: "You're drawn to films that refuse to adjudicate — genuine moral contest with no clear verdict.",
    negativeDescription: "Moral murkiness without direction can feel evasive — you want cinema to take a position, even a difficult one.",
  },
  // 10. Behavioral Realism
  {
    dimKey: 'behavioral_realism', letter: 'R', label: 'Realistic', pole: 'left',
    dimDescription: "how characters are rendered — behaving in psychologically human, contradictory ways vs. as archetypes, symbols, or mythic constructs",
    description: "You respond to characters who behave in psychologically recognizable, contradictory, human ways.",
    negativeDescription: "Psychological naturalism can shade into the mundane — you want characters to carry more presence than observed life usually allows.",
  },
  {
    dimKey: 'behavioral_realism', letter: 'X', label: 'Archetypal', pole: 'right',
    dimDescription: "how characters are rendered — behaving in psychologically human, contradictory ways vs. as archetypes, symbols, or mythic constructs",
    description: "You respond to characters who operate as types, symbols, or mythic constructs — larger than life.",
    negativeDescription: "Symbolic or mythic character types can feel thin — you want to believe in a person, not a construct.",
  },
  // 11. Sensory vs Intellectual
  {
    dimKey: 'sensory_vs_intellectual', letter: 'G', label: 'Gut', pole: 'left',
    dimDescription: "how the film primarily works on you — through visceral sensation, image, and atmosphere vs. through ideas, reasoning, and conceptual argument",
    description: "You're moved by films that work on you through sensation — image, sound, atmosphere, visceral experience.",
    negativeDescription: "Pure sensory experience without intellectual scaffolding can feel empty — image and atmosphere alone don't hold you.",
  },
  {
    dimKey: 'sensory_vs_intellectual', letter: 'M', label: 'Mind', pole: 'right',
    dimDescription: "how the film primarily works on you — through visceral sensation, image, and atmosphere vs. through ideas, reasoning, and conceptual argument",
    description: "You're engaged by films that work as puzzles or arguments — meaning built through reasoning and idea.",
    negativeDescription: "Films that work primarily as puzzles or arguments can feel cold — you need to feel something, not just think.",
  },
  // 12. Kinetic vs Patient
  {
    dimKey: 'kinetic_vs_patient', letter: 'K', label: 'Kinetic', pole: 'left',
    dimDescription: "the film's relationship to time and pacing — rapid momentum and dense events vs. stillness, long takes, and dwelling in duration",
    description: "You want momentum — rapid editing, dense event, a film that carries you forward.",
    negativeDescription: "Rapid-cut, event-dense filmmaking can feel relentless — you want cinema to breathe, not just carry you forward.",
  },
  {
    dimKey: 'kinetic_vs_patient', letter: 'Z', label: 'Zen', pole: 'right',
    dimDescription: "the film's relationship to time and pacing — rapid momentum and dense events vs. stillness, long takes, and dwelling in duration",
    description: "You have patience for films that breathe — stillness, duration, inhabiting time rather than rushing through it.",
    negativeDescription: "Patient, unhurried filmmaking can test your engagement — you want cinema to move, not meditate.",
  },
]

// Quick lookup by letter
export const POLE_BY_LETTER = Object.fromEntries(ALL_POLES.map(p => [p.letter, p]))

// ── Types ────────────────────────────────────────────────────────────────────

export interface TasteCodeEntry {
  letter:                 string
  label:                  string
  description:            string   // affirmative tone
  negativeDescription:    string   // skeptical tone — for dislikes / weak signals
  dimKey:                 keyof FilmDimensionsV2
  pole:                   'left' | 'right'
  poleScore:              number   // 0–100 normalized
  oppositeScore:          number   // 0–100 normalized score for the other pole
  gap:                    number   // difference between dominant and opposite pole
  filmCount:              number   // films in the extreme quartile (dominant pole)
  sampleFilms:            TasteCodeFilm[]
  // Opposite pole — for dual-pole display
  oppLetter:              string
  oppLabel:               string
  oppFilmCount:           number
  oppSampleFilms:         TasteCodeFilm[]
  oppNegativeDescription: string   // what doesn't land about the opposite pole
}

export interface TasteCodeFilm {
  film_id:     string
  title:       string
  poster_path: string | null
  stars:       number
  dimScore:    number  // raw 0–100 dimension score
}

export interface TasteCode {
  letters:    string           // e.g. "ICQR"
  entries:    TasteCodeEntry[] // top 4, ordered by gap descending
  allEntries: TasteCodeEntry[] // all 12 dimensions, ordered by gap descending
}

// ── Constants ────────────────────────────────────────────────────────────────

const EXTREME_PCT = 0.20  // top/bottom 20% of library per pole
const MIN_FILMS   = 4     // minimum films per pole to compute a score

// ── Input shape ──────────────────────────────────────────────────────────────

export interface RatedFilmEntry {
  film_id:     string
  title:       string
  poster_path: string | null
  stars:       number
  dimensions_v2: FilmDimensionsV2
}

// ── Main computation ─────────────────────────────────────────────────────────

export function computeTasteCode(films: RatedFilmEntry[]): TasteCode | null {
  if (films.length < MIN_FILMS * 2) return null

  // Group poles by dimension
  const dimKeys = [...new Set(ALL_POLES.map(p => p.dimKey))]

  // For each pole, compute avg star rating on extreme films
  const poleAvgs: Map<string, { avg: number; films: RatedFilmEntry[] }> = new Map()

  for (const dimKey of dimKeys) {
    const sorted = [...films].sort((a, b) => a.dimensions_v2[dimKey] - b.dimensions_v2[dimKey])
    const cutoff = Math.max(MIN_FILMS, Math.floor(sorted.length * EXTREME_PCT))
    const leftFilms  = sorted.slice(0, cutoff)
    const rightFilms = sorted.slice(sorted.length - cutoff)

    const leftAvg  = leftFilms.reduce((s, f) => s + f.stars, 0) / leftFilms.length
    const rightAvg = rightFilms.reduce((s, f) => s + f.stars, 0) / rightFilms.length

    poleAvgs.set(`${dimKey}:left`,  { avg: leftAvg,  films: leftFilms })
    poleAvgs.set(`${dimKey}:right`, { avg: rightAvg, films: rightFilms })
  }

  // Library-range normalization
  const allAvgs = [...poleAvgs.values()].map(v => v.avg)
  const globalMin = Math.min(...allAvgs)
  const globalMax = Math.max(...allAvgs)
  const range = globalMax - globalMin

  const normalize = (avg: number) =>
    range === 0 ? 50 : Math.round(((avg - globalMin) / range) * 100)

  // Compute gap per dimension, pick top 4
  const dimGaps = dimKeys.map(dimKey => {
    const left  = poleAvgs.get(`${dimKey}:left`)!
    const right = poleAvgs.get(`${dimKey}:right`)!
    const leftScore  = normalize(left.avg)
    const rightScore = normalize(right.avg)
    const gap = Math.abs(leftScore - rightScore)
    const dominantPole: 'left' | 'right' = rightScore >= leftScore ? 'right' : 'left'
    return { dimKey, leftScore, rightScore, gap, dominantPole, left, right }
  }).sort((a, b) => b.gap - a.gap)

  // Compute entries for ALL 12 dimensions (sample films for each)
  const allEntries: TasteCodeEntry[] = dimGaps.map(({ dimKey, leftScore, rightScore, gap, dominantPole, left, right }) => {
    const poleDef    = ALL_POLES.find(p => p.dimKey === dimKey && p.pole === dominantPole)!
    const oppPoleDef = ALL_POLES.find(p => p.dimKey === dimKey && p.pole !== dominantPole)!
    const domScore = dominantPole === 'right' ? rightScore : leftScore
    const oppScore = dominantPole === 'right' ? leftScore  : rightScore
    const domFilms = dominantPole === 'right' ? right.films : left.films
    const oppFilms = dominantPole === 'right' ? left.films  : right.films

    const toFilm = (f: RatedFilmEntry): TasteCodeFilm => ({
      film_id:     f.film_id,
      title:       f.title,
      poster_path: f.poster_path,
      stars:       f.stars,
      dimScore:    f.dimensions_v2[dimKey],
    })

    const sampleFilms:    TasteCodeFilm[] = [...domFilms].sort((a, b) => b.stars - a.stars).map(toFilm)
    const oppSampleFilms: TasteCodeFilm[] = [...oppFilms].sort((a, b) => b.stars - a.stars).map(toFilm)

    return {
      letter:                 poleDef.letter,
      label:                  poleDef.label,
      description:            poleDef.description,
      negativeDescription:    poleDef.negativeDescription,
      dimKey,
      pole:                   dominantPole,
      poleScore:              domScore,
      oppositeScore:          oppScore,
      gap,
      filmCount:              domFilms.length,
      sampleFilms,
      oppLetter:              oppPoleDef.letter,
      oppLabel:               oppPoleDef.label,
      oppFilmCount:           oppFilms.length,
      oppSampleFilms,
      oppNegativeDescription: oppPoleDef.negativeDescription,
    }
  })

  const entries = allEntries.slice(0, 4)

  return {
    letters: entries.map(e => e.letter).join(''),
    entries,
    allEntries,
  }
}

// ── Compatibility analysis ────────────────────────────────────────────────────

export type CompatBucket = 'shared' | 'opposing' | 'asymmetric'

export interface CompatEntry {
  bucket:     CompatBucket
  myEntry:    TasteCodeEntry | null
  theirEntry: TasteCodeEntry | null
  dimKey:     keyof FilmDimensionsV2
}

export function compareTaskCodes(mine: TasteCode, theirs: TasteCode): CompatEntry[] {
  const myDims   = new Map(mine.entries.map(e => [e.dimKey, e]))
  const theirDims = new Map(theirs.entries.map(e => [e.dimKey, e]))
  const allDimKeys = new Set([...myDims.keys(), ...theirDims.keys()])

  const results: CompatEntry[] = []

  for (const dimKey of allDimKeys) {
    const myE   = myDims.get(dimKey) ?? null
    const theirE = theirDims.get(dimKey) ?? null

    let bucket: CompatBucket
    if (myE && theirE) {
      bucket = myE.pole === theirE.pole ? 'shared' : 'opposing'
    } else {
      bucket = 'asymmetric'
    }

    results.push({ bucket, myEntry: myE, theirEntry: theirE, dimKey })
  }

  // Sort: shared first, then opposing, then asymmetric
  const order: Record<CompatBucket, number> = { shared: 0, opposing: 1, asymmetric: 2 }
  results.sort((a, b) => order[a.bucket] - order[b.bucket])

  return results
}
