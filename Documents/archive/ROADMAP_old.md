# SP Reels — Product Roadmap
*Living document. Last updated: May 3, 2026.*

When the conversation references "log it to the roadmap," update this file: mark completed items, add new decisions, note anything removed or deferred, and flag open questions that emerged.

Reference PRD: `Documents/PRDs/POST_WATCH_FLOW_PRD.md`

---

## Phase summary

| Phase | What ships | Status | Dependency |
|---|---|---|---|
| 1 — Foundation | Match score formula, μ/σ stats, H/M/L badges, skip options, copy fix | ✅ Complete | — |
| 2 — Log flow | 5-card log, per-log taste code diff, insight card | 🔜 Up next | Phase 1 |
| 3 — Match score surfaces | Match score on film pages + recommendations | Not started | Phase 1 + 2 |
| 4 — Quick Rate | Film pool, session UI, delta screen, entry points | Not started | Phase 1 (parallel to 2) |
| 5 — Profile depth | Taste summary, genre page, monthly report, prose enrichment | Not started | Phase 1 |

---

## Phase 1 — Foundation ✅ Complete

All five items shipped.

| Item | Status | Notes |
|---|---|---|
| 1.1 Match score formula correction | ✅ Done | Pole score interpolation, replaces gap-weighted formula |
| 1.2 Normalized rating stats (μ/σ) | ✅ Done | Per-user mean + σ, floor of 0.6, cached in taste route |
| 1.3 H/M/L pole badge system | ✅ Done | See decisions below |
| 1.4 Haven't seen + Skip for now | ✅ Done | Side-by-side in onboarding rate page |
| 1.5 Home page copy fix | ✅ Done | "log a film →" |

**Badge system — decisions made during build:**
- Badges appear on all letter surfaces: taste code page, profile header, friend profiles, friend taste-code page, compatibility page tiles, onboarding reveal
- **Exception: the blend header on the friend page (`/friends/[id]`)** — the small 36×36 tiles are too cramped; badges removed. Compat border colors (green = shared, red = opposing, paper-edge = asymmetric) remain.
- In dislikes mode, badge uses `oppositeScore` not `poleScore` — reflects absolute strength of the pole being displayed
- On selected (dark background) tiles in the compatibility view, badge inverts: white background, dark text
- Gap signal tier (Strong / Moderate / Weak) remains available in the dimensions page prose but is not surfaced as a raw number anywhere

**Dislikes mode lean prefix — bug fixed during build:**
When a tile is in dislikes mode and the user leans *away* from the displayed pole, the header now correctly says "AVOIDS" / "PULLS AWAY FROM" / "SLIGHTLY AVOIDS" rather than "LEANS HEAVILY" etc.

**Dimensions page — addition during build:**
Each DimRow now shows the dimension name (e.g. "Kinetic vs. Patient") prominently above the prose in the middle column. Not in the original spec; added for clarity.

---

## Phase 2 — Post-Watch Log Flow 🔜 Up next
*Estimate: 3–4 weeks*

The centerpiece feature. Replaces the current single-screen add form with a 5-card paginated flow ending in an insight card.

See **`Documents/PRDs/POST_WATCH_FLOW_PRD.md`** for full requirements.

### 2.1 Log signal record (DB)
New columns on `library_entries` (or a `log_signals` table) to store per-log signal data:

| Field | Type | Notes |
|---|---|---|
| `rewatch` | boolean | true / false / null (skipped) |
| `rewatch_score` | int | 0–10, null if rewatch is false or skipped |
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

### 2.2 Per-log taste code diff
Extend the log/rate endpoint. On every starred log: compute before state → save rating → compute after state → diff → store → return diff for insight card.

### 2.3 Five-card log flow
Replaces `app/(app)/add/[slug]/rate/page.tsx` and associated pages.

