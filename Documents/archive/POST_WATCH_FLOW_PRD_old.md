# Post-Watch Logging Flow & Insight Card
### Product Requirements Document — v3
*May 3, 2026*

---

## Problem

The current logging experience presents rating, rewatchability, and comment in a single form view. It captures that someone watched something and roughly how much they liked it — but it does not capture *why*, and it delivers no value back to the user in exchange for their input.

A conversational AI interview after every log was considered and ruled out: at any meaningful user volume, per-session LLM calls are prohibitively expensive. A lightweight, paginated rule-based flow captures equivalent dimensional signal at near-zero marginal cost per log.

Without structured dimensional signal from post-watch interactions, the taste profile can only update from the raw star rating alone — not from the meaning of that rating relative to the film's character. Recommendation quality stays noisy. The match score has nothing to validate itself against over time.

The core exchange: **you give us a few quick inputs, we tell you something about yourself you might not have consciously registered.** That loop — small effort, real insight — is what makes repeated logging feel worthwhile.

---

## User

A film and TV enthusiast who logs what they watch and wants the app to understand them better over time. They are on their phone or couch immediately after finishing something. They have feelings but limited patience. They will not fill out a form. They will engage with something fast, tactile, and rewarding — if and only if the payoff is real.

They are motivated by one thing: the app knowing them better than any other app does. They will invest small amounts of effort repeatedly if the output — a more accurate taste profile, better recommendations, real self-knowledge — is visibly improving.

---

## Entry Point

**"Log"** is the single unified CTA. It replaces both "Rate" and "Rate & Reflect." The "Rate & Reflect" entry point is removed entirely — no replacement, no redirect. The Comment card covers the use case for users who want to write something.

---

## The Flow

Five cards. Each occupies its own full-screen view with a single focused interaction. No scrolling within a card. Total time under 90 seconds.

**Navigation:** Back is available on all cards — tapping back returns the user to their previous card with their answer pre-filled. Skip is available on Cards 2–4. Card 1 is the only required gate.

Card transitions: slide animation, under 200ms.

Flow state is preserved if the user backgrounds the app mid-flow. Resuming returns them to the card they left on.

---

### Card 1 — Rating

**Prompt:** Film title. Stars below it. Nothing else on screen.
**Interaction:** Tap a star. Half-stars supported. Auto-advance on selection (150ms delay before advancing — lets the tap register).
**Required.** Cannot be skipped. This is the only gate.

---

### Card 2 — Rewatch

**Prompt:** *"Would you rewatch this?"*
**Options:** Yes / No — two large, full-width tappable buttons. Skippable.

- **Yes:** A 0–10 slider appears below. User sets how rewatchable it is, then confirms to advance. Store `rewatch: true` and `rewatch_score: 0–10`.
- **No:** Advance immediately. Store `rewatch: false`. No score stored.
- **Skip:** Advance. Both fields remain null.

"Maybe" is intentionally removed — the question is a real commitment either way, which keeps the rewatchable filter on the Watched page trustworthy.

**Watched page filter:** A "Rewatchable" filter button on the Watched page shows only `rewatch: true` films, sorted by `rewatch_score` descending.

---

### Card 3 — Fit Check

**Prompt:** *"Did this feel like your kind of film?"*
**Options:** Yes / Surprisingly yes / Surprisingly no / No
Auto-advance on selection. Skippable.

**Optional follow-up** (shown only if the user answered — skipped if they tapped skip):

Copy adapts to their answer:
- Yes / Surprisingly yes → *"What pulled you in?"*
- No / Surprisingly no → *"What didn't land?"*

Surfaces 3–4 tappable labels derived from the film's highest-scoring dimensional poles. The user never sees more than 3–4 options — only the labels corresponding to where this specific film sits most extremely. One tap to select, auto-advance. Skippable.

The label lookup table (see Dimension Labels section) is a backend mapping — 12 dimensions × 2 poles = 24 possible labels — used to determine which options to surface. It is not shown to the user.

