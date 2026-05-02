-- ── 0010_onboarding_foundation.sql ───────────────────────────────────────────
-- Phase 0 of the onboarding build.
--
-- 1. Promote dimensions_v2 from inside ai_brief JSONB to its own column on films.
--    This makes contradiction mapping queries fast and explicit rather than
--    requiring JSONB extraction on every row.
--    Backfills from ai_brief for any films already scored.
--
-- 2. Create taste_portraits — versioned portrait text per user.
--
-- 3. Create taste_interview_sessions — tracks onboarding interview state,
--    contradiction pairs, transcript, and resumability.
--
-- 4. Create taste_monthly_checkins — records each monthly check-in, the
--    observations surfaced, the optional question asked, and whether the
--    portrait was updated as a result.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. films: promote dimensions_v2 ─────────────────────────────────────────

alter table films
  add column if not exists dimensions_v2 jsonb;

-- Backfill from ai_brief for films that were already scored
update films
set dimensions_v2 = (ai_brief -> 'dimensions_v2')
where dimensions_v2 is null
  and ai_brief is not null
  and ai_brief ? 'dimensions_v2';

-- ── 2. taste_portraits ───────────────────────────────────────────────────────

create table if not exists taste_portraits (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references auth.users(id) on delete cascade not null,
  portrait_text   text not null,
  open_questions  jsonb not null default '[]',   -- [{claim, note}]
  signal_mode     text check (signal_mode in ('soft', 'hard')) not null default 'soft',
  version         int not null default 1,
  source          text check (source in ('letterboxd', 'cold_start', 'monthly_refresh')) not null,
  created_at      timestamptz not null default now()
);

alter table taste_portraits enable row level security;

create policy "users read own portraits"
  on taste_portraits for select
  using (auth.uid() = user_id);

create policy "service writes portraits"
  on taste_portraits for insert
  with check (auth.uid() = user_id);

-- ── 3. taste_interview_sessions ─────────────────────────────────────────────

create table if not exists taste_interview_sessions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references auth.users(id) on delete cascade not null,
  path            text check (path in ('letterboxd', 'cold_start')) not null,
  status          text check (status in ('in_progress', 'completed', 'abandoned')) not null default 'in_progress',
  contradictions  jsonb not null default '[]',   -- pre-computed [{film_a, film_b, dim_key, gap_score}]
  messy_middle    jsonb not null default '[]',   -- flagged film_ids for undetermined protocol
  transcript      jsonb not null default '[]',   -- [{step, type, film_a_id?, film_b_id?, dim_key?, question, response, transition}]
  current_step    int not null default 0,
  completed_at    timestamptz,
  created_at      timestamptz not null default now()
);

alter table taste_interview_sessions enable row level security;

create policy "users read own interview sessions"
  on taste_interview_sessions for select
  using (auth.uid() = user_id);

create policy "users write own interview sessions"
  on taste_interview_sessions for all
  using (auth.uid() = user_id);

-- ── 4. taste_monthly_checkins ────────────────────────────────────────────────

create table if not exists taste_monthly_checkins (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid references auth.users(id) on delete cascade not null,
  films_since      jsonb not null default '[]',      -- film_ids logged since last checkin
  observations     jsonb not null default '[]',      -- [{text, dim_key?, type}] generated insights
  code_changes     jsonb not null default '[]',      -- [{dim_key, from_letter, to_letter}] if any
  question         text,                              -- optional question asked
  response         text,                              -- user's response if any
  portrait_updated boolean not null default false,
  created_at       timestamptz not null default now()
);

alter table taste_monthly_checkins enable row level security;

create policy "users read own checkins"
  on taste_monthly_checkins for select
  using (auth.uid() = user_id);

create policy "users write own checkins"
  on taste_monthly_checkins for all
  using (auth.uid() = user_id);
