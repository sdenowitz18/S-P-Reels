# ONBOARDING_PRD.md
## Product Requirements: Taste Profile Onboarding & Monthly Refresh

---

### OVERVIEW

When a new user signs up, they go through a taste profile onboarding flow that produces two outputs: a **taste code** (12-dimension behavioral signal derived from ratings) and a **taste portrait** (4–6 qualitative claims about their relationship with film, grounded in their actual library). These two outputs are complementary — the code is derived from behavior, the portrait is derived from conversation. Neither replaces the other.

There are two entry paths based on whether the user has Letterboxd history. Both paths produce the same output. After onboarding, a monthly check-in system keeps the portrait current as the user watches more films.

---

### WHAT ONBOARDING PRODUCES

**Taste Code** — already exists in the system. Computed from dimension scores of rated films. The interview does not change the taste code directly. It produces qualitative signal that explains and annotates the code, not signal that overwrites it.

**Taste Portrait** — new. 4–6 specific, plain-language claims about this user's relationship with film. Grounded in their actual films. Stored as versioned text. Updated via monthly check-in when qualitative input is provided.

**Open Questions** — a short list of tensions or contradictions the interview did not fully resolve. Stored alongside the portrait. Used to guide future check-ins.

---

### TWO SIGNAL MODES: SOFT AND HARD

Portraits operate in one of two modes depending on how much behavioral data the user has accumulated. This distinction is internal — users don't choose their mode, the system determines it — but it significantly changes what the portrait is based on and how confident the system is in its claims.

**Soft signal mode (interview-informed):** Active when a user has fewer than ~50 rated films with dimension scores. The portrait is anchored primarily in what the user said during the interview, supplemented by whatever behavioral data exists. Claims are framed with appropriate tentativeness: "Based on what you've told us..." The taste code letters in this mode are provisional — shown, but with a visual indicator that they will sharpen with more films. This is the starting state for all cold-start users and for Letterboxd users with thin rating history.

**Hard signal mode (behaviorally-driven):** Active when a user has 50+ rated films with dimension scores. The portrait transitions to being anchored in behavioral patterns — what they actually watched and rated — with the interview used as context and annotation rather than the primary source. Claims are made with more confidence. The taste code letters are fully solid.

**The transition moment:** When a user crosses the threshold from soft to hard signal, the monthly check-in surfaces this explicitly as an insight. It is not framed as a correction — it is framed as a discovery:

> "You've now rated enough films that your viewing behavior is telling its own story. Here's something interesting: when you described your taste in your interview, you said you gravitate toward [interview claim]. Your ratings tell a slightly different story — [behavioral finding]. That gap is worth knowing about."

This moment — when stated self-perception and observed behavior diverge — is one of the most valuable things the system can surface. It should feel like a revelation, not a rebuke.

The 50-film threshold is a starting point and can be tuned based on how well the contradiction algorithm performs at different data volumes. Films that are rated but not yet dimension-scored do not count toward the threshold.

---

## PATH A: LETTERBOXD IMPORT

### Step 1 — Upload

The user is prompted to export and upload their Letterboxd CSV. A help tooltip explains the two-step Letterboxd export process. Users who skip go to Path B.

**UI:** Full-screen upload prompt. Simple drag-and-drop or file picker. Clear "skip for now" link.

---

### Step 2 — Film Processing

On upload, the system:
1. Parses the CSV and extracts film titles, ratings, and watch dates
2. Matches each title to a TMDb film record (using existing TMDb lookup)
3. For each matched film, checks whether `dimensions_v2` is already populated in the `films` table
4. Any film without dimension scores is queued for scoring via the Film Scoring Skill
5. Scoring runs in the background — the user sees a progress indicator during this step

**Processing screen:** Shows the user's library populating in real time — film posters appearing as films are matched and scored. Counter: "327 films found · 214 already scored · 113 being scored now." Progress bar. Estimated time if scoring queue is large.

**Delta logic:** Films already scored are not rescored. The shared `films` table is the source of truth — a film scored for one user is immediately available for all subsequent users. The system only scores the delta (films not yet in the database).

**Failure handling:** If a film title cannot be matched to TMDb, it is skipped and noted in a summary. If fewer than 15 films can be scored, the user is offered Path B as a supplement.

---

### Step 3 — Contradiction Mapping

Before the interview begins, the system computes the contradiction map from the user's rated library. This runs automatically after Step 2 completes. The user does not see this — it is internal preparation.

**Algorithm:**