- **Card 1 — Rating:** Stars only. Auto-advance. Required.
- **Card 2 — Rewatch:** Yes / No. If Yes: 0–10 slider for how rewatchable. If No: advance immediately. Skippable. Watched page gets a "Rewatchable" filter sorted by score descending.
- **Card 3 — Fit Check:** Yes / Surprisingly yes / Surprisingly no / No. Auto-advance. Skippable. Follow-up: 3–4 tappable dimension labels from film's highest poles.
- **Card 4 — Comment:** Free text. Skip or Done advances.
- **Card 5 — Insight Card:** Delivery card. See 2.4.

Back navigation pre-fills previous answer. Card transitions: slide, under 200ms. Flow state preserved if app is backgrounded.

### 2.4 Insight card (Card 5)
Rule-based. No LLM call.

1. Match score + predicted star rating
2. Actual outcome + delta interpretation
3. Dimensional explanation (when |Δz| ≥ 0.5)
4. Profile movement (tier step changes, pole shifts — only when something changed)

Suppressed: match score section for users with < 8 logs. Profile movement if nothing changed.

CTA: "See your full taste profile →"

---

## Phase 3 — Match Score Surfaces
*Estimate: 1 week. Ships after Phase 2.*

### 3.1 Match score on film detail pages
Shown prominently alongside the film title. Suppressed for users with < 8 logged films.

### 3.2 Match score on recommendation surfaces
Primary signal for why a film is surfaced. Shown on `/recommended` and mood room.

---

## Phase 4 — Quick Rate
*Estimate: 2–3 weeks. Can run parallel to Phase 2.*

### 4.1 Film pool logic
Films not in the user's library. Ordered by coverage value: prioritize films that fill low-confidence dimensions first.

### 4.2 Quick Rate session UI
Adapts the onboarding calibration card flow into a shared `<FilmRatingSession>` component. Parameterized by pool source, termination condition, and completion handler.

### 4.3 Session-end delta screen
Lighter version of onboarding reveal: films rated, before/after code, tier changes, pole shifts, one narrative line.

### 4.4 Entry points
- Watched page: "Log Multiple Films" button
- Profile page: "Build Taste Profile" nudge (shown when one or more top dimensions have weak signal)
- Home page: no fork. Log card goes direct to single-film logging.

---

## Phase 5 — Profile & Reporting Depth
*Estimate: 3–4 weeks. Can start after Phase 1.*

### 5.1 Taste page recent activity summary
Rolling block: films logged this week/month, top 2–3 dimension poles of recent watches, avg star rating, genre note.

### 5.2 Genre page restructure
Top 4 genres mirroring taste code letter structure. Movement highlighting if a genre entered/left the top 4 since last month. Monthly summary block.

**Decided:** TMDB simple genres used for top-4 display. AI detailed genres used in taste prose and mood recommendations but not for this surface.

### 5.3 Monthly report restructure
1. Taste code this month (letters + badges)
2. Step changes — dimensions that crossed a tier, with films that drove each
3. Pole shifts — dominant pole changes
4. Recent watches
5. Month in summary — narrative block

### 5.4 Prose enrichment with dual-signal data
Update prose prompt to receive gap tier + both pole score tiers per dimension. Enables nuanced language ("you connect with both ends — patient just consistently wins" vs "kinetic actively loses you").

Same enrichment applied to friend comparison prose on the compatibility page.

**Decided:** Prose regeneration runs weekly for active users (logged in the past 30 days). Not per-log.

---

## Standing decisions

1. **Log flow fork:** No fork on home page. Log card → direct single-film logging. Quick Rate lives on Watched page and Profile page only.
2. **Genre top-4:** TMDB simple genres for display. AI genres for prose and mood.
3. **Prose regeneration:** Weekly background job, active users only (logged in last 30 days).
4. **Quick Rate film pool:** Full catalog minus user's existing library, ordered by coverage-optimization.
5. **Insight card thumbs up/down:** Included in v1 — confirm before build.
6. **Blend header badges:** Removed. Border colors retained.

---

## Deferred / out of scope

- Insight card sharing (post-launch, flagged for viral potential)
- Log editing (separate follow-on ticket)
- Card 3 label copy review (needed before launch — jargon risk)
- TV/Film split implementation
- Mood Room integration improvements
- Vercel deployment and other production polish
