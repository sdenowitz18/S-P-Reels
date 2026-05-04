# sp-reels — Roadmap
_Last updated: 2026-05-04_

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

### Phase D — Recommendations & Collaborative Filtering
- `/recommended` page: personalized picks with "because you..." reasoning
- "Because you both liked X" — surface anchoring film
- Social signal layer: films your friends loved that align with your taste
- "People like you" collaborative filtering — strengthen scores using cross-user patterns
- Genre-specific recs: "because you rate horror highly and the sub-genre matches"
- "More like this" from a specific film in your library

### Phase E — Enrichment at Scale
- Pre-fill script: 10,000+ diverse films with `ai_brief` (indie, international, arthouse)
- TV show enrichment: same `dimensions_v2` pipeline for TV
- Letterboxd CSV import

### Phase F — Mobile + Platform
- Mobile app (React Native or progressive web app)
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