For each of the 12 dimensions:
1. Find all films the user has rated 3.5+ stars
2. Separate into LEFT pole films (dimension score 0–35) and RIGHT pole films (dimension score 65–100)
3. If both buckets have at least 1 film, this dimension has a contradiction candidate
4. Score the contradiction by: `avg(top-left-star-rating) + avg(top-right-star-rating) + dimension_gap_score`
5. Pick the top film from each pole as the pair for that dimension

**Ranking and selection:**
- Rank all contradiction candidates by their combined score
- Select the top 4 contradictions, ensuring they span at least 3 different dimension clusters (narrative, emotional, structural, social)
- A fifth contradiction is selected as a backup in case a user's response resolves one of the first four quickly

**Messy middle films:**
- Additionally, flag films rated 4+ stars where fewer than 3 dimensions score clearly at an extreme (below 30 or above 70)
- These are ambiguous films that resist classification — they should be referenced in the interview if the contradiction phase leaves gaps
- Maximum 3 messy middle films flagged per user

---

### Step 4 — Visual Interview

This is the core of the onboarding experience. It runs as a structured, visual session — not a freeform chat. Claude drives the intelligence behind each step, but the user experience is a designed visual flow with film cards, specific questions, and a text response field.

#### Session Structure

The interview has a fixed visual layout:
- **Stage area** (top 60%): displays the current film cards or question context
- **Prompt area** (below stage): Claude's current question, written conversationally
- **Response area** (below prompt): a single text input field
- **Progress indicator**: subtle step dots showing position in the interview (not a percentage — just a sense of place)

The session is resumable. If a user closes the browser mid-interview, their progress is saved and they can pick up from the last completed step.

---

#### Phase 1 — Contradiction Questions (3–4 rounds)

For each selected contradiction pair:

**Visual presentation:**
- Two film cards displayed side by side
- Each card: poster image, title, year, user's star rating
- Below each poster: a small dimension bar for the relevant dimension, showing where this film sits (e.g., a bar labeled "Narrative Clarity" with a dot placed toward the Opaque end)
- The dimension being discussed is labeled between the two cards: "Narrative Clarity ← → Opaque"

**Claude's prompt:**
- Written as a natural observation, not a survey question
- Anchored to the specific films and the specific dimension gap
- Example: "You gave both of these films five stars — but they're almost opposites in how much they ask of you. *Aftersun* barely shows you what's happening and trusts you to feel it. *Forrest Gump* guides you through every emotion. What did each of them give you that the other couldn't?"
- The prompt is generated fresh for each user based on their specific films — never a template read verbatim

**User response:**
- Free text, no length minimum
- If the user submits fewer than 15 words, a follow-up probe appears: "Tell me more — what specifically about [film] got you?"

**Between rounds:**
- A brief transition: Claude acknowledges the response with one sentence and introduces the next pair
- Example: "That makes sense — you're not looking for the same thing from every film. Here's another one..."
- No lengthy reflection between rounds — keep pace up

---

#### Phase 2 — Calibration Questions (2–3 questions)

After the contradiction phase, Claude selects 2–3 calibration questions from the bank below. Selection is based on what the contradiction phase left unresolved.

**Visual presentation:**
- No film cards — a single-focus question layout
- Slightly warmer visual treatment (more centered, less analytical than the contradiction cards)
- Still the same response field

**Calibration question bank (Claude selects, user does not choose):**

*On purpose:*
> "When you sit down to watch something, what are you usually hoping to get out of it? What's the best version of the next two hours?"

*On negative space:*
> "Is there a type of film you keep bouncing off of — stuff you feel like you should love but just doesn't click?"

*On the rewatch test:*
> "What's a film you've seen more than twice? What keeps pulling you back?"

*On the walkout test:*
> "Have you ever turned something off partway through? What pushed you over the edge?"

*On the gift test:*
> "If you were going to make someone sit down and watch one film with you — what would it be, and why that person?"

*On the disappointment test:*
> "What's something that was exactly the type of movie you love on paper — right genre, right director, right everything — and it still didn't land? What was missing?"

*On the surprise test:*
> "What's a film you went into skeptical about and it completely won you over? What did it do?"

---

#### Phase 3 — Portrait Generation

After the calibration questions, the interview closes and portrait synthesis begins.

**Visual:** A brief transition screen — "Let me put this together." A few seconds of visible thinking (streaming dots or subtle animation). Not a long wait.

The portrait is generated using the full interview transcript + the user's dimension scores and film ratings as context. Rules:
- 4–6 claims, each specific to this user's actual films
- No generic statements ("you like character-driven films")
- Each claim must reference at least one film from their library by name
- Lead with the most surprising or counterintuitive finding
- Written in second person, plain language, no film-critic vocabulary
- One "open question" at the end: a tension the data and conversation didn't fully resolve

