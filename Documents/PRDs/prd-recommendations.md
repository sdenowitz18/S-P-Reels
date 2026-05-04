# PRD: Recommendations
_Epic 6 | Last updated: 2026-05-04_

How sp-reels surfaces what to watch next — both through the taste model and through social/collaborative signals. Distinct from Discovery (catalog browsing) in that recommendations are proactive and personalized.

---

## Feature 1: Taste-Based Scoring (foundation)

### What's built
- Match score computation: taste code (taste vector) vs. film `dimensions_v2`
- `computeMatchScore`: dot product of user vector and film dimension vector, normalized 0–100
- `applyQualityMultiplier`: adjusts raw taste score by composite quality (RT/MC/IMDb/TMDB weighted average)
- `computeCompositeQuality`: weighted blend of critic scores
- Display score: stretched formula `2x − x²/100` (inflates mid-range for better UX feel)
- Scores shown on: catalog film cards, film panel, find-together results, compatibility page
- `/api/recommendations/taste/[filmId]/score` — score a specific film for the current user
- `/api/recommendations/taste/[filmId]/match` — full match breakdown by dimension

### Design decisions
- Raw score used for sorting; stretched score used for display only
- Quality multiplier prevents high-taste-match but low-quality films from ranking too high
- Scores suppressed in UI for users with < 8 rated films (not enough signal)

### Open requirements
- [ ] `/recommended` page: curated personalized picks with "because you..." reasoning (Phase D)
- [ ] "Because you both liked X" — surface the specific film anchoring a recommendation
- [ ] Genre-specific recommendations: "because you rate horror highly and the sub-genre matches"
- [ ] "More like this" — from a specific film in your library, find similar films in the catalog
- [ ] Recommendations feed on home page (lightweight surface of top 3–5 picks)

---

## Feature 2: Social Recommendations (friend-to-friend)

### What's built
- Send a film to a friend with a note (see `prd-social.md` — Recommendations feature)
- Received recs inbox with reactions and comments
- Notifications for new recs

### Open requirements
- [ ] Taste-informed sending: when recommending, show how well the film matches the recipient's taste code
- [ ] "Suggest to group" via Mood Room: send a rec to all room members at once

---

## Feature 3: Social Signal Layer

### What's built
- Friend activity on film detail panel: which friends have watched a film, their ratings
- Crossover page shows films both you and a friend rated (with both scores)
- Find-together: consensus scoring for 2 people

### Open requirements
- [ ] Surface films your friends loved that also align with your taste code (not just their raw rating — taste-filtered friend recs)
- [ ] "Your friends are talking about this" — show friend activity on catalog film cards
- [ ] Lightweight friend activity feed (what friends are watching this week)

---

## Feature 4: Collaborative Filtering ("People Like You")

### What's built
Nothing — this requires meaningful user scale to work well.

### Design
As the platform grows, users with similar taste codes will have overlapping rating histories. Collaborative filtering uses this to strengthen recommendations:
- Find users whose taste code is similar to yours (same or adjacent poles on 3+ dimensions)
- Surface films they rated highly that you haven't seen
- Weight by taste code similarity + their confidence (how many films with signal they've rated)
- Present as "people with your taste loved this" alongside the taste-based score

### Open requirements
- [ ] Define taste similarity metric (Euclidean distance on taste vectors, or pole agreement count)
- [ ] Build collaborative filtering endpoint (Phase D roadmap item)
- [ ] Decide threshold for "similar enough" — probably 3+ matching poles with strong signal
- [ ] UI treatment: show as a separate signal on the film panel ("2 people with your taste gave this 5★")
- [ ] Privacy: users must opt into contributing to collaborative signal (default on, opt-out)

---

## Feature 5: Taste Recommendations API

### What's built
- `/api/recommendations/taste/route.ts` — returns taste-scored film list for the current user
- `/api/recommendations/taste/[filmId]/save/route.ts` — save a taste rec to watchlist

### Open requirements
- [ ] Extend to support genre filter, new releases filter
- [ ] Add "because" reasoning to each returned film (which dimension is driving the score)
- [ ] Batch scoring endpoint for efficient catalog ranking

---

## Technical reference

- `lib/taste/match-score.ts` — `computeMatchScore`, `applyQualityMultiplier`, `computeCompositeQuality`
- `app/api/recommendations/taste/route.ts` — taste-based recommendation list
- `app/api/recommendations/taste/[filmId]/score/route.ts` — score a specific film
- `app/api/recommendations/taste/[filmId]/match/route.ts` — full match breakdown
- `app/api/recommendations/taste/[filmId]/save/route.ts` — save to watchlist
- `app/api/recommendations/route.ts` — friend-to-friend recommendations
- `app/api/recommendations/inbox/route.ts` — received recommendations
- `app/(app)/recommended/page.tsx` — recommendations page (stub)
