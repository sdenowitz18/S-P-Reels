# sp-reels — Roadmap
_Last updated: 2026-05-09_

---

## Current phase: Refinement & Depth (May 2026)

The core product is built. This phase is about deepening existing experiences, filling gaps in the taste model, and shipping the Mood Room.

### Recently shipped
- ✅ Two-level genre filter (catalog + watched page)
- ✅ Quick Rate flow (one-film-at-a-time, taste profile update reveal)
- ✅ Catalog two-tier loading (fast 60-film initial load + background full index)
- ✅ Film panel: "i've seen this ★" → inline star picker → MBTI shift reveal
- ✅ Rewatchable filter on watched list
- ✅ Rate page: 5-card flow (stars → rewatch → fit check → comment → insight card)
- ✅ Rate page: multi-select fit dimensions, MBTI-style shift tiles
- ✅ Taste code: negativeDescription, tier-based prose tone, sample film ordering
- ✅ Compatibility: ghost tile, tone-aware prose, dual dim selection
- ✅ Taste vector: deviation-weighted algorithm (stars − userAvg)
- ✅ H/M/L pole badge system across all letter surfaces
- ✅ Catalog match scores: fixed index route (JSON path bug) + on-demand panel enrichment for index films
- ✅ Catalog quality sort fallback: no taste code → sort by compositeQuality, not year

### Up next (this week)
- [ ] **Mood Room** — group film selection tool (PRD written, ready to build)
- [ ] Onboarding: TV shows in calibration film set
- [ ] Interview: qualitative signal discussion first

---

## Phase sequence

### Phase A — Mood Room + Dimension Enrichment
- Mood Room v1 (group taste matching, filter + generate flow) — see `prd-discovery.md`
- Dimension/pole refresh: audit whether current 12 dimensions and poles accurately capture taste
- Re-enrich existing films and TV shows with updated `dimensions_v2` schema if poles change
- Taste shifts: prediction-aware direction (rated higher than expected → upward movers)

### Phase B — Now Playing + TV Experience
- Richer in-progress TV watching: episode-level comments, progress tracking
- "Now Playing" rail surfacing what's in progress
- TV-aware compatibility and find-together
- `media_type` column, prefixed IDs (`movie-` / `tv-`) at the data model level

### Phase C — Qualitative Signals
- Interview improvements: qualitative discussion first, then numerical
- Qualitative signals feeding into taste profile (not just the vector — the prose and code)
- How qualitative findings surface throughout the app (compatibility, film panel, profile)
- Time-based interview limits (3 min / 5 min / open)
- Topic paths (scenes, craft, performances, themes)

### Phase D — Social Layer Sprint
_All items below are connected by one thread: making friends feel present throughout the app rather than tucked away._

#### Friend Lens (watched page)
- Mode toggle button on the far right of the watched list header — visually distinct, styled as a "mode" not a filter. Tooltip on hover: "View your watched list from a friend's perspective."
- Clicking opens a friend picker dropdown; selecting a friend overlays their match % on every poster as a colored badge
- Overlay also shows: whether the friend has seen it + their star rating if they have. Stars in Lens mode are white/high-contrast for visibility on poster art
- Hover any film in Lens mode → "Recommend" surfaces as the primary action without leaving the page
- Recommendation notification copy: *"recommended via Friend Lens"* (not generic) so the recipient knows where to find the feature
- When a user taps through from that notification, the Lens button pulses/flashes briefly to orient them

#### Recommendations inbox — catalog tab
- Catalog gains a third tab: **All Titles / New Releases / Recommended**
- Recommended tab shows all films friends have sent you, with who sent it (multiple senders shown if overlapping), and any note they included
- In the Mood Room: a small "Recommended by friends" filter surfaces relevant recs in that context too

#### Activity feed improvements
- Click any film in the activity feed → opens the film side panel with your match % for that film
- Like and comment on a friend's activity item
- Notifications for likes/comments on your activity
- Color coding: each user gets a persistent color (like the existing red/blue for you vs. Paola). Their color applies to their activity rows, their "you/them" labels, and anywhere their name appears in the feed
- Row height: revisit compactness — currently only ~1.5 rows visible at a time; consider tighter rows so more activity is scannable at once