**Portrait display:**
- Shown one claim at a time, appearing sequentially (staggered reveal)
- Each claim has a subtle "flag this" option — a small icon the user can tap if a claim doesn't feel right
- Flagged claims are stored as unresolved questions
- At the end: the user's taste code letters are displayed alongside the portrait — the code and the portrait as a paired identity

---

### Step 5 — Confirmation

The user sees their full profile: taste code badge + portrait. They can:
- Read the portrait and accept it
- Flag any statement they disagree with
- Add a brief note to any flag ("this was true two years ago but not anymore")

Flagged items go into `open_questions` and are surfaced in the first monthly check-in.

After confirmation, the user proceeds to the main app.

---

## PATH B: COLD START (NO LETTERBOXD DATA)

### Step 1 — Film Recognition Exercise

The user is presented with a curated set of 40–50 films, shown in groups of 6. The goal is to quickly build a seed dataset with enough range to allow contradiction hunting and meaningful interview discussion.

**Film selection criteria for the calibration set:**
The 40–50 films must be carefully balanced across all 12 dimensions — not just extremes. The set needs three tiers per dimension:
- **Polar films** (scoring 0–25 or 75–100 on that dimension): anchor the extremes — essential for identifying where someone is not
- **Middle films** (scoring 35–65): equally important — a user who consistently rates middle films highly has a different profile than someone who ignores them; middles also help the interview distinguish active preference from unfamiliarity
- **Well-known films are preferred:** the recognition exercise fails if users haven't seen the films; lean toward films with wide cultural reach even if they aren't arthouse favorites

The same film can represent multiple dimensions, so 40–50 films can cover all 12 dimensions adequately if selected with overlap in mind. The calibration set is defined in the Film Scoring Skill and should be pre-scored in the shared database so this step has no scoring delay.

**Visual design:**
- Film cards displayed in a 2x3 grid
- Each card: poster, title, director, year
- Three tap options per card: ★ Loved it / ○ Mixed or didn't like it / — Haven't seen it
- Cards that are "haven't seen" slide away immediately
- The interaction should feel fast and frictionless — closer to a swipe exercise than a form

**Progress and pacing:**
- After each group of 6, a small summary: "You've rated 8 films so far"
- After 15 rated films: an option appears — "We have enough to get started. Want to keep going or jump into your profile?" — the user can proceed early
- Maximum 50 films shown before the system proceeds regardless
- If fewer than 8 films have been rated after 50 shown: a different entry point is offered (manual entry of 3–5 favorite films)

---

### Step 2 — Quick Rating Calibration

For films marked "Loved it" or "Mixed/didn't like it," the user is asked to be slightly more specific:

For each "Loved it" film: a simple 5-star tap (whole stars only at this stage)
For each "Mixed/didn't like it" film: binary — "Just not for me" vs "Actively didn't like it"

This converts the recognition exercise into a minimal ratings dataset that feeds the contradiction algorithm.

---

### Step 3 — Dimension Scoring

Same as Path A Step 2 (delta check + scoring). Because the film set is pre-curated from the calibration set, most of these films are already scored in the shared database — this step is fast.

---

### Step 4 — Contradiction Mapping

Same algorithm as Path A Step 3. With a smaller dataset (15–50 films vs hundreds), contradictions may be fewer. If fewer than 2 strong contradictions exist:
- Use messy middle films as the primary interview material
- Lean more heavily on calibration questions
- The portrait may be shorter and include more open questions — this is expected and communicated to the user ("Your profile will get sharper as you add more films")

---

### Steps 5–7

Same as Path A Steps 4–5 (Visual Interview → Portrait Generation → Confirmation).

---

## MONTHLY CHECK-IN SYSTEM

### Trigger

A monthly check-in is queued when a user has logged at least 5 new films since their last portrait update. "Logged" means added to their Watched list — rating is not required to trigger, but unrated films contribute less signal.

The check-in is surfaced as an in-app notification. It does not send email unless the user has opted in to email notifications.

---

### Check-in Flow

The check-in is a single screen — not a full interview. The primary job is making the user feel seen: showing them their own viewing history and what it says about them. The user is not asked to do work. They receive a report. Any question at the end is light and entirely optional — it updates the portrait if answered, but skipping it has no cost.

The check-in should take under 2 minutes to read. Responding to the optional question adds another minute at most.