If dimensional data is unavailable for this film, the follow-up is skipped automatically. The Card 3 primary answer is still recorded.

**Signal this generates:**
- The primary answer (yes / surprisingly yes / surprisingly no / no) tells us whether the user's felt experience aligned with the predicted match score.
- The follow-up selection, if provided, tells us which specific dimension drove the reaction — structured signal we can compute with.

---

### Card 4 — Comment

**Prompt:** *"Anything you want to remember about this one?"*
Free text. Optional. No character minimum or maximum in v1. Keyboard appears on focus. Done / skip advances.

---

### Card 5 — Insight Card

A delivery card, not an input card. The user receives something.

See **Insight Card Logic** section below.

**CTA:** *"See your full taste profile →"*
**Secondary:** dismiss.

---

## Dimension Labels

Card 3 follow-up surfaces labels from the film's top-scoring dimensional poles, rendered in plain language. Always show the pole the film actually sits at — never show both poles of the same dimension on one card.

| Dimension | Left pole label | Right pole label |
|---|---|---|
| `narrative_legibility` | *how easy it was to follow* | *how much it left unsaid* |
| `emotional_directness` | *how it hit you emotionally* | *how understated it was* |
| `plot_vs_character` | *the story — what happened* | *the character depth* |
| `naturalistic_vs_stylized` | *how real it all felt* | *the visual style* |
| `narrative_closure` | *how it all came together* | *how it left things open* |
| `intimate_vs_epic` | *how personal and close it stayed* | *the scale of it* |
| `accessible_vs_demanding` | *how easy it was to get into* | *it didn't hold your hand* |
| `psychological_safety` | *where it ended up emotionally* | *how uncomfortable it got* |
| `moral_clarity` | *the clear sense of right and wrong* | *the moral grey area* |
| `behavioral_realism` | *how human the characters felt* | *the bigger-than-life characters* |
| `sensory_vs_intellectual` | *the atmosphere and feeling* | *the ideas behind it* |
| `kinetic_vs_patient` | *the energy and momentum* | *the pacing — it took its time* |

Surface the 3–4 labels corresponding to the film's most extreme dimension scores. Full copy mapping and tone review required before launch — label resonance is a known risk.

---

## Match Score (0–100)

The match score expresses how much a user tends to like films that sit where this film sits across all 12 dimensions. It is computed from pole scores — not from which pole dominates or what the gap is. The gap is irrelevant here. What matters is: how much does this person rate films like this?

### Calculation

For each of the 12 dimensions, compute an alignment score by interpolating the user's two pole scores based on where the film sits on that dimension:

```
film_score  = film.dimensions_v2[dim]                         // 0–100

alignment_i = leftPoleScore  × (1 − film_score / 100)
            + rightPoleScore × (film_score / 100)
```

Where `leftPoleScore` and `rightPoleScore` are the user's normalized average star ratings for films at each pole of that dimension (0–100 scale, same values that drive the H/M/L pole badges).

**Why this is right:** A film scoring 80 on the patient pole is evaluated against how highly the user rates patient films — not against whether they prefer patient over kinetic. If the user rates both poles highly, this film still scores well on this dimension. Pole dominance (the gap) does not enter the match score at all.

For a film at the midpoint of a dimension (score ≈ 50), both pole scores contribute equally. For a film at an extreme (score near 0 or 100), the score is dominated by the relevant pole.

Dimensions without sufficient data (fewer than `MIN_FILMS` rated films in one or both pole groups) contribute at neutral alignment (50) with equal weight. This prevents thin profiles from distorting the score.

Final match score — equal weight across all 12 dimensions:

```
match_score = Σ alignment_i / 12   → rounded to nearest integer, 0–100
```

### Display

The match score is shown **loud and prominent** on:
- Film detail pages — alongside the title, before the user has logged
- Recommendation surfaces — as the primary signal for why a film is being surfaced
- The insight card — as the anchor for the prediction vs. outcome comparison

**Suppressed** for users with fewer than 8 logged films. Below this threshold, no match score is computed for display and no prediction framing appears on the insight card.

