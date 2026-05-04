/**
 * lib/taste/blend.ts
 *
 * Blend N taste codes into a single "group taste code" for Mood Room scoring.
 *
 * Algorithm: geometric mean of pole scores per dimension.
 *
 *   groupPoleScore = (s1 × s2 × … × sN) ^ (1/N)
 *
 * Why geometric mean?
 * - Naturally penalizes dimensions where ANY member has low affinity
 * - Doesn't inflate scores for dimensions where a few people score high
 * - Scales cleanly to any group size
 * - A floor of 5 prevents log(0) and represents "no signal" rather than "zero"
 *
 * Usage:
 *   const blended = blendTasteCodes([aliceTasteCode, bobTasteCode, carolTasteCode])
 *   const score = computeMatchScore(blended, filmDimensions)
 */

import { TasteCode, TasteCodeEntry, ALL_POLES } from '@/lib/taste-code'

const FLOOR = 5  // minimum pole score to prevent geometric collapse

/**
 * Compute the geometric mean of an array of positive numbers.
 * Numbers are floored at FLOOR before multiplication.
 */
function geometricMean(values: number[]): number {
  if (values.length === 0) return FLOOR
  const floored = values.map(v => Math.max(v, FLOOR))
  const product = floored.reduce((acc, v) => acc * v, 1)
  return Math.pow(product, 1 / floored.length)
}

/**
 * Blend N TasteCode objects into a single blended TasteCode.
 *
 * Members without signal on a dimension (poleScore ≈ 50, no strong lean)
 * are included — their neutral score moderates the blend without collapsing it.
 *
 * Returns null if codes array is empty.
 */
export function blendTasteCodes(codes: TasteCode[]): TasteCode | null {
  if (codes.length === 0) return null
  if (codes.length === 1) return codes[0]

  // For each dimension, geometric-mean the poleScore and oppositeScore
  // across all members. We use allEntries (all 12 dims).
  const blendedEntries: TasteCodeEntry[] = ALL_POLES
    .filter(p => p.pole === 'left')  // one entry per dim (left defines the pair)
    .map(leftPole => {
      const dimKey = leftPole.dimKey

      // Collect left & right scores per member
      const leftScores: number[] = []
      const rightScores: number[] = []

      for (const code of codes) {
        const entry = code.allEntries.find(e => e.dimKey === dimKey)
        if (!entry) {
          // Member has no entry for this dim — treat as neutral
          leftScores.push(50)
          rightScores.push(50)
          continue
        }

        // entry.pole tells us which pole is dominant
        if (entry.pole === 'left') {
          leftScores.push(entry.poleScore)
          rightScores.push(entry.oppositeScore)
        } else {
          rightScores.push(entry.poleScore)
          leftScores.push(entry.oppositeScore)
        }
      }

      const blendedLeft  = geometricMean(leftScores)
      const blendedRight = geometricMean(rightScores)

      // The dominant pole for the group is whichever is higher
      const groupPole: 'left' | 'right' = blendedLeft >= blendedRight ? 'left' : 'right'
      const groupPoleScore = groupPole === 'left' ? blendedLeft : blendedRight
      const groupOppScore  = groupPole === 'left' ? blendedRight : blendedLeft
      const gap = groupPoleScore - groupOppScore

      const rightPole = ALL_POLES.find(p => p.dimKey === dimKey && p.pole === 'right')!
      const dominantPole = groupPole === 'left' ? leftPole : rightPole
      const oppPole      = groupPole === 'left' ? rightPole : leftPole

      return {
        letter:                dominantPole.letter,
        label:                 dominantPole.label,
        description:           dominantPole.description ?? '',
        negativeDescription:   dominantPole.negativeDescription ?? '',
        dimKey,
        pole:                  groupPole,
        poleScore:             groupPoleScore,
        oppositeScore:         groupOppScore,
        gap,
        filmCount:             0,   // synthetic — no real film list
        sampleFilms:           [],
        oppLetter:             oppPole.letter,
        oppLabel:              oppPole.label,
        oppFilmCount:          0,
        oppSampleFilms:        [],
        oppNegativeDescription: oppPole.negativeDescription ?? '',
      } satisfies TasteCodeEntry
    })
    .sort((a, b) => b.gap - a.gap)  // allEntries ordered by gap desc

  // letters = top 4 by gap
  const letters = blendedEntries.slice(0, 4).map(e => e.letter).join('')

  return {
    letters,
    entries:    blendedEntries.slice(0, 4),
    allEntries: blendedEntries,
  }
}
