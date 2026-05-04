# PRD: Onboarding
_Epic 5 | Last updated: 2026-05-05_

The first-run experience. Must result in a taste profile before the user sees the main app. Two paths: cold start (rate a curated film set) and Letterboxd import.

---

## Feature 1: Entry & Path Selection (`/onboarding`)

### What's built
- Server-side state check on load:
  - In-progress session → resume (routes to rate or interview depending on progress)
  - Has library entries → returning user, redirect to `/home`
  - No entries, no session → first-time, show path selection
- Welcome screen with two options: "Rate some films to get started" vs. "Import from Letterboxd"
- Session creation on path selection

### Design decisions
- Gate is server-side — no flash of wrong content
- Returning users bypass onboarding entirely
- In-progress sessions always resume (prevents duplicate sessions)

### Open requirements
- [ ] Proper first-run gate: users who skip onboarding see a nudge to complete it before accessing main app
- [ ] "Haven't seen it / Skip for now" option on every calibration film card (currently only stars)
- [ ] Progress indicator during calibration (e.g., "4 of 12 films")

---

## Feature 2: Cold Start — Calibration Rating (`/onboarding/rate/[id]`)

### What's built
- Curated calibration film set (`lib/taste/calibration-films.ts`) — films selected for extreme dimension scores
- One film per screen: poster, title, director, year, star picker
- Rating saved per film; session progresses through the set
- Minimum ratings threshold before allowing completion
- After rating: routes to interview for qualitative signal

### Design decisions
- Calibration films must be **dimensional extremes** — they need strong scores in specific dimensions to generate useful signal from even a single rating. This is different from Quick Rate, which accepts any film.
- Each calibration film covers a different dimension (spread across all 12)
- Films chosen for cultural recognizability (users are likely to have opinions)

### Open requirements
- [ ] TV shows in calibration set — currently movies only; add 30–50% TV shows with strong `dimensions_v2` scores
- [ ] "Haven't seen it" path: skip without rating, don't count toward threshold
- [ ] Dynamic calibration: if a user has seen few films, lower the threshold; if they've seen many, raise it
- [ ] Show which dimension each film covers (educational, helps engagement)

---

## Feature 3: Cold Start — Setup (`/onboarding/setup/[id]`)

### What's built
- User profile setup (name, preferences) before calibration begins

### Open requirements
- [ ] Reduce friction: defer non-essential setup to post-onboarding

---

## Feature 4: Interview during Onboarding (`/onboarding/interview/[id]`)

### What's built
- AI interview after calibration rating — same engine as post-watch interview
- Generates initial qualitative signal about taste
- Stores contradictions found during session (used to generate interview questions)
- Routes to reveal on completion

### Open requirements
- [ ] Make qualitative discussion first (before numerical ratings), not after
- [ ] Shorter interview during onboarding (3-question limit — don't overwhelm new users)
- [ ] **Bug**: Occasional film title / poster mismatch in contradiction pairs — a film appears with the correct title but the wrong poster image (or vice versa). Root cause: data issue in the `films` table where `poster_path` for a specific `film_id` points to the wrong TMDB image. Fix: audit poster_path integrity for calibration films and contradiction candidates; add a poster URL validation step to the enrichment pipeline.

---

## Feature 5: Reveal (`/onboarding/reveal/[id]`)

### What's built
- Post-onboarding taste code reveal: animated letter tiles locking in
- H/M/L badges shown on each letter
- Brief explanation of what the taste code means
- CTA: enter the app

### Open requirements
- [ ] Show sample films that match the new taste code on the reveal screen
- [ ] Explain confidence level ("you've rated 8 films — rate more to sharpen your code")
- [ ] Celebrate the moment more — this is the payoff of onboarding

---

## Feature 6: Letterboxd Import (`/import`)

### What's built
- CSV upload from Letterboxd export
- Parses ratings, film titles, years
- Matches to TMDB entries
- Bulk-creates library entries from import
- Taste preview: shows what your code will be before confirming
- `/api/import/letterboxd/parse` — parse CSV
- `/api/import/letterboxd` — commit import
- `/api/import/taste-preview` — preview taste before saving

### Design decisions
- Import is treated as a path into onboarding, not a standalone feature
- Unmatched films (can't find in TMDB) are silently skipped

### Open requirements
- [ ] Show unmatched films and let user manually match or skip
- [ ] Import from other sources (IMDb lists, Trakt)
- [ ] Merge import with existing library (handle duplicates gracefully)
- [ ] Post-import brief generation: run `generate-briefs` for imported films that lack `ai_brief`

---

## Technical reference

- `app/(app)/onboarding/page.tsx` — entry + path selection (server component)
- `app/(app)/onboarding/onboarding-client.tsx` — client welcome screen
- `app/(app)/onboarding/setup/[id]/page.tsx` — profile setup
- `app/(app)/onboarding/rate/[id]/page.tsx` — calibration rating
- `app/(app)/onboarding/interview/[id]/page.tsx` — qualitative interview
- `app/(app)/onboarding/reveal/[id]/page.tsx` — taste code reveal
- `app/(app)/import/page.tsx` — Letterboxd import UI
- `app/api/onboarding/session/route.ts` — create session
- `app/api/onboarding/session/[id]/route.ts` — session state
- `app/api/onboarding/session/[id]/rate-film/route.ts` — save calibration rating
- `app/api/onboarding/session/[id]/reveal/route.ts` — compute reveal data
- `app/api/onboarding/session/[id]/complete/route.ts` — finalize session
- `app/api/onboarding/calibration-films/route.ts` — fetch calibration film set
- `lib/taste/calibration-films.ts` — curated calibration film list
