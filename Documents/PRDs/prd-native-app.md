# PRD: Native Mobile App
_Cross-cutting epic | Last updated: 2026-05-04_

The native app brings sp-reels to iPhone. The core premise: logging is a time-sensitive impulse that happens right after you finish watching — on your phone, not your laptop. The app needs to be there in that moment, fast and frictionless.

---

## Goal

Get out of the way and let someone log a film in under 30 seconds after the credits roll. Everything else in the app supports that loop: a feed that shows what friends are watching, a catalog to find what to watch next, and a profile that shows you who you are as a viewer.

---

## Platform decisions

- **Framework**: Expo (React Native) — separate repo (`sp-reels-mobile`)
- **Backend**: unchanged — same Supabase database, same Next.js API routes
- **Shared code**: `lib/types.ts`, `lib/taste-code.ts`, `lib/taste/`, `lib/supabase/client.ts` — copied or symlinked
- **App Store**: individual developer account (not organization), Apple Developer Program ($99/yr)
- **Distribution path**: TestFlight first → App Store when stable

### No cross-contamination
The web app (`sp-reels/`) is never modified as part of this build. The native app is a client of the existing API, not a fork of the codebase.

---

## Auth

The current web auth flow (email/password with no verification) is not suitable for a published App Store app. Apple requires a functional account system.

### Requirements
- [ ] Enable email verification in Supabase (currently off)
- [ ] Native sign-up flow: email → password → verify email before access
- [ ] Native sign-in flow: email + password, with "forgot password" deep link
- [ ] Session persistence: stay logged in across app restarts (Supabase handles this via AsyncStorage)
- [ ] Sign out option in Profile

### Open questions
- Do we want Sign in with Apple? Apple requires offering it if you support any third-party auth. Currently we have email-only, so not required — but worth adding later.

---

## Navigation

Five destinations, bottom tab bar:

```
Home    Discover    [+ Log]    Watchlist    Profile
```

- **Log** is a center floating action button, always accessible — primary entry point
- **Home** = friend activity feed + "recently watched" for yourself
- **Discover** = scored catalog + recommendations
- **Watchlist** = saved films to watch
- **Profile** = your stats, taste code, settings

Friends are not a tab — they surface contextually inside Home (activity feed) and after logging (share suggestion).

---

## Feature 1: Log Flow (core)

The reason the app exists. Entry via the center + button from anywhere in the app.

### Flow
```
Search → Select film → Stage (watched / now playing / just talk) → Rate → Interview → Done → [Share with friend?]
```

### Requirements
- [ ] TMDB search, same as web — title, year, poster
- [ ] Stage selection: Rate It / Now Playing / Just Talk
- [ ] Rating: 5-card flow (stars → rewatch → fit check → comment → insight card)
- [ ] Interview: qualitative discussion flow
- [ ] Quick Rate: bulk rating mode, accessible from onboarding and from Log entry point
- [ ] Post-log share suggestion (see Feature 5)

### Mobile-specific considerations
- Search input should auto-focus and show keyboard on Log tap
- Swipe-to-dismiss on the log sheet
- Haptic feedback on star selection and key transitions
- Insight card (post-rate reveal) should feel like a reward moment — full-screen treatment

---

## Feature 2: Home Feed

Shows you what's happening in your social graph and your own recent activity.

### Requirements
- [ ] Friend activity: recently logged films with their star rating, no spoilers
- [ ] Own recent activity: last 3–5 logged films
- [ ] Tap a friend's log entry → film detail sheet
- [ ] Tap a friend's name → their profile (read-only)
- [ ] Empty state: prompt to find friends if social graph is empty

### Open requirements
- [ ] "X friends watched this week" summary card
- [ ] Activity notifications (see Notifications section)

---

## Feature 3: Discover

Scored catalog + recommendations in one destination.

### Requirements
- [ ] Scored film grid (match score, poster, title)
- [ ] Genre filter (same two-level system as web)
- [ ] Media type filter: Films / TV / All
- [ ] Tap film → film detail sheet with match score breakdown, "add to watchlist", "log it"
- [ ] Recommendations section: personalized picks with reasoning (when taste profile exists)
- [ ] Quality sort fallback for new users (< 8 rated films)

### Mobile-specific considerations
- Grid should be 2-column on phone (not 3+ like web)
- Film detail opens as a bottom sheet, not a page navigation
- "Log it" button in film detail sheet routes directly into the Log flow with film pre-filled

---

## Feature 4: Watchlist

Quick reference while browsing streaming services.

### Requirements
- [ ] List of saved films with poster + title
- [ ] Tap → film detail sheet
- [ ] "Log it" from film detail marks as watched and enters log flow
- [ ] Remove from watchlist (swipe action)

---

## Feature 5: Post-Log Share Suggestion

After completing a log, surface a "share with a friend?" prompt before returning to Home.

### Requirements
- [ ] Show 1–3 friends ranked by match score for the just-logged film
- [ ] Display friend name, avatar/initial, and match % for that film
- [ ] "Send" action (TBD: in-app notification, push, or external share — see Open questions)
- [ ] "Skip" dismisses and returns to Home
- [ ] Requires friends in social graph — skip entirely if user has no friends

### Decided
- **"Send" creates an in-app notification** for the friend — appears in their Home feed as "Steven thinks you'd love [film]" with the match %
- Push notification fires if the friend has notifications enabled

### Open questions
- [ ] Should this show even if match % is low? Probably not — set a threshold (e.g., > 60%)

---

## Feature 6: Profile

Your identity in the app.

### Requirements
- [ ] Star rating count, films logged, TV shows logged
- [ ] Taste code letter + description (surfaced from profile, not a separate nav destination)
- [ ] Taste dimensions summary (top 3–4 strong signals)
- [ ] Friends list with match scores
- [ ] Settings: sign out, notification preferences

