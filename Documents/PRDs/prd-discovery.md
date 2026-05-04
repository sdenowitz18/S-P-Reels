# PRD: Discovery
_Epic 4 | Last updated: 2026-05-05_

Discovery covers how users find what to watch: the scored catalog, the Mood Room (group decision tool), and the recommendations layer.

---

## Feature 1: Scored Catalog (`/films`)

### What's built
- Film grid with match scores (computed from taste code vs. film `dimensions_v2`)
- Two-tier loading: fast initial 60 films → background full index (`/api/films/index`) for instant client-side filtering
- Two-level genre filter: broad category pills (Drama, Horror, Sci-Fi, etc.) → subgenre keyword chips
- Media type filter: All / Films / TV
- Mode: All titles / New releases
- Search: server-side full-text, debounced 280ms
- Match badge (displayed score = stretched 2x − x²/100), colored by tier (green/amber/red)
- Film panel: poster, match score, RT/MC/IMDb, synopsis, "why it matches you" dim tiles, quick rate flow
- "i've seen this ★" → inline star picker → post-save MBTI taste shift reveal
- `hideWatched: true` on all catalog fetches — watched films don't appear
- **On-demand panel enrichment**: when a film from the lean index (positions 61+) is opened, fetches `/api/films/[id]/panel` and patches the selected film state with full dimBreakdown + synopsis (~500ms latency)
- **Quality sort fallback**: when `sort=match` but no taste code exists (< 8 rated films with dims), catalog sorts by `compositeQuality` instead of year — new users see a quality-ranked catalog, not arbitrary year order

### Design decisions
- Genre filter is client-side from the full index (no round-trip) — the whole point of the index endpoint
- Index endpoint selects full `ai_brief` column (Supabase JS client silently returned null for `ai_brief->dimensions_v2` JSON path extraction — couldn't reliably map to typed fields)
- Index endpoint cached 5 min client-side (`Cache-Control: private, max-age=300`); index fetch uses `cache: 'no-store'` to bypass stale browser cache when re-fetching
- Search stays server-side (full-text search can't be done client-side from the index)
- Film count in catalog = unwatched films with `dimensions_v2` (typically 700–800 for an active user with 500+ watched films from ~1,347 total enriched films)

### Open requirements
- [ ] Taste shift direction should be prediction-aware (rated higher than expected → upward movers)
- [ ] "We haven't analyzed this film yet" message + taste shifts coexisting is confusing — needs UX fix
- [ ] Genre filter: persist selected genre across reload (URL param)
- [ ] Poster lazy loading / skeleton states
- [ ] Panel enrichment latency: ~500ms for index films — show a loading shimmer on the dim tiles while fetching

---

## Feature 2: Mood Room (`/mood`)

### What's built
Nothing yet — designed and ready to build.

### Design

**What it is:**
A shared decision space where 2+ people collectively figure out what to watch. Unlike "find together" (simple score for 2 people), the Mood Room is interactive, contextual, and designed for real-time group decisions.

**Who's in the room:**
- You are always included by default (pre-selected, not removable)
- All friends are listed; each can be toggled in/out
- Minimum 1 person (just you = personal recommendations)
- No maximum

**Filters:**
- Content type: Movies | TV | Both (pill toggle)
- Genre: two-level pills (same taxonomy as catalog)
- New releases toggle
- Runtime: Under 90 min (movie-specific; hidden when TV selected)
- Mood tags (future — not in v1)

**Generate button:**
Triggers the room recommendation algorithm. Shows 5 results at a time. "Show 5 more" generates the next batch (excluding already-shown films).

**Room taste algorithm — Consensus Harmony Score:**
For each candidate film:
1. Compute each room member's individual match score (taste code vs. film `dimensions_v2`)
2. Room score = `mean(individual scores) − 0.5 × stdev(individual scores)`
   - Low variance (everyone agrees) → score close to mean
   - High variance (split opinion) → score pulled down
3. Members without a taste code are excluded from calculation (treated as flexible)
4. Films ranked by room score descending

**Dimension-level view (for the film panel):**
- Shared zone: dimensions where all members lean the same direction
- Contested dimensions: where members split ("this is where you differ")
- Films hitting shared poles get a "good fit" indicator per dimension

**Film panel in room context:**
1. Room score (Consensus Harmony Score, prominently displayed)
2. Member breakdown: avatar, individual match score, "most excited" / "biggest stretch" indicators
3. Why it works for the group — dimensions where everyone aligns
4. The tradeoff — dimension with most divergence; whose taste it pushes against
5. Where to watch (JustWatch link)
6. Actions: Add to watchlist, "Suggest to group" (sends rec to all room members)

**Results presentation:**
- 5 films per generation
- Each card: poster, room score, member avatars with individual scores or color-coded agreement
- "Generate 5 more" button appends next batch

**Edge cases:**
- Only 1 person in room → acts like personal catalog (taste-score sort)
- No one has a taste code → fall back to quality sort (compositeQuality)
- All members have very different tastes → low room scores across board; show message acknowledging difficulty and surfacing "best compromises"

### Open requirements
- [ ] Build the Mood Room (Phase A roadmap item — PRD complete, ready to build)
- [ ] Room state persistence (URL params or session) so sharing a room link works
- [ ] "Suggest to group" action: creates a rec for all room members simultaneously
- [ ] Save room as a preset ("Movie Night with [names]")
- [ ] Mood tags v1: define 6–8 moods (cozy, intense, funny, etc.) and map them to dimension ranges

---

## Technical reference

- `app/(app)/films/page.tsx` — catalog page
- `app/(app)/films/film-panel.tsx` — catalog film panel
- `app/(app)/mood/page.tsx` — mood room page (stub)
- `app/api/films/route.ts` — paginated catalog API (search, filter, score)
- `app/api/films/index/route.ts` — full index (all films, scores + genres, cached 5 min)
- `app/api/films/[id]/panel/route.ts` — on-demand full panel data for index films (synopsis, dimBreakdown, matchScore)
- `app/api/mood/recommend/route.ts` — mood room recommendation endpoint (stub)
- `lib/genre-groups.ts` — shared GENRE_GROUPS taxonomy (catalog + watched page)
- `lib/taste/match-score.ts` — computeMatchScore, applyQualityMultiplier, computeCompositeQuality