---

## Normalized Rating

A raw star rating is not comparable across users. A 3.5 from a harsh rater who averages 2.8★ is a strong positive. A 3.5 from a generous rater who averages 4.3★ is lukewarm-to-negative. All insight logic operates on normalized ratings, not raw stars.

### Per-user stats

Once a user has ≥ 10 logged films:
- `μ` = mean star rating across all logged films
- `σ` = standard deviation of star ratings

**Floor:** σ is clamped to a minimum of 0.6 to prevent collapse in users with very narrow rating ranges (e.g. someone who only rates 3.5–4.5).

**Below 10 logs:** use absolute thresholds (≥ 4.0 = liked, ≤ 2.5 = didn't land, middle = neutral). Insight copy is hedged: *"based on your ratings so far…"*

---

## Match Score → Predicted Star Rating

The match score maps linearly to a predicted star rating on the user's personal scale, via their normalized distribution.

```
predicted_z     = (match_score − 50) / 25
                  // 100 → +2σ,  75 → +1σ,  50 → μ,  25 → −1σ,  0 → −2σ

predicted_stars = clamp(μ + predicted_z × σ,  0.5,  5.0)
```

**Example:** User averages 3.4★, σ = 0.7. Match score = 78.
```
predicted_z     = (78 − 50) / 25 = 1.12
predicted_stars = 3.4 + (1.12 × 0.7) = 4.18 → displayed as 4.2★
```

The insight card leads with: *"Based on your taste profile, we predicted you'd rate this around 4.2★."*

---

## Insight Card Logic

The insight card compares the predicted star rating against the actual star rating and explains the delta. All logic is rule-based. No live AI call.

### Delta calculation

```
delta_stars = actual_stars − predicted_stars
delta_z     = delta_stars / σ     // how many standard deviations off the prediction was
```

### Delta buckets → insight tone

| delta_z | Approximate delta | Tone |
|---|---|---|
| \|Δz\| < 0.5 | < ~0.35★ | Spot on |
| +0.5 ≤ Δz < +1.0 | ~0.35–0.7★ above | Liked it more than expected |
| Δz ≥ +1.0 | > ~0.7★ above | Meaningfully above — worth understanding |
| −1.0 < Δz ≤ −0.5 | ~0.35–0.7★ below | Liked it less than expected |
| Δz ≤ −1.0 | > ~0.7★ below | Meaningfully below — we got something wrong |

### Insight card structure

**Line 1 — the prediction:**
*"Based on your taste profile, we predicted you'd rate this around [predicted_stars]★."*

**Line 2 — the outcome:**
*"You gave it [actual_stars]★ — [delta interpretation]."*

Delta interpretation copy:
- Spot on: *"right in line with what we expected."*
- Slightly above: *"a little above what we predicted."*
- Meaningfully above: *"notably more than we predicted."*
- Slightly below: *"a little below what we predicted."*
- Meaningfully below: *"notably less than we predicted."*

**Profile movement (only shown when something changed):**

Below the prediction/outcome section, surface any taste profile changes triggered by this log:
- **Tier step change:** *"Your [dimension] signal just moved from moderate to strong."*
- **Pole shift:** *"Something shifted on [dimension] — you're now reading slightly more [pole] than before."*

If no dimensions changed tier or pole, this section is omitted entirely. Most logs will not trigger it.

**Line 3 — the dimensional explanation:**

When |Δz| ≥ 0.5, name the dimension most responsible:

- **Large positive delta** (rated higher than predicted): identify the dimension where the film's pole *most diverges* from the user's dominant preference but the user still rated high → *"You said [Card 3 label] pulled you in — and [dimension] is usually a stretch for you. That's what we didn't see coming."* If Card 3 was skipped, name the highest-mismatch dimension directly.

- **Large negative delta** (rated lower than predicted): identify the dimension where the film's pole most diverges from the user's preference → *"[Dimension] is usually strong for you, but this film sits at the opposite end. That likely accounts for the gap."*

- **Small delta or spot on:** optionally surface the dimension with the highest alignment → *"[Dimension] is a strong signal in your profile — this film leans that way, and it shows."*

### Card 3 integration

If the user answered the Card 3 follow-up (selected a dimensional label), the explanation in Line 3 references their selection directly rather than inferring from the delta. Their chosen label takes priority over algorithmic inference.

---

## What We Store Per Log

Every completed flow writes a structured log signal record alongside the star rating. This is the record of what we predicted, what happened, and what the user told us.

### Log signal record (per entry)

| Field | Source | Notes |
|---|---|---|
| `film_id` | — | |
| `logged_at` | — | |
| `stars` | Card 1 | Raw star rating |
| `rewatch` | Card 2 | boolean / null (skipped) |
| `rewatch_score` | Card 2 | 0–10 integer, null if rewatch is false or skipped |
| `fit_answer` | Card 3 | yes / surprisingly_yes / surprisingly_no / no / null |
| `fit_dimension` | Card 3 follow-up | Dimension key (e.g. `kinetic_vs_patient`) or null |
| `fit_pole` | Card 3 follow-up | left / right — which pole they selected |
| `comment` | Card 4 | Text or null |
| `match_score` | Computed at log time | The score we assigned before they rated |
| `predicted_stars` | Computed at log time | μ + predicted_z × σ, clamped |
| `delta_stars` | Computed at log time | actual − predicted |
| `delta_z` | Computed at log time | delta_stars / σ |
| `user_mu_at_log` | Snapshot | User's mean rating at time of logging |
| `user_sigma_at_log` | Snapshot | User's σ at time of logging |

Snapshotting μ and σ at log time matters — as the user logs more, their average shifts. We want to preserve what "normalized" meant at the moment of the log so historical records stay meaningful.

---

## What We Learn Across Logs

The per-log signal records accumulate into a secondary signal layer that is distinct from the raw taste profile. Two types of learning happen here.

### 1. Quantitative calibration — where our match score is systematically off

For each user, across all logs where `|delta_z| ≥ 0.5`, track:

**Per-dimension delta pattern:**
- For each dimension, group logs where that dimension was the highest-mismatch dimension (film's pole most diverges from user's preference)
- Compute the average `delta_z` across those logs
- If a dimension's average delta is consistently positive (we keep underpredicting): the user connects with that dimension's "wrong" pole more than calibration suggests — a signal the weight or pole assignment for that dimension may be off
- If consistently negative: the user is less tolerant of that dimension's mismatch than calibration suggests

This accumulates quietly. It does not rewrite the taste code — that stays calibration-derived. But it informs:
- The monthly drift report ("we've noticed you tend to rate [pole] films higher than your profile would predict")
- Future match score weighting refinements

**Fit answer vs. delta alignment:**
Track how often `fit_answer` agrees with `delta_z` direction:
- "Surprisingly yes" + large positive delta → fit answer is predictive and useful
- "Surprisingly yes" + small delta → the user felt surprise they didn't actually express in stars
- Systematic mismatches between felt experience (Card 3) and actual rating (delta) are themselves a signal worth surfacing

### 2. Qualitative signal — patterns in what users say pulled them in

`fit_dimension` + `fit_pole` selections aggregate into a per-user map of which dimensions they *consciously attribute* their reactions to — separate from what the algorithm infers.

Over time this reveals things like: a user whose taste profile says strong `C` (character-driven) but who consistently selects *"the visual style"* as what pulled them in — they may be underrating the `naturalistic_vs_stylized` dimension in their self-model, or it may simply be a dimension they notice without it being their core preference.

This qualitative map is not used to rewrite the taste code in v1, but it is:
- Available for the monthly drift report to surface as narrative ("you keep saying the visual style pulls you in — here's what your profile actually says about that")
- Stored for future model improvements

### 3. The "we were wrong" record

Every log where `|delta_z| ≥ 1.0` is a high-signal event. We predicted wrong by a meaningful margin. These records are the most valuable for calibration and should be surfaced explicitly in the monthly drift report — not hidden in an average.

The monthly report can say: *"Three times this month we significantly underestimated how much you'd connect with a film. All three were [patient / character-driven / visually stylized]. That's not a coincidence."*

---

## Profile Drift Mechanics

Post-watch logs do not directly rewrite the taste code. The taste code is recomputed from the user's full rated library using the existing algorithm (20th-percentile pole groups, gap ranking, normalization).

Every new logged film is added to the library. On the next taste code recompute, pole group memberships may shift — particularly for:
- Users with fewer than ~30 logged films (each new film carries meaningful weight)
- Films that sit at extreme poles (bottom or top 20% of the library on a given dimension)

For users with large libraries (100+ films), individual logs have negligible effect. This is correct — a stable profile should be stable.

**Monthly drift report (separate feature):** shows movement in taste code letters and gap scores over the past 30 days, with plain-language explanation of what changed and which films drove it. This is where the profile evolution story gets told.

---

## Quick Rate Mode (Profile Building Flow)

A separate mode from the full log flow. Purpose: rapidly build or strengthen a taste profile by rating films from memory — films the user has seen in their life but hasn't entered into the app at all.

**The pool is films not in the user's watched list, now playing, or watch list.** This is not a tool for re-rating existing library entries. It is for users who arrive with years of film history and want to get their knowledge into the system without logging each film as a full entry one at a time.

### Mental model

"I've seen a lot of films. Let me tell the app about them quickly so it understands my taste." Functionally the ongoing version of the onboarding calibration flow for non-Letterboxd users. Same card-by-card interaction, same letter display updating as ratings accumulate. The film pool is curated and surfaced by the system — the user doesn't search.

### Entry points

**Home page — Log card:** The Log card CTA currently reads "open the room →" which is unclear. Should read "log a film →" or similar. When a user taps the Log card, they may be offered a fork before reaching search: "log one film" vs "log multiple films" (Quick Rate). Whether this fork lives as a choice screen, a modal, or two separate buttons on the Log card is a design decision. The core concept: Quick Rate is accessible from the log entry point as an alternative path for volume rather than single-film depth.

**Watched page:** Three buttons — "Import from Letterboxd," "Log a Film," and "Log Multiple Films" (name TBD, Quick Rate). Accessible when a user is in their library context and wants to bulk-add ratings.

**Profile page:** "Build Taste Profile" — a persistent nudge shown when the user has low-confidence dimensions (weak signal on one or more of the top dimensions). Takes the user directly into Quick Rate. Framed around the outcome (a better profile) not the mechanic.

### Film pool

Films not present in the user's library (watched, now playing, or watch list). Curated and surfaced by the system — similar in character to the onboarding calibration pool but drawn from a broader set. Ordered to maximize dimensional coverage signal: prioritize films that would fill in low-confidence dimensions in the user's current profile. No fixed end point — the user rates until they choose to stop.

### Interaction per film

- Film poster, title, year
- Star rating (half-stars supported) — auto-advances on selection
- **"Haven't seen →"** — pass; no data recorded
- **"Skip for now →"** — I've seen it but can't reliably rate it right now; passes silently
- Back button — undoes the previous rating
- Taste code letter slots visible at top, updating in real-time as ratings accumulate and dimensions lock in (same behavior as onboarding calibration)

### Haven't seen vs. Skip — the distinction

**"Haven't seen"** → genuinely hasn't seen this film. No rating, no signal recorded.

**"Skip for now"** → has seen it but can't reliably rate it — saw it too long ago, can't remember it well enough. Passes without recording a rating. Does not add it to any list. Film may resurface in a future session.

Both pass options appear below the star rating on every card. The distinction prevents users from choosing between a wrong answer ("haven't seen" when they have) and a rating they don't trust.

### What it does NOT include

- Card 2 (rewatch)
- Card 3 (fit check)
- Card 4 (comment)
- Per-film insight card during the session

### Session-end summary

When the user finishes a Quick Rate session (taps "done" or reaches a natural stopping point), they receive a batch version of the post-log insight card:

- Films rated this session
- Taste code letters before and after the session
- Any tier step changes (Low→Med, Med→High, or reverse) across any dimension
- Any pole shifts (dominant pole changed on a dimension)
- One narrative observation: *"These ratings told us [X]. Your [dimension] signal strengthened. You're reading more clearly as a [pole] viewer."*

Same output logic as the per-log profile movement callouts, applied across the full session batch.

### Library and taste profile impact

Every film rated in Quick Rate is added to the watched list, exactly as if it had been logged individually. Quick Rate is bulk logging — the same library entry is created, the same taste profile signal is recorded. There is no special storage path; Quick Rate entries are not second-class.

The only difference from the full log flow is the absence of Cards 2–4 (rewatch, fit check, comment). Each rating feeds the taste profile computation, updates normalized stats, and may trigger tier step changes or pole shifts. Match score and profile drift mechanics apply equally.

### Relationship to onboarding calibration

Quick Rate and the onboarding calibration flow share the same UI interaction model (card-by-card, star rating, haven't seen / skip for now, back button, letter slots updating at top). Key differences:

| | Onboarding calibration | Quick Rate |
|---|---|---|
| Film pool | Curated fixed set | System-surfaced, coverage-optimized |
| Termination | Coverage-based (8+ dimensions) or user exits | User taps Done — no minimum |
| Films added to library | Yes | Yes |
| End screen | Full onboarding reveal (taste code + profile setup complete) | Lightweight delta screen — what changed, what moved |
| Next step | Interview / reveal / profile complete | Back to wherever the user came from |

The end screen for Quick Rate shows taste code letters before and after, step changes, pole shifts, and a brief narrative. It is not the full onboarding reveal ceremony — it is a focused diff of what this session produced.

---

## Haven't Seen vs. Skip — Applied Across Flows

The two-option pass applies in any context where a film is shown for rating:

| Context | Pool | "Haven't seen" applies? | "Skip for now" applies? |
|---|---|---|---|
| Onboarding calibration | Curated calibration films | Yes — user may not have seen them | Yes — seen long ago, can't reliably rate |
| Quick Rate | Films not in user's library | Yes — primary pass option | Yes — seen it but can't rate it reliably |
| Full log flow | Single film user chose to log | N/A — user initiated this | N/A |

In contexts where "haven't seen" is the only pass option today, both options should be available. The UI can present them as a single subtle row: *"Haven't seen →"* and *"Skip for now →"* side by side, or stacked, below the star rating.

---

## Shows

The post-watch flow applies to films and completed TV seasons/series only. In-progress shows are tracked via "now playing" — no rating flow until logged as complete. Flow and insight card logic are identical for both content types.

---

## Success Criteria

- ≥ 70% of users who complete Card 1 reach the Insight Card without dropping
- Card 3 skip rate tracked; iterate copy or card design if skip rate exceeds 60%
- Card 3 follow-up selection tracked by dimension label — informs which labels resonate, which get skipped
- Insight card accuracy (optional thumbs up/down) ≥ 65% positive in first 60 days
- Match score correlation with normalized ratings improves measurably over time as profile depth increases — tracked quarterly
- "Rate & Reflect" removal produces no measurable drop in logging volume within 30 days

---

## Confidence Badge System

Every letter displayed in the app carries two pieces of information: the letter itself (which pole won the dimension) and a small H/M/L badge (how much the user actually likes films at that pole, independent of the gap).

### Two separate signals

**1. Gap → dimension signal strength**
The gap between a user's two pole scores determines whether a dimension is a strong, moderate, or weak part of their profile. This drives which letters appear and in what order. Unchanged from current behavior.

| Gap | Tier |
|---|---|
| ≥ 35 | Strong |
| 15–34 | Moderate |
| < 15 | Weak |

**2. Pole score → preference strength for that specific pole**
Each individual pole gets its own badge based on its normalized score (0–100), independent of what the opposite pole scores.

| Pole score | Badge |
|---|---|
| ≥ 65 | **H** |
| 35–64 | **M** |
| < 35 | **L** |

### What this allows

A user can have:
- Patient = **H**, Kinetic = **H**, gap = Low → rates both types highly, barely prefers one over the other. Strong absolute enjoyment of both; weak directional signal.
- Patient = **H**, Kinetic = **L**, gap = High → loves patient films, doesn't connect with kinetic ones. Clean, decisive signal.
- Patient = **M**, Kinetic = **L**, gap = Medium → moderately into patient films; kinetic just doesn't land.

The badge answers "do you actually like films like this?" The gap answers "how decisive is your preference between the two poles?" Numbers are never shown to users.

### Display

Small colored H/M/L badge on or adjacent to each letter. Subtle — not a label, more a status indicator. Color-coded:
- **H** → forest green
- **M** → amber
- **L** → muted/gray

Appears **everywhere letters surface**: taste code page, profile header, friend profiles, onboarding reveal, anywhere in the app a taste letter is shown. This includes other users' profiles — you can see not just their letters but how strongly each pole resonates.

---

## Per-Log Insight Callouts (Profile Movement)

In addition to the prediction vs. outcome insight, the insight card surfaces any profile movement triggered by this log. Two specific triggers:

**1. Tier step change:** If any dimension's gap crossed a tier threshold (Low→Med, Med→High, High→Med, Med→Low) as a result of this log:
*"Your [dimension] signal just moved from moderate to strong."*

**2. Pole shift:** If any dimension's dominant pole flipped (e.g. was reading as Patient, now reads as Kinetic):
*"Something shifted on [dimension] — you're now reading slightly more [pole] than before."*

Both require computing the taste code immediately before and after each log, then diffing. Fast in-memory operation, no extra API calls.

These callouts appear as a distinct section on the insight card below the prediction/outcome section. They are suppressed if nothing changed.

---

## Monthly Report Structure

### Section 1 — Your taste code this month
Current letters with confidence tier context. Any letters that changed from last month are highlighted.

### Section 2 — Step changes
Dimensions that crossed a tier threshold during the month (e.g. Moderate→Strong). Each step change names the films that drove it.

### Section 3 — Pole shifts
Dimensions where the dominant pole changed during the month. Rarer and more notable than step changes.

### Section 4 — Recent watches
Films logged this month.

### Section 5 — Month in summary
A short narrative block below the film list. Covers:
- Total films logged, average star rating this month vs. overall average
- Dominant dimension characteristics of films watched this month (e.g. "you watched a lot of kinetic, plot-driven films this month")
- Genre distribution — which genres showed up most, any notable shifts
- One narrative observation connecting the step changes or pole shifts to the films logged: *"You logged a lot of character-driven films this month — your C signal got stronger."*

Framing is step changes and pole shifts, not continuous deltas. "Your patient signal crossed from medium to high" not "your patient signal went up by 4 points."

---

## Taste Page — Recent Activity Summary

The taste page adds a summary block showing recent viewing activity in dimensional terms. This is separate from the monthly report — it lives on the taste page itself and shows the rolling picture of what the user has been watching.

Content:
- Films logged this week / this month (count)
- Top 2–3 highest-scoring dimension poles across those films — what kind of films they've been watching dimensionally (e.g. "you've been watching a lot of very patient, character-driven films")
- Average star rating for the period
- Brief genre note if a genre is dominant in the period

This gives the taste page a living, current feel rather than just a static profile snapshot.

---

## Genre Page — Structure Changes

The genre page currently shows genre data but lacks the same structural grounding as the taste page (top letters, movement indicators). This section brings it in line.

### Top of genre page — Top 4 genres
Mirrors the taste code structure: shows the user's top 4 genres by logged volume or weighted preference. If a genre has entered or exited the top 4 since last month, it is highlighted — same pattern as taste code letter movement.

### Monthly summary on genre page
The genre page monthly update (currently absent) shows:
- Genre distribution for the month: how many films per genre
- Average star rating per genre (where data permits)
- Any genre that entered or left the top 4 highlighted with the films that drove the movement
- Short summary: *"You watched 12 films this month. 5 were dramas, 3 were thrillers. You rated your comedies highest this month."*

---

## Taste Prose — Regeneration Cadence & Enrichment

### Regeneration cadence

Taste prose does **not** regenerate on every log. It is expensive (LLM call) and doesn't need to be that fresh. Proposed cadence:
- Regenerate when the user views the taste page and their film count has increased by ≥ 5 since last generation (current behavior — keep this)
- Additionally: regenerate on a scheduled basis (e.g. weekly background job) so the prose stays reasonably current without requiring user action
- Never regenerate per log — the taste code diff (step changes, pole shifts) handles the per-log freshness signal instead

### Prose enrichment with dual-signal data

The current prose generation only knows which pole dominates each dimension. With the dual-signal system (gap strength + individual pole scores), the prose prompt gains meaningful nuance that should be surfaced in the narrative.

**On your own dimensions page:**

The prose should articulate not just "you prefer patient films" but the richer picture:
- Both pole scores high, strong gap → *"You connect with slow-burn cinema deeply — but it's not that fast-paced films leave you cold. You enjoy the energy of a kinetic film; you just consistently rate patient ones higher."*
- Dominant pole high, opposite pole low, strong gap → *"Patient pacing isn't just a preference — films that rush tend to actively lose you."*
- Both pole scores high, weak gap → *"You're genuinely comfortable across the pace spectrum — slow burns and propulsive thrillers both land for you, which is relatively unusual."*
- Both pole scores moderate or low → mentioned lightly or not at all — these aren't defining signals

The prose prompt should receive: for each dimension in the top 4–6, the dominant pole, the gap tier (strong/moderate/weak), and both pole score tiers (H/M/L). It uses this to modulate language — not just "you like X" but "you like X and Y, but X consistently wins" vs "you like X and rarely connect with Y."

**On the friend comparison / dimensions view:**

When viewing a shared dimension between two users (clicking into a letter on the friends compatibility page), the comparison prose should leverage both users' dual-signal data to surface genuinely interesting contrasts. Current version only compares which pole each person leans toward. The richer version:

- Both prefer same pole, both have H score on that pole, but one has H and the other L on the opposite → *"You both love character-driven films. The difference: [Friend] can still be pulled in by a propulsive plot — you tend to lose patience with it."*
- Both prefer same pole, similar gap, similar pole scores → *"This one's a genuine shared preference — you both respond to [pole] in nearly the same way."*
- Opposing poles, both high scores on their respective dominant pole → *"You actually both watch a lot of [dimension] films — you just land on opposite sides. You gravitate toward [pole A], they toward [pole B]."*
- Opposing poles, one high and one low on their dominant pole → *"This is a real split. [Friend] actively dislikes [your pole] — it's not just that they lean the other way."*

The friend comparison prose is generated at view time (or cached per pair), informed by both users' full dual-signal profiles. It should read like a knowledgeable observer explaining what the numbers actually mean — not a recitation of the data.

---

## Open Questions

1. **Insight card thumbs up/down:** Optional feedback on the insight. Low friction, high signal. Confirm inclusion in v1 before build.

2. **Minimum log threshold for σ reliability:** Proposed 10 logs before using normalized stats; below that use absolute thresholds with hedged copy. Confirm before build.

3. **Insight card sharing:** Out of scope for v1. Flagged for post-launch — viral potential.

4. **Log editing:** Out of scope for v1. Separate follow-on ticket. Current flow is effectively final-on-submit.

5. **Card 3 label copy review:** Full 24-label table needs readability and resonance review before launch. Jargon risk is real — a confused label will be skipped, not answered.

6. **Prose regeneration schedule:** Weekly background job proposed. Confirm cadence and whether it runs for all users or only active ones (logged in the past 30 days).

7. **Genre top-4 system:** Genre preference signal already exists (weighted score by avg rating × log volume). Top-4 genre display on the genre page needs defining — confirm whether it uses the nuanced AI genres, TMDB simple genres, or both for different views.