### Cut from MVP
- Full taste report (long-form analysis) — link to web version instead
- Taste code standalone redirect page (`/taste-code`) — no equivalent needed on mobile
- "See full dimensions" drill-down — all 12 dimensions with H/M/L scores; web-only for now

---

## Feature 7: Onboarding

Must exist on mobile. Users coming to the app for the first time need to build a taste profile before recommendations or match scores are meaningful.

### Requirements
- [ ] Same contradiction-hunting logic as web
- [ ] Quick Rate embedded in onboarding calibration (user rates a set of known films)
- [ ] Early exit option (same as web)
- [ ] Taste code reveal at the end
- [ ] Skip path for users who already have a web account (sign in → existing taste data loads)

### Mobile-specific considerations
- Onboarding should feel native — card swipe interactions, not page navigation
- Progress indicator so users know how far through calibration they are

---

## Notifications

Push notifications are a key reason to build native over PWA. This is an open design area — requirements below are a starting framework, not finalized.

### Proposed notification types
- **Friend logs a film** — "Alex just logged Sinners ★★★★"
- **Friend recommends to you** — "Alex thinks you'd love The Brutalist"
- **Weekly activity summary** — "3 of your friends watched something this week"
- **Watchlist nudge** — "You saved Dune: Part Two 3 weeks ago — still want to watch it?"

### Requirements
- [ ] Request notification permission during onboarding (not at app launch — bad practice)
- [ ] Notification preferences in Profile settings (per-type on/off)
- [ ] Deep link from notification → relevant screen (friend's log, film detail, etc.)
- [ ] Backend: push notification infrastructure (Expo Push Notifications service or APNs direct)

### Open questions
- [ ] What's the right cadence for friend activity notifications? Real-time vs. batched daily digest?
- [ ] Do we notify when someone's match score with a film crosses a threshold?

---

## Removed from MVP

| Feature | Reason |
|---|---|
| Mood Room | Couch/laptop experience — deliberate and collaborative, not on-the-go |
| Import | One-time setup utility — do it on web, data carries over |
| Full taste report | Long-form analytical read — not a mobile action |
| Taste code redirect page | No equivalent needed — taste code surfaces from Profile |
| Now Playing theater showtimes | Not core to logging loop |

---

## Feature 8: Find & Add Friends

Friends are how the social layer activates. Without a way to find people, the Home feed is empty and the post-log share suggestion never fires.

### Requirements
- [ ] Search by email — same as web (`/api/friends/search`), shows preview card before sending request
- [ ] Send friend request — in-app notification sent to recipient immediately
- [ ] Pending requests visible in Profile or Home (incoming + outgoing)
- [ ] Accept / decline incoming request
- [ ] Entry point: Home empty state ("find friends") + Profile friends list ("add a friend")

### Invite flow (new users who aren't on the app yet)
The current invite flow has a known bug: when someone clicks an invite email link, the pending friend request is stored with `to_user_id: null` and nothing reconnects it when they sign up. The new user lands on `/welcome` with the friendship broken.

This must be fixed before mobile launch. Required work:
- [ ] Fix invite completion: after sign-up via invite link, look up any pending `friend_requests` by email and link them to the new `user.id`
- [ ] Universal Links configuration: invite links must open the native app (not Safari) when the app is installed
- [ ] If the app isn't installed, invite link should open the App Store

---

## Security

Apple's requirements for an app in this category are not onerous. The main obligations:

**Apple requirements (must-have before submission):**
- HTTPS everywhere — already satisfied (Supabase + Vercel)
- Privacy policy at a public URL — needs to be written and hosted
- App Store Connect data declaration — email address, name, usage data (straightforward)

**Internal security (audit before launch):**
- [ ] Supabase Row Level Security audit — confirm users can only read their own data and accepted friends' public data
- [ ] API route auth check — all routes use `supabase.auth.getUser()` (confirmed); verify no gaps where unauthenticated requests succeed
- [ ] Admin client usage review — `createAdminClient()` bypasses RLS and is server-side only; confirm it is never called from client-side code
- [ ] No sensitive data logged to console in production builds

**Not required for this app:**
- Security certifications (required for financial/health apps, not consumer entertainment)
- Encryption at rest beyond what Supabase provides by default
- Special entitlements (no location, no health, no payment processing)

---

## Open requirements (cross-cutting)

- [ ] **Auth**: email verification enabled in Supabase before App Store submission; web UI updated to show "check your email" state after sign-up
- [ ] **Invite flow bug**: fix friend request reconnection after invite sign-up (affects web too)
- [ ] **App name**: "sp-reels" is a dev name — need a real name before App Store Connect entry
- [ ] **App icon**: required for TestFlight submission
- [ ] **Privacy policy**: required by Apple — must be a publicly accessible URL
- [ ] **Push infrastructure**: APNs certificate setup in Expo/EAS
- [ ] **Offline queue**: log attempts while offline should queue and sync on reconnect

---

## Build sequence (suggested)

**Phase 1 — Scaffolding + Auth**
Expo project, navigation shell, Supabase auth (sign in / sign up / verify), bottom tabs

**Phase 2 — Core log loop**
Search → Stage → Rate → Interview → Done (no share suggestion yet)

**Phase 3 — Catalog + Watchlist**
Film grid, match scores, film detail sheet, add to watchlist, log from catalog

**Phase 4 — Home feed + Social**
Friend activity, friend profiles, post-log share suggestion

**Phase 5 — Onboarding + Quick Rate**
Full onboarding flow, Quick Rate, taste code reveal

**Phase 6 — Notifications**
Push setup, notification types, preferences

**Phase 7 — Polish + TestFlight**
App icon, haptics, empty states, edge cases, TestFlight submission
