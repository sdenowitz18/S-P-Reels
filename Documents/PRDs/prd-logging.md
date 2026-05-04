# PRD: Logging
_Epic 2 | Last updated: 2026-05-05_

Logging is how users get films and TV shows into their library and generate taste signal. It covers search, all three watch states, the rating flow, the interview, and live notes during watching.

---

## Feature 1: Film & TV Search (`/add`)

### What's built
- TMDB search with live results (title, year, director, poster)
- Films cached to Supabase `films` table on first search hit
- Results show both movies and TV shows
- "★ quick rate many films →" link alongside the search entry point
- Slug-based routing: `/add/[slug]/stage` routes to the right flow

### Design decisions
- TMDB is the source of truth for search; our DB is a cache
- Slug encodes TMDB ID + title for stable routing

### Open requirements
- [ ] Recently logged / recently searched history
- [ ] "Already in library" indicator on search results

---

## Feature 2: Watch State Selection (`/add/[slug]/stage`)

### What's built
- Three-way choice presented as cards: Now Playing / Rate It / Just Talk About It (interview)
- Session storage used to pass film data through the flow
- Routes to `/add/[slug]/rate`, `/add/[slug]/interview`, or `/add/[slug]/done`

### Open requirements
- [ ] "Save to watchlist" as a fourth option on the stage page
- [ ] Pre-select state if user taps from a specific context (e.g., Now Playing entry point)

---

## Feature 3: Rating Flow (`/add/[slug]/rate`)

### What's built — 5-card post-watch flow

**Card 1 — Stars**
- 1–5 star rating, auto-advances on selection
- Required; cannot skip

**Card 2 — Rewatch**
- Yes / No; if Yes → 0–10 rewatchability slider
- Skippable; stored as `rewatch` + `rewatch_score` on library entry

**Card 3 — Fit Check**
- Did it match your expectations? Four options: Yes / Surprisingly yes / Surprisingly no / No
- Auto-advances; follow-up shows 3–4 tappable dimension labels from the film's highest-scoring poles
- Labels use plain English (e.g., "the pacing — it took its time" not "kinetic_vs_patient")
- Stores `fit_answer` + `fit_dimension` + `fit_pole`

**Card 4 — Comment**
- Free-text comment field; skip or Done advances
- **Visibility: private by default.** A "Make public" button next to the field switches the comment to public. Public comments appear on the friend activity feed; private comments are only visible to the user. The default protects casual commenters — public is an intentional opt-in.

**Card 5 — Insight Card**
- Match score + predicted star rating at time of logging
- Actual outcome + delta interpretation (above/below expectation)
- Dimensional explanation when |Δz| ≥ 0.5
- MBTI-style shift tiles showing taste code before → after
- Suppressed: match score section for users with < 8 logs; shift tiles if nothing changed
- CTA: "See your full taste profile →"
- **Friend match scores section:** shows all friends + their match score for this film (the % they'd see in the catalog if they searched for it). Displayed as friend avatar + name + score badge. Tapping a friend's name sends them a quick recommendation for this film. Suppressed if user has no friends or film has no `dimensions_v2`.

### Design decisions
- Taste diff computed per-log: `taste_code_before` and `taste_code_after` stored on library entry
- `predicted_stars` = μ + predicted_z × σ at time of logging
- `delta_z` = (actual − predicted) / σ — used to determine whether the gap is noteworthy
- Back navigation pre-fills previous answer
- Card transitions: slide, under 200ms

### Open requirements
- [ ] Card 3 label copy review (jargon risk — need real users to validate plain-English labels)
- [ ] Insight card thumbs up/down (confirm/deny resonance of the insight)
- [ ] Insight card sharing (post-launch)
- [ ] Log editing (rate/comment after the fact from the watched list)
- [ ] Build comment visibility toggle (private default + "Make public" button) — store `comment_public: boolean` on library entry
- [ ] Build friend match scores section on insight card — fetch friends' taste codes + compute match score per friend for the film; quick-rec tap action

---

## Feature 4: Interview Flow (`/add/[slug]/interview`)

### What's built
- AI-powered conversational interview using GPT-4o
- 3–5 questions per session, conversational tone
- Multiple interviewer personas: warm, blunt, playful, cinephile
- Multiple depth options: short, medium, long
- Topic paths: how-it-felt, what-worked, scenes-and-moments, key-themes, the-craft, performances, surprise-me
- Generates a reflection paragraph stored on the library entry
- Stored in `taste_interview_sessions` table

### Design decisions
- Interview is qualitative only — it does not directly modify the taste vector
- Reflection is narrative prose, not structured data
- GPT-4o used for question generation and response synthesis

### Open requirements
- [ ] Qualitative signals extracted from interview → feed into taste profile (Phase C roadmap item)
- [ ] Interview improvements: start with qualitative discussion before numerical assessment
- [ ] Time-based interview limits (3 min / 5 min / open)
- [ ] Interview output shown on film panel (snippet of reflection visible from watched list)
- [ ] Re-interview: revisit a film's interview after more time has passed

---

## Feature 5: Now Playing (`/now-playing`)

### What's built
- Mark a film/show as currently watching
- Library entry with `list_kind = 'now_playing'`
- Now Playing rail visible on the home page and movies page
- Inline comments during watching (stored as `now_playing_notes`)
- Move to watched / remove actions from film detail panel

### Open requirements
- [ ] Episode-level tracking for TV shows (which episode you're on)
- [ ] Episode comments (comment at a specific point rather than freeform)
- [ ] Richer progress UI: episode counter, estimated completion
- [ ] "What are people saying about this?" — surface friend activity and public discourse around the show (Phase B roadmap item)
- [ ] Smart completion detection: prompt to rate when a series ends

---

## Feature 6: Watched List (`/movies`)

### What's built
- Grid of all watched films/TV with posters and star ratings
- Filters: kind (All / Movies / TV), sort (added / rating / year / title)
- Two-level genre filter (broad category pills → subgenre chips)
- Rewatchable filter (shows only entries with `rewatch = true`, sorted by score)
- "★ quick rate" button in header
- Film detail panel (click any card): rating, reflection snippet, friend context, move/remove actions

### Open requirements
- [ ] Pagination / infinite scroll (currently loads full list)
- [ ] "Rate this" nudge for now-playing entries that ended without a rating
- [ ] Watch history timeline view (calendar / chronological strip)

---

## Feature 7: Watchlist (`/watch-list`)

### What's built
- Save films to watch later
- List view with title, poster, director, year
- Remove from watchlist action
- "Find something to watch" CTA linking to catalog

### Open requirements
- [ ] Sort by: added date, match score, genre
- [ ] "Suggest to watch together" — send a watchlist film as a group suggestion (connects to Mood Room)
- [ ] Bulk actions (remove multiple, move to watched)

---

## Technical reference

- `app/(app)/add/page.tsx` — search page
- `app/(app)/add/[slug]/stage/page.tsx` — watch state selection
- `app/(app)/add/[slug]/rate/page.tsx` — 5-card rating flow
- `app/(app)/add/[slug]/interview/page.tsx` — AI interview
- `app/(app)/add/[slug]/done/page.tsx` — now-playing confirmation
- `app/(app)/movies/page.tsx` — watched list
- `app/(app)/now-playing/page.tsx` — now playing rail
- `app/(app)/watch-list/page.tsx` — watchlist
- `app/api/library/route.ts` — create/update library entries
- `app/api/library/[entryId]/route.ts` — update specific entry
- `app/api/films/search/route.ts` — TMDB search proxy
- `app/api/interviews/` — interview session management
