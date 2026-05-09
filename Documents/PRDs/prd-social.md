# PRD: Social Layer
_Epic 3 | Last updated: 2026-05-05_

How taste becomes relational. Friends, compatibility analysis, the blend page (shared crossovers + find-together), and direct recommendations.

---

## Feature 1: Friends (`/friends`)

### What's built
- Send friend invite by email (generates invite link for new users, connects directly for existing)
- Accept / decline incoming requests
- Friends list with avatars, names, notification badge for pending requests
- Friend search by name or email
- Unread notification badge on Friends nav tab, auto-cleared on open

### Design decisions
- Invites by email only (no username search for cold discovery) — keeps it intentional
- New users invited via friend get routed through `/invite` → auth → onboarding

### Open requirements
- [ ] Remove friend action
- [ ] Friend activity feed (lightweight — what your friends are watching, not a full social feed)
- [ ] Match score on unseen activity items: when a friend's activity item is a film you haven't watched, show your projected match score alongside their rating — turns the feed into a passive discovery surface

---

## Feature 2: Friend Profile (`/friends/[id]`)

### What's built
- Combined view of the friendship: activity thread, crossover films, friend's watched/watching/watchlist
- Activity thread: interleaved activity from both users (watches, recs, watchlist adds) with timestamps
- Activity filter: Both / Me / Them
- Crossover films: films you've both watched, with both star ratings shown
- Crossover filter: loved (both ≥4★), hated (both ≤2★), agreed, disagreed
- Film detail panel on crossover cards: your rating, their rating, recommend, move actions
- Friend's watched/watching/want tabs (their library, your permissions)
- Genre affinity scores: top genres for each person

### Design decision: deviation-weighted crossover thresholds (open requirement)
The current "loved / hated" thresholds (≥4★ / ≤2★) use absolute stars. This doesn't account for the fact that different users have different rating distributions — a 4★ from a harsh rater means something different than a 4★ from someone who gives 5s freely.

**Target thresholds:**
- **Both loved**: each person's rating ≥ 1 standard deviation above their own mean (i.e., `stars ≥ μ + σ` for each person separately)
- **Both hated**: each person's rating ≤ 1 standard deviation below their own mean (`stars ≤ μ − σ`)
- **Agreed**: star ratings are within 0.5★ of each other (exact or near-match)
- **Disagreed**: ratings differ by > 1.5★ between the two people

We already compute μ and σ per user (see `computeRatingStats` in `lib/taste/match-score.ts`). This just needs to be surfaced at the crossover query level.

