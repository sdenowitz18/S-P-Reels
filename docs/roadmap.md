# Product Roadmap
*May 3, 2026 — Post-Watch Flow & Taste Profile Depth*

Reference PRD: `docs/post-watch-flow.md`

---

## What exists today

| Area | What's there |
|---|---|
| Logging | Single-screen form (`/add/[slug]/rate`) — stars, rewatch, comment in one view |
| Onboarding calibration | Card-by-card rating flow with letter slots, coverage-based termination |
| Taste code | `computeTasteCode` — gap-ranked dimensions, 4-letter code, allEntries for all 12 |
| Match score | `/api/recommendations/taste/[filmId]/match` — formula uses gap-weighted alignment (needs correction) |
| Taste page | Letters, confidence dots, prose, genre, directors, decades, top rated |
| Genre data | AI genres (weighted score) + TMDB simple genres — both computed in taste route |
| Monthly report | `/taste-report` — exists but needs structural overhaul |
| Friends | Compatibility, taste comparison, genre overlap, find together |
| Recommendations | Mood room, taste-based recs, inbox |
| Letterboxd import | Parse + import flow with film strip carousel |

---

## Dependency map

```
Phase 1 (Foundation)
  └─► Phase 2 (Log flow)
        └─► Phase 3 (Match score surfaces)   ← also needs Phase 1
  └─► Phase 4 (Quick Rate)                   ← can run parallel to Phase 2
  └─► Phase 5 (Profile & reporting)          ← can start after Phase 1
```

Phase 1 is a prerequisite for everything. Phases 2 and 4 can be built in parallel after Phase 1 lands. Phase 3 should ship after Phase 2 (the insight card references the match score — they should launch together). Phase 5 is largely independent once Phase 1 is done.

---

## Phase 1 — Foundation
*Estimate: 1–2 weeks*

Prerequisites that everything downstream depends on. Nothing user-facing is blocked on finishing all of Phase 1 simultaneously — each item can ship as soon as it's done.

### 1.1 Match score formula correction
**File:** `app/api/recommendations/taste/[filmId]/match/route.ts`

Replace the current gap-weighted alignment formula with pole score interpolation:

```
alignment_i = leftPoleScore × (1 − film_score / 100)
            + rightPoleScore × (film_score / 100)

match_score = Σ alignment_i / 12
```

Where `leftPoleScore` / `rightPoleScore` are the user's normalized average ratings for films at each pole (0–100). Dimensions with insufficient data contribute at neutral (50). No gap weighting — the match score reflects how much the user likes films at this position, not which pole they prefer.

Suppressed (not computed or displayed) for users with fewer than 8 logged films.

### 1.2 Normalized rating stats per user
New computation: per-user mean (μ) and standard deviation (σ) across all logged star ratings.

