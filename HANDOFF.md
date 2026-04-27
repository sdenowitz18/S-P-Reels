# S&P Reels — Handoff (2026-04-27)

## Where we are

The app is feature-complete through **Phase 2** (Solo Foundation + Shared Layer). It runs locally and is committed to GitHub at https://github.com/sdenowitz18/S-P-Reels.git.

## What's built and working

### Core flows
- **Auth** — sign up, sign in, email invite for new users, PKCE callback
- **Film search** — TMDB search with poster, year, director; films cached to Supabase `films` table
- **Logging flows** — three distinct paths:
  - **Now Playing** — mark as currently watching
  - **Watched** — rate (1–5 stars) → optional AI interview (GPT-4o) → reflection summary
  - **Watchlist** — save for later
- **AI Interview** — 3 questions, conversational, generates a reflection paragraph stored on the entry
- **Mood Room** — GPT-4o picks films from your library based on a vibe prompt

### Social layer
- **Friends** — send invite by email, accept/decline, friend profile pages
- **Recommendations** — send a film to a friend with a note; received recs appear in the Recommended inbox
- **Blend** — crossover page showing films both you and a friend have watched
- **Film detail panel** — side panel on watched/now-playing/watchlist cards showing: your rating, inline recommend to friends, which friends have watched it, and context actions (move / remove)
- **Notifications** — unread badge on Friends nav tab; auto-marked read when you open the inbox

### Recommend-to-friends step
- Woven into all three logging done-screens (watched, now-playing, watchlist save)
- Also accessible from the film detail panel on any list page

### Infrastructure
- **Supabase** — auth + DB (RLS enabled)
- **Migrations** — `supabase/migrations/` has 4 migrations (initial schema → friends → recommendations + notifications)
- **TMDB** — film search + poster images (configured in `next.config.ts`)
- **Dev server** — `cd /Users/stevendenowitz/Documents/Transcend/AI/Vibecode/sp-reels && npm run dev`

## Known issues / not yet tested
- End-to-end recommendation flow (Steven → Paola) hasn't been smoke-tested since the restoration
- `app/auth/callback/route 2.ts` is a duplicate file (space in name) — should be deleted
- Groups page exists as a route but is a stub

## What to do first next session

1. **Smoke test** — sign in as both Steven and Paola, send a recommendation, verify it shows in Paola's inbox with notification badge
2. **Delete duplicate** — `app/auth/callback/route 2.ts` (has a space, is dead code)
3. **iCloud safety** — move project out of iCloud Drive OR disable Optimize Mac Storage in System Settings → Apple ID → iCloud Drive → Options
4. Git commit frequently — `git add -A && git commit -m "..." && git push` after any working session

---

## Phases of development

### Phase 1 — Solo Foundation ✅ DONE
Auth, TMDB search, three watch states, AI interview, reflection summary, taste tags, mood room.

### Phase 2 — Shared Layer ✅ DONE
Friends system, recommendations inbox, film detail panel with friend context, crossover/blend page, notification badge.

### Phase 3 — Taste Profile & Discovery (NEXT)
- **Couple's taste profile** — combined page for Steven + Paola showing shared taste tags, genre overlap, disagreement heat map
- **Taste tags UI** — surface the tags generated during interviews on the profile page; make them browsable
- **"Because you both liked X"** — recommendation logic: when a new film is added that matches shared tags, surface it to both users
- **Discovery feed** — home page evolution: instead of just recent entries, show a curated mix of "you might like", "Paola recently watched", "trending in your taste"
- **Friend profile enrichment** — show taste tags + genre breakdown on `friends/[id]/profile`

### Phase 4 — Polish & Reliability
- **Vercel deployment** — production URL, environment variables set, TMDB image domains confirmed
- **Email templates** — custom invite + notification emails (currently using Supabase defaults)
- **Pagination** — movies/watched list will get long; add infinite scroll or pagination
- **Loading states** — several pages have no skeleton/loader; add consistent loading UI
- **Error boundaries** — catch fetch failures gracefully instead of silently

### Phase 5 — Stretch
- **Letterboxd import** — parse CSV export and bulk-import watched history
- **Voice interview** — Whisper API for spoken answers instead of typed
- **Calendar view** — "what were you watching in March?" timeline
- **Apple TV / streaming availability** — JustWatch API or similar to show where to watch

---

## Key file locations

| Thing | Path |
|---|---|
| App pages | `app/(app)/` |
| API routes | `app/api/` |
| Shared components | `components/` |
| Design tokens (CSS vars) | `styles/tokens.css` |
| Supabase helpers | `lib/supabase/` |
| AI prompts | `lib/prompts/` |
| DB migrations | `supabase/migrations/` |
| Design source of truth | `/Users/stevendenowitz/Documents/Transcend/AI/Vibecode/S&P Reels v2/` |
| GitHub | https://github.com/sdenowitz18/S-P-Reels |