**Section 1 — Films since last update**
A horizontal scroll of film posters: every film logged since the last check-in, with the user's star rating shown beneath each (or a "not yet rated" placeholder). A count label: "12 films since your last update."

**Section 2 — What the data says**
2–3 observations derived from the new films + their dimension scores. These are insights, not prompts — the user reads them, they don't respond to them.
- Lead with the most consistent or surprising pattern
- Compare new films to existing profile: reinforce where things are consistent, surface where something shifted
- Example: "8 of your 12 recent films score in the Provocative half of Psychological Safety — consistent with your profile. One exception: you gave [Film X] 4.5 stars, and it's one of the most reassuring films in that dimension. That's interesting."
- Written in the same plain, specific voice as the portrait — not dashboard language

**Section 3 — Taste code changes (if any)**
If any of the 12 dimension tendencies have shifted enough to change a letter:
- Show before/after code with the changed letter highlighted: "Your N shifted to T."
- One sentence of plain explanation: "You've been rating Theatrical films highly — it's a consistent lean in your recent watches."

If no letters changed: this section is omitted entirely. No "nothing changed" message.

**Section 4 — One optional question**
A single light question, chosen based on what the new data leaves genuinely unresolved. It is presented gently — not as a required step.

Example: "Anything surprising in what you've been watching lately — or does this feel like you?"

**Response options:**
- Type a response (triggers portrait update)
- Tap anywhere else / "close" (portrait unchanged, dimension scores updated silently from ratings)

---

### Portrait Update Logic

If the user responds to the monthly question:
- The response is added to the interview transcript history
- The portrait is regenerated using all accumulated transcript + updated dimension scores
- Old portrait is archived (versioned), not deleted
- New portrait is displayed with a brief diff: "Two things changed since your last update." Claims that changed are highlighted.

If the user does not respond:
- Dimension scores update from new ratings (behavioral data only)
- Portrait text does not change
- Open questions from the previous portrait persist

---

## DATA ARCHITECTURE

### New tables required

**`taste_portraits`**
```sql
create table taste_portraits (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references users(id) on delete cascade,
  portrait_text   text not null,
  open_questions  jsonb default '[]',
  version         int not null default 1,
  source          text check (source in ('letterboxd', 'cold_start', 'monthly_refresh')),
  created_at      timestamptz default now()
);
```

**`taste_interview_sessions`**
```sql
create table taste_interview_sessions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references users(id) on delete cascade,
  path            text check (path in ('letterboxd', 'cold_start')),
  status          text check (status in ('in_progress', 'completed', 'abandoned')),
  contradictions  jsonb default '[]',    -- pre-computed pairs
  transcript      jsonb default '[]',    -- [{role, content, step}]
  current_step    int default 0,
  completed_at    timestamptz,
  created_at      timestamptz default now()
);
```

**`taste_monthly_checkins`**
```sql
create table taste_monthly_checkins (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references users(id) on delete cascade,
  films_since     jsonb default '[]',     -- film_ids logged since last checkin
  observations    jsonb default '[]',     -- dimension shift observations
  question        text,
  response        text,
  portrait_updated boolean default false,
  created_at      timestamptz default now()
);
```

### Films table change

`dimensions_v2` should be extracted from `ai_brief` JSONB and promoted to its own column on the `films` table. This makes querying for contradiction mapping faster and more transparent.

```sql
alter table films
  add column if not exists dimensions_v2 jsonb;
```

A backfill migration populates this from `ai_brief->>'dimensions_v2'` for all existing scored films.

---

## OPEN QUESTIONS / DECISIONS NEEDED

1. **Letterboxd scoring time UX:** A user with 600 films where 400 are unscored could wait several minutes. Do we let them browse the app while scoring runs in the background and notify them when the interview is ready? Or do we gate the interview entirely behind scoring completion?

2. **Cold start minimum:** If a user has rated fewer than 8 films from the recognition exercise (they just haven't seen many of the calibration films), what's the fallback? Manual entry of favorite films? A shorter, softer interview that acknowledges limited data?

3. **Portrait flagging UX:** When a user flags a portrait claim, what happens in the moment? Does it just disappear? Get greyed out? Do they get asked "what feels off about this"?

4. **Email notifications:** Does the monthly check-in go to email? If so, can it be a rich email that contains the films-watched section directly (so they can respond without opening the app)?

5. **Interview retake:** Can users retake the interview after completing it? If so, what happens to the previous portrait?

6. **Multiple Letterboxd imports:** If a user already has a profile and imports a new Letterboxd export (with more history), how does that work? Does it trigger a new interview, or just update dimension scores and queue a monthly check-in?