- Computed on demand and cached (similar to taste prose caching pattern)
- Floor: σ minimum of 0.6 to prevent collapse for narrow raters
- Below 10 logs: use absolute thresholds as fallback (≥ 4.0 = liked, ≤ 2.5 = didn't land)
- Used by: insight card (predicted stars, delta calculation), monthly report, taste page summary

### 1.3 H/M/L pole badge system
**Touches:** `lib/taste-code.ts`, taste code display everywhere

Each letter gets a small colored H/M/L badge based on the pole's absolute normalized score (0–100), independent of the gap:
- **H** ≥ 65 → forest green
- **M** 35–64 → amber
- **L** < 35 → muted gray

`TasteCodeEntry` already contains `poleScore` and `oppositeScore`. This is a UI-only change — extract a `<TasteLetter>` component that renders letter + badge, use it everywhere letters appear: taste code page, profile header, friend profiles, friend taste-code page, onboarding reveal.

Numbers currently shown under/alongside letters are removed. The badge replaces them. The gap tier (Strong / Moderate / Weak) remains available as context but is not surfaced as a number.

### 1.4 Haven't seen + Skip for now in onboarding
**File:** `app/(app)/onboarding/rate/[id]/page.tsx`

Replace the single "haven't seen →" pass option with two:
- **"Haven't seen →"** — genuinely not seen; no data recorded
- **"Skip for now →"** — seen it but can't reliably rate it right now; passes silently

Both appear below the star rating. Layout: side by side or stacked, consistent with the existing footer style.

Apply the same two-option pattern anywhere a film card is shown for rating (onboarding calibration, future Quick Rate).

### 1.5 Home page copy fix
**File:** `app/(app)/home/page.tsx`

- Log card CTA: "open the room →" → "log a film →"
- Straightforward copy change, no logic change

---

## Phase 2 — Post-Watch Log Flow
*Estimate: 3–4 weeks*

The centerpiece feature. Replaces the current single-screen add form with a 5-card paginated flow ending in an insight card. This is the core loop: small input → real insight.

### 2.1 Log signal record (DB)
New table (or columns on `library_entries`) to store per-log signal data:

| Field | Type | Notes |
|---|---|---|
| `rewatch` | enum | yes / maybe / no / null |
| `fit_answer` | enum | yes / surprisingly_yes / surprisingly_no / no / null |
| `fit_dimension` | text | dimension key or null |
| `fit_pole` | enum | left / right / null |
| `match_score_at_log` | int | match score at time of logging |
| `predicted_stars` | float | μ + predicted_z × σ at time of logging |
| `delta_stars` | float | actual − predicted |
| `delta_z` | float | delta_stars / σ |
| `user_mu_at_log` | float | snapshot of μ |
| `user_sigma_at_log` | float | snapshot of σ |
| `taste_code_before` | jsonb | taste code state before this log |
| `taste_code_after` | jsonb | taste code state after this log |

Snapshotting μ, σ, and taste code before/after preserves historical meaning as the user's profile evolves.

### 2.2 Per-log taste code diff
**API:** extend the log/rate endpoint

On every log that includes a star rating:
1. Fetch user's rated films with `dimensions_v2`
2. Run `computeTasteCode` → before state
3. Save the new rating
4. Run `computeTasteCode` → after state
5. Diff: identify tier step changes and pole shifts
6. Store before/after in the log signal record
7. Return the diff in the API response for the insight card to consume

Only runs when the film has `dimensions_v2` data. Skips silently if data is absent.

### 2.3 Five-card log flow
**Replaces:** `app/(app)/add/[slug]/rate/page.tsx` and associated pages

New paginated card-by-card flow. Each card is a full-screen view:

- **Card 1 — Rating:** Star field only. Auto-advance on tap. Required.
- **Card 2 — Rewatch:** Yes / Maybe / No. Auto-advance. Skippable.
- **Card 3 — Fit Check:** Yes / Surprisingly yes / Surprisingly no / No. Auto-advance. Skippable. If answered: follow-up showing 3–4 tappable dimension labels derived from the film's highest-scoring poles. Labels from the 24-pole lookup table in the PRD.
- **Card 4 — Comment:** Free text. Optional. Skip or Done advances.
- **Card 5 — Insight Card:** Delivery card. See 2.4.

Back navigation: tapping back returns to the previous card with answer pre-filled. Card transitions: slide, under 200ms. Flow state preserved if app is backgrounded.

"Rate & Reflect" entry point removed. Single "Log" CTA enters this flow.

### 2.4 Insight card (Card 5)
**New component.** Rule-based, no LLM call.

**Structure:**
1. Match score and predicted star rating: *"Based on your taste profile, we predicted you'd rate this around 4.2★."*
2. Actual outcome: *"You gave it 3.0★ — about a star below what we expected."*
3. Delta interpretation (from delta_z bucket): spot on / slightly above / notably above / slightly below / notably below
4. Dimensional explanation: when |Δz| ≥ 0.5, name the dimension most responsible. If Card 3 follow-up was answered, reference the user's selection directly. Otherwise infer from highest-mismatch dimension.
5. Profile movement (only when something changed): tier step changes and pole shifts triggered by this log.

Suppressed elements: match score section suppressed for users with < 8 logged films. Profile movement section suppressed if nothing changed (most logs).

CTA: "See your full taste profile →"

---

## Phase 3 — Match Score Surfaces
*Estimate: 1 week*

Ships after Phase 2. The insight card already references the match score — these surfaces make it visible before logging, completing the prediction → log → insight loop.

### 3.1 Match score on film detail pages
**File:** `app/(app)/movies/page.tsx` (or wherever film detail renders)

Match score (0–100) shown prominently alongside the film title. Loud, not buried. For users with < 8 logged films: not shown. Implementation: call the match route on load, render with appropriate loading state.

### 3.2 Match score on recommendation surfaces
**Files:** `/recommended/page.tsx`, mood room recommendations

Match score shown as primary signal for why a film is surfaced. Replaces or supplements whatever is currently shown as the recommendation rationale.

---

## Phase 4 — Quick Rate
*Estimate: 2–3 weeks. Can run in parallel with Phase 2.*

### 4.1 Film pool logic
Every film in the system that is not in the user's library (not watched, now playing, or watch list). No separate curation — the full catalog is the pool. Ordered to maximize dimensional coverage signal: prioritize films that would fill low-confidence dimensions in the user's current profile first.

Needs a server-side endpoint: given a user's current taste code (gaps and pole score confidence), return the next N films to show, ordered by coverage value.

### 4.2 Quick Rate session UI
**Adapts:** `app/(app)/onboarding/rate/[id]/page.tsx`

Same card-by-card interaction as the onboarding calibration flow. Extract a shared `<FilmRatingSession>` component parameterized by:
- Film pool source (calibration set vs. Quick Rate pool)
- Termination condition (coverage threshold vs. user-driven Done)
- On-completion handler (onboarding reveal vs. Quick Rate delta screen)

Additions specific to Quick Rate:
- "Done" button always available — no minimum gate
- Each rated film is written to the watched library immediately (same as individual log)
- Haven't seen + skip for now (Phase 1.4)

### 4.3 Session-end delta screen
**Adapts:** `app/(app)/onboarding/reveal/[id]/page.tsx`

Lighter than the onboarding reveal. Shows:
- Films rated this session
- Taste code before and after (letters + badges)
- Tier step changes and pole shifts triggered by this session
- One narrative line: *"These ratings strengthened your [dimension] signal. You're reading more clearly as a [pole] viewer."*

No ceremony — this is a diff, not a reveal. CTA: back to wherever the user came from.

### 4.4 Entry points
- **Watched page:** Add "Log Multiple Films" button alongside existing "Import from Letterboxd" and "Log a Film"
- **Home page:** No fork. Log card goes directly to single-film logging. Copy change only: "open the room →" → "log a film →"
- **Profile page:** "Build Taste Profile" persistent nudge — shown when one or more top dimensions have weak (Low) signal. Links directly into Quick Rate.

---

## Phase 5 — Profile & Reporting Depth
*Estimate: 3–4 weeks. Can start after Phase 1.*

### 5.1 Taste page recent activity summary
New block on the taste page showing the dimensional character of recent viewing:
- Films logged this week / this month (count)
- Top 2–3 dimension poles most represented in those films (what kind of films they've been watching)
- Average star rating for the period
- Brief genre note if one genre dominates

### 5.2 Genre page restructure
**File:** `app/(app)/profile/taste-code/page.tsx` (or genre tab within profile)

- **Top 4 genres** shown at top of genre view, mirroring the taste code letter structure. Derived from weighted genre scores (already computed in taste route).
- If a genre entered or left the top 4 since last month: highlighted with the films that drove the movement — same pattern as dimension letter movement.
- Monthly summary block: genre distribution for the month, average star rating per genre where data permits, narrative sentence.

**TMDB simple genres** are used for the top-4 display. AI detailed genres are used in taste prose and mood recommendations but not for this surface.

### 5.3 Monthly report restructure
**File:** `app/(app)/taste-report/page.tsx`

New structure (replaces current):
1. Taste code this month — letters with H/M/L badges
2. Step changes — dimensions that crossed a tier threshold during the month, with the films that drove each
3. Pole shifts — dimensions where dominant pole changed
4. Recent watches — films logged this month
5. Month in summary — total logged, average rating vs. overall average, dominant dimension characteristics of what was watched, genre distribution note, one narrative observation connecting the changes to the films

Framing: step changes and pole shifts, never continuous deltas ("your signal crossed from moderate to high" not "went up by 4 points").

### 5.4 Prose enrichment with dual-signal data
**File:** `lib/prompts/taste-profile.ts` (or wherever `generateTasteProse` is defined)

Update the prose generation prompt to receive dual-signal data: for each dimension, the dominant pole, the gap tier, and both pole score tiers (H/M/L). The prose should articulate nuance:
- H/H with strong gap: *"You connect with [pole] deeply — but it's not that [opposite] films leave you cold. You enjoy them; [pole] just consistently wins."*
- H/L with strong gap: *"[Pole] isn't just a preference — films at the other end tend to actively lose you."*
- H/H with weak gap: *"You're genuinely comfortable across the [dimension] spectrum — relatively unusual."*

**Friend comparison prose:** When viewing a shared dimension on the friends compatibility page, generate comparison prose using both users' dual-signal data. Surfaces genuine contrasts: same pole preference but different opposite-pole tolerance, or opposing poles but both users have high absolute scores. This prose is generated at view time (or cached per pair). Reads like a knowledgeable observer, not a data recitation.

**Prose regeneration cadence:** Not per log. Regenerate when film count has increased by ≥ 5 since last generation (current behavior, keep), plus a weekly background job for active users (logged in last 30 days).

---

## Summary

| Phase | What ships | Estimate | Dependency |
|---|---|---|---|
| 1 — Foundation | Match score formula, normalized stats, pole badges, skip options, copy fix | 1–2 wks | None |
| 2 — Log flow | 5-card log, insight card, per-log taste code diff | 3–4 wks | Phase 1 |
| 3 — Match score surfaces | Match score on film pages + recommendations | 1 wk | Phase 1 + 2 |
| 4 — Quick Rate | Film pool, session UI, delta screen, entry points | 2–3 wks | Phase 1 (parallel to 2) |
| 5 — Profile depth | Taste summary, genre page, monthly report, prose enrichment | 3–4 wks | Phase 1 |

**Total: ~10–14 weeks** depending on parallelization.

---

## Decisions resolved

1. **Log flow fork UX:** No fork on the home page. The Log card is a single direct path to single-film logging — tapping it goes straight to search → 5-card flow. Quick Rate is not surfaced from the home page. It lives on the Watched page ("Log Multiple Films" button) and the Profile page ("Build Taste Profile" nudge). Home page change is copy-only: "open the room →" → "log a film →".

2. **Genre top-4:** TMDB simple genres are the primary display for the top-4 on the genre page. AI detailed genres are used elsewhere (genre affinity in taste prose, mood recommendations) but not for the main genre ranking surface.

3. **Prose regeneration schedule:** Weekly background job, active users only — defined as users who have logged at least one film in the past 30 days.

4. **Quick Rate film pool:** Any film in the system that is not already in the user's library (watched, now playing, or watch list). No separate curation needed — the full catalog minus the user's existing entries is the pool, ordered by coverage-optimization logic (fill low-confidence dimensions first).

5. **Insight card thumbs up/down:** Included in v1.