#### Friends — home page prominence
- Friends section on home page, not buried
- "Add Friend" button — prominent but not oversized, near the top of the friends section
- Filter strip below it: **All** + one chip per friend — clicking a friend filters to their recent activity
- Tapping a friend's name/chip takes you to their profile/activity

#### Recommendations & Collaborative Filtering (original Phase D)
- `/recommended` page or equivalent: personalized picks with "because you..." reasoning
- "Because you both liked X" — surface anchoring film
- Social signal layer: films your friends loved that align with your taste
- "People like you" collaborative filtering — strengthen scores using cross-user patterns
- Genre-specific recs: "because you rate horror highly and the sub-genre matches"
- "More like this" from a specific film in your library

### Phase E — Enrichment at Scale
- Pre-fill script: 10,000+ diverse films with `ai_brief` (indie, international, arthouse)
- TV show enrichment: same `dimensions_v2` pipeline for TV
- Letterboxd CSV import

### Phase F — Native App
Native iOS app built in Expo (React Native) — separate repo, same Supabase backend. See `prd-native-app.md` for full scope.

**Phase F1 — Scaffolding + Auth**: Expo project, navigation shell, Supabase auth with email verification, bottom tabs
**Phase F2 — Core log loop**: Search → Stage → Rate → Interview → Done → post-log share suggestion
**Phase F3 — Catalog + Watchlist**: Film grid, match scores, film detail sheet, watchlist
**Phase F4 — Home feed + Social**: Friend activity feed, post-log share suggestion with match %
**Phase F5 — Onboarding + Quick Rate**: Full onboarding, Quick Rate, taste code reveal
**Phase F6 — Notifications**: Push infrastructure, notification types, user preferences
**Phase F7 — Polish + TestFlight**: App icon, haptics, empty states, App Store submission

**Prerequisites before starting**:
- Apple Developer Program enrollment ($99/yr, individual account)
- Supabase email verification enabled
- App name finalized

### Phase G — Platform (Web)
- Vercel deployment
- Streaming availability (JustWatch deep links)
- Loading skeletons, error boundaries, custom email templates
- Calendar/timeline view of watch history

### Phase G — sp-books (Future)
- Fork the framework for books
- Book-appropriate dimension taxonomy
- Open Library / Goodreads API integration
- Book enrichment pipeline (equivalent to film `ai_brief`)

---

## Ongoing: Skills Development

Skills are reusable workflows Claude can execute on command. As the product matures, these get more powerful and save time every session.

### Skills we have
- `roadmap-review` — orient before building; assess priority against north star
- `session-sync` — update docs at end of session (invoke with "update the docs")
- `film-research` — domain expertise on taste psychology, film theory, industry
- `competitive-analysis` — research how competitors handle a specific feature
- `film-enrichment` — generate `ai_brief` for films in bulk

### Skills to build (backlog)
- [ ] **Dimension audit** — research whether current 12 dimensions are the right axes; compare against academic frameworks and competitor taxonomies; recommend additions, splits, or renames
- [ ] **PRD drafting** — given a verbal description of a new feature, produce a full PRD draft (what to build, design decisions, open requirements, technical reference)
- [ ] **UX review** — given a page or flow, evaluate it against sp-reels principles (taste-first, progressive depth, honest over flattering); surface inconsistencies
- [ ] **Data analysis** — query Supabase for usage patterns (what % of users have a taste code, avg films rated, genre distribution) and summarize findings
- [ ] **Release notes** — given the session's git diff or summary, produce user-facing release notes

---

## Locked design decisions

| Decision | Choice |
|---|---|
| Taste vector algorithm | Deviation-weighted: `stars − userAvg` |
| TV/Film data model | Prefixed IDs (`movie-123`, `tv-456`), single combined taste vector |
| Dimension count | 12 dimensions — not expanding to 50 background dims |
| Score display | Stretched display score (2x − x²/100) for UX; raw score for sorting |
| Social model | Taste-first, no feed/follower counts |
| Prose regeneration | Weekly background job, active users only |
| Genre display | TMDB simple genres for top-4 display; AI genres for prose and mood |

---

## Known technical debt

- Missing `ai_brief.dimensions_v2` on most films → limits taste code quality for new users
- OpenAI credits needed to run `generate-briefs.ts` at scale
- `supabase db push` needed for migration `0008_taste_recommendations.sql`
- `app/mockup/` directory — delete when convenient
- TV shows underrepresented in Quick Rate film pool