### Open requirements
- [ ] Shared watchlist (films you've both saved to watch)
- [ ] "You should watch this" — lightweight nudge from friend's watchlist
- [ ] Implement deviation-weighted crossover thresholds (see design decision above) — requires fetching ratingStats for both users and applying per-user thresholds at filter time
- [ ] Friend's full watched list on their profile: all films they've watched, sortable by your projected match score — lets you browse their taste and surface unwatched films that align with yours

---

## Feature 3: Compatibility (`/friends/[id]/compatibility`)

### What's built
- Full 12-dimension compatibility breakdown (all dimensions, not just top 4)
- Per-dimension: both taste code letters + strength badges, shared/opposing/asymmetric classification
- Shared zone: dimensions where you agree (same pole or similar strength)
- Opposing zone: dimensions where you diverge (opposite poles)
- Asymmetric: one person has strong signal, the other weak
- Ghost tile: shown when a friend hasn't rated enough films for signal on a dimension
- Compatibility score: composite harmony metric (mean alignment − variance penalty)
- Compatibility prose: tone-aware narrative description of the relationship ("you're kinesthetically opposed but emotionally aligned")
- Dual dimension selection: pick two specific dims to see deep comparison

### Design decisions
- Border colors encode relationship type: green = shared, red = opposing, paper-edge = asymmetric
- Blend header tiles: no H/M/L badge (36×36 too small); border colors retained
- Prose uses `negativeDescription` for opposing dimensions (what each person doesn't like)

### Open requirements
- [ ] "What you'd agree on" — quick filter to surface only shared dimensions
- [ ] Compatibility history: has your compatibility with this friend changed over time?
- [ ] Genre compatibility (not just dimension-level)

---

## Feature 4: Find Together / Blend (`/friends/[id]/blend` or within friend page)

### What's built
- "Find together" — films that score well for BOTH people based on their taste codes
- Consensus score computed: mean of individual match scores − penalty for variance
- Results ranked by consensus score
- Film cards show both users' projected scores
- Watchlist crossover: films both have saved

### Design decisions
- Find-together uses the same Consensus Harmony Score as the planned Mood Room, but for exactly 2 people
- Members without a taste code are treated as flexible (excluded from score calculation)

### Open requirements
- [ ] Find-together filters: genre, new releases, runtime
- [ ] "Add to shared watchlist" action from find-together results

---

## Feature 5: Recommendations (`/recommendations`)

### What's built
- Send a film to a friend with a note
- Received recommendations appear in inbox with sender name, note, and film details
- Recommendation reactions (accept, dismiss)
- Recommendation comments (thread on a specific rec)
- Notifications: badge on Friends tab for new recs, auto-cleared on inbox open
- "Recommend" action woven into all logging done-screens and film detail panel

### Design decisions
- Recommendations are personal, not broadcast — one recipient per rec
- Recs do not affect the taste model directly

### Open requirements
- [ ] "Suggest to group" — send a rec to all Mood Room members simultaneously
- [ ] Rec expiration / archive (inbox gets cluttered over time)
- [ ] Taste-informed recommendation: when you recommend a film, show how well it matches the recipient's taste code

---

## Feature 6: Friend Taste Code (`/friends/[id]/taste-code`)

### What's built
- Friend's full 12-dimension taste code view (same format as own taste code page)
- H/M/L badges on all dimension tiles
- Comparison context: "They lean X, you lean Y on this dimension"

### Open requirements
- [ ] Side-by-side view (your taste code next to theirs on the same page)

---

## Feature 7: Network Catalog (`/films` — Network tab)

### Concept
The catalog's default mode shows every film in the database — useful, but noisy. The Network tab flips the model: instead of browsing all films, you browse the films your friends have actually watched. Every title in the Network tab has a human attached to it.

This isn't a filter on top of the existing catalog. It's a different inventory. The question it answers is: "what has my network seen?" not "what's in the database?"

This principle extends beyond the catalog tab — the Mood Room uses the same network-filtered pool as its candidate set when running recommendations. See `prd-discovery.md` Feature 2 for the Mood Room spec.

### What to build

**Tab placement**
- Catalog gains a "Network" tab alongside All Titles / New Releases / Recommended (per Phase D roadmap note)
- Default tab remains All Titles; Network is a mode you enter intentionally
- Tab order: All Titles · New Releases · Network · Recommended

**Network tab: default view ("All Friends")**
- Shows every film watched by at least one friend in your network, deduplicated
- Sorted by: number of friends who've seen it (desc), then by your match score as tiebreaker
- Each film card shows a small friend attribution below the title: avatar(s) or name(s) of who's watched it, plus their star rating if they gave one
- Your match badge still appears (top-right corner) — the Network tab is still taste-aware
- Films you've already watched are dimmed or labeled (same behavior as current catalog)

**Friend filter strip**
- Horizontal chip row directly below the tab bar: **All Friends** (selected by default) + one chip per friend
- Selecting a friend filters to only their watched films — their rating replaces the attribution badge on each card
- Selecting multiple friends shows the intersection or union (start with union — intersection gets too sparse)
- Chip count shows how many films that friend has logged, e.g. "Maya (34)"

**Card behavior**
- Clicking any film opens the standard film side panel
- Panel already shows friend ratings if enriched — no new panel work needed

### Design decisions

**Why union, not intersection, for multi-friend filter**
Intersection (films all selected friends have seen) gets too small too fast — 3 friends and you might have 5 films. Union keeps the catalog rich while still being bounded.

**Attribution on the card, not in the panel**
The friend's name/avatar on the card is what makes this feel different from the regular catalog. It's a passive social signal — every film has provenance. Keep it compact (max 3 avatars, then "+N").

**Sort priority: breadth first, then match**
A film 4 friends have seen is more socially validated than one only 1 friend has seen, so social depth ranks above match score. But within the same "seen by N friends" tier, match score breaks ties so the results still feel personally relevant.

**"Your network" framing, not "friends"**
Use "Your Network" in UI copy rather than "Friends" — it's slightly warmer and scales better when the feature expands (e.g., friends-of-friends someday).

### Cold start handling

| State | What to show |
|---|---|
| No friends yet | Empty state: "Add friends to see what your network is watching" + Add Friend button |
| Friends exist, none have logged films | "Your friends haven't logged any films yet — check back soon" + links to their profiles |
| 1–5 network films | Show what exists + "Your catalog grows as your network does" + Add Friend prompt |
| Normal | Full grid |

### Open requirements
- [ ] Network tab — base implementation (API + UI)
- [ ] Friend filter chips with film count
- [ ] Attribution badges on cards (who's seen it + their rating)
- [ ] Cold start empty states
- [ ] Union vs. intersection toggle for multi-friend selection (stretch)
- [ ] Sort toggle: "Most watched in network" vs. "Best match for you" (stretch)

---

## Technical reference

- `app/(app)/friends/page.tsx` — friends list + invite
- `app/(app)/friends/[id]/page.tsx` — friend profile (activity, crossovers, tabs)
- `app/(app)/friends/[id]/compatibility/page.tsx` — full compatibility breakdown
- `app/(app)/friends/[id]/profile/page.tsx` — friend's profile view
- `app/(app)/friends/[id]/taste-code/page.tsx` — friend's taste code
- `app/api/friends/route.ts` — friend list, send invite
- `app/api/friends/[id]/route.ts` — friend detail, remove
- `app/api/friends/[id]/accept/route.ts` — accept friend request
- `app/api/friends/[id]/compatibility/route.ts` — compatibility score + breakdown (via taste route)
- `app/api/friends/[id]/find-together/route.ts` — consensus film scoring
- `app/api/friends/[id]/crossovers/route.ts` — shared watched films
- `app/api/friends/[id]/activity/route.ts` — interleaved activity thread
- `app/api/friends/[id]/taste/route.ts` — friend's taste data
- `app/api/friends/[id]/thread/route.ts` — rec thread
- `app/api/recommendations/route.ts` — send rec
- `app/api/recommendations/inbox/route.ts` — received recs
- `app/api/recommendations/[id]/react/route.ts` — accept/dismiss
- `app/api/recommendations/[id]/comment/route.ts` — thread comment
