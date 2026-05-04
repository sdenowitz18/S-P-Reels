# PRD: Taste Profile
_Epic 1 | Last updated: 2026-05-04_

The taste profile is the engine of sp-reels. It computes what you respond to in film, represents it as a structured identity code, and surfaces it in a way that feels accurate and personally resonant.

---

## Feature 1: Taste Vector

### What's built
- Deviation-weighted algorithm: each rated film contributes `(stars − userAvg) × dimensionScore` to the vector
- Per-film dimension scores from `ai_brief.dimensions_v2` (12 dimensions, 0–100 scale)
- Vector computed as weighted average across all rated films that have a brief
- Normalized rating stats: per-user mean (μ) and standard deviation (σ), floored at 0.6
- Stored and returned via `/api/profile/taste`

### Design decisions
- **Deviation-weighted** (not raw stars): a 4-star rating from someone whose average is 3.5 carries more signal than from someone whose average is 4.8
- `dimensions_v2` chosen over original `dimensions` — better calibration, consistent 0–100 scale
- Films without `ai_brief.dimensions_v2` contribute nothing to the vector (no junk signal)

### Open requirements
- [ ] Confidence score per dimension (how many films contributed meaningful signal)
- [ ] Surface low-confidence dimensions to user ("rate more films in this area to sharpen")

---

## Feature 2: Taste Code

### What's built
- 4-letter MBTI-style identity code derived from the top-4 most-signal dimensions
- Algorithm:
  1. For each of 12 dimensions, sort rated films by dimension v2 score
  2. Take top 20% as right-pole films, bottom 20% as left-pole films
  3. Compute avg star rating on each group (deviation-weighted)
  4. Normalize 0–100 using library's actual min/max avg
  5. Rank dimensions by gap between pole scores
  6. Top 4 → pick letter for higher-scoring pole
- `TasteCode.allEntries`: all 12 dimensions computed (used for Quick Rate diff)
- Tier system: strong (≥70), medium (≥40), weak (<40) based on pole score
- Prose generation: tier-aware tone (strong = definitive, medium = leaning, weak = tentative)
- `negativeDescription`: what you don't respond to (used alongside affirmative)
- Sample film ordering: films matching the stated preference shown first

### The 12 dimensions and letter pairs
| # | Dimension | Left pole | Right pole |
|---|---|---|---|
| 1 | Narrative Legibility | L — Legible | O — Opaque |
| 2 | Emotional Directness | V — Vivid | S — Subtle |
| 3 | Plot vs Character | P — Plot | C — Character |
| 4 | Naturalistic vs Stylized | N — Naturalistic | T — Theatrical |
| 5 | Intimate vs Epic | I — Intimate | E — Epic |
| 6 | Kinetic vs Patient | Q — Quick | D — Deliberate |
| 7 | Moral Clarity | J — Just | A — Ambiguous |
| 8 | Psychological Safety | G — Grounded | H — Harrowing |
| 9 | Accessible vs Demanding | F — Familiar | X — Demanding |
| 10 | Behavioral Realism | R — Realistic | Y — Archetypal |
| 11 | Sensory vs Intellectual | Z — Gut | M — Mind |
| 12 | Narrative Closure | W — Whole | K — Questioning |

### Open requirements
- [ ] Code sharing / export (image, shareable link)
- [ ] Minimum film threshold messaging ("rate X more films to sharpen your code")
- [ ] Dimension refresh: audit whether current 12 dimensions accurately capture cinematic taste

---

## Feature 3: H/M/L Pole Badge System

### What's built
- Three-tier signal strength badge displayed alongside every letter tile
- Tiers: Strong (≥70), Moderate (≥40), Weak (<40) based on pole score
- Applied on: taste code page, profile header, friend profiles, friend taste-code page, compatibility page tiles, onboarding reveal
- In dislikes mode: badge uses `oppositeScore` (reflects absolute strength of the displayed pole)
- On dark-background tiles: badge inverts (white background, dark text)
- **Exception:** blend header on `/friends/[id]` — 36×36 tiles too small for badge; border colors retained

### Open requirements
- [ ] Badge tooltips explaining what Strong/Moderate/Weak means

---

## Feature 4: Profile Page (`/profile`)

### What's built
- Taste code display (4-letter badge with H/M/L tiers)
- Top-4 dimension breakdown with pole labels and signal tier
- Rated film count
- "★ quick rate" entry point button
- Link to full taste code page (`/profile/taste-code`)
- Compatibility score with friends (where applicable)

### Open requirements
- [ ] Visual taste vector radar/chart
- [ ] "Taste evolution" — how your code has changed over time
- [ ] Match score distribution across your library
- [ ] What makes your taste distinctive vs. average user

---

## Feature 5: Taste Code Page (`/profile/taste-code`)

### What's built
- All 12 dimensions shown (not just top 4)
- Per-dimension: pole label, signal tier badge, prose description
- Prose is tier-aware: strong = definitive, medium = leaning, weak = tentative
- Dimension name shown prominently above prose in each row
- Sample films per dimension pole

### Open requirements
- [ ] Dimension deep-dive: "films that shaped this dimension" gallery
- [ ] `negativeDescription` shown for non-dominant poles in weak-signal dimensions
- [ ] "Dislikes" toggle showing what you pull away from

---

## Feature 6: Quick Rate (`/quick-rate`)

### What's built
- One-film-at-a-time flow (feels like onboarding, not a grid)
- Stages: intro → rating → calculating → result
- Film pool: enriched films not in the user's library, 50/50 movies and TV
- Any rating is useful (no extremes filter — contrast with onboarding calibration which needs extremes)
- Live save: `POST /api/library` per film, fire-and-forget
- Skip supported (film advances, count tracked separately)
- "Calculating" screen: animated MBTI letter tiles cycling → staggered lock-in on reveal
- Result screen: before/after taste code tiles + DimShift insight cards
- Entry points on `/movies`, `/profile`, `/add`

### DimShift logic (taste diff)
- Computes `computeShifts(pre, post)` across all 12 dimensions from `TasteCode.allEntries`
- Shift types surfaced: pole switched, signal strength tier changed, dimension entered/left top 4
- Shown as insight cards with before → after visualization

### Open requirements
- [ ] Prediction-aware shift direction (rated higher than expected = upward mover; lower = downward)
- [ ] TV shows in the film pool (currently skewing toward movies due to enrichment gaps)
- [ ] Minimum session size before showing result (currently triggers after 1 film)
- [ ] "You've rated N films this session" counter on result screen

---

## Technical reference

- `lib/taste-code.ts` — `ALL_POLES`, `TasteCode`, `computeTasteCode`, `allEntries`
- `lib/taste/match-score.ts` — `computeMatchScore`, `applyQualityMultiplier`, `computeCompositeQuality`
- `lib/taste/calibration-films.ts` — calibration film list (onboarding only, separate from quick-rate)
- `app/api/profile/taste/route.ts` — taste vector + taste code computation
- `app/api/profile/taste-export/route.ts` — exportable taste data
- `app/(app)/profile/page.tsx` — profile page
- `app/(app)/profile/taste-code/page.tsx` — full 12-dimension breakdown
- `app/(app)/quick-rate/page.tsx` — quick rate one-at-a-time flow
