-- Drop everything (safe — no real data yet)
drop table if exists notifications cascade;
drop table if exists dismissed_recs cascade;
drop table if exists user_taste_tags cascade;
drop table if exists recommendation_events cascade;
drop table if exists recommendation_replies cascade;
drop table if exists recommendation_reactions cascade;
drop table if exists recommendations cascade;
drop table if exists interviews cascade;
drop table if exists library_entries cascade;
drop table if exists group_taste_tags cascade;
drop table if exists group_members cascade;
drop table if exists groups cascade;
drop table if exists films cascade;
drop table if exists users cascade;

-- ───── USERS — id = auth user id ─────────────────────────────────
create table users (
  id              uuid primary key references auth.users(id) on delete cascade,
  email           text not null,
  name            text not null,
  accent_color    text,
  created_at      timestamptz default now()
);

alter table users enable row level security;
create policy "users: read own" on users for select using (auth.uid() = id);
create policy "users: insert own" on users for insert with check (auth.uid() = id);
create policy "users: update own" on users for update using (auth.uid() = id);

-- ───── GROUPS ────────────────────────────────────────────────────
create table groups (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  created_by      uuid references users(id),
  created_at      timestamptz default now()
);

create table group_members (
  group_id        uuid references groups(id) on delete cascade,
  user_id         uuid references users(id) on delete cascade,
  joined_at       timestamptz default now(),
  primary key (group_id, user_id)
);

create table group_taste_tags (
  group_id        uuid references groups(id) on delete cascade,
  tag             text,
  primary key (group_id, tag)
);

-- ───── FILMS — readable by all, writable by any authenticated user ─
create table films (
  id              text primary key,
  kind            text check (kind in ('movie', 'tv')),
  tmdb_id         int not null,
  title           text not null,
  year            int,
  director        text,
  poster_path     text,
  backdrop_path   text,
  synopsis        text,
  runtime_minutes int,
  cast_json       jsonb,
  keywords        text[],
  fetched_at      timestamptz default now()
);

alter table films enable row level security;
create policy "films: readable by all" on films for select using (true);
create policy "films: writable by authenticated" on films for insert with check (auth.role() = 'authenticated');
create policy "films: updatable by authenticated" on films for update using (auth.role() = 'authenticated');

-- ───── LIBRARY ENTRIES ───────────────────────────────────────────
create table library_entries (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references users(id) on delete cascade,
  film_id         text references films(id),
  list            text check (list in ('watched', 'now_playing', 'watchlist')) not null,
  audience        text[] not null default array['me']::text[],
  my_stars        numeric(2,1),
  my_line         text,
  moods           text[],
  why             text,
  started_at      timestamptz,
  live_notes      jsonb,
  added_at        timestamptz default now(),
  finished_at     timestamptz,
  unique (user_id, film_id, list)
);

alter table library_entries enable row level security;
create policy "own library" on library_entries for all using (auth.uid() = user_id);

-- ───── INTERVIEWS ────────────────────────────────────────────────
create table interviews (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references users(id) on delete cascade,
  film_id         text references films(id),
  group_id        uuid references groups(id),
  interviewer     text check (interviewer in ('warm','blunt','playful','cinephile')),
  depth           text check (depth in ('short','medium','long')),
  transcript      jsonb not null,
  taste_tags      text[],
  reflection      jsonb,
  created_at      timestamptz default now()
);

alter table interviews enable row level security;
create policy "own interviews" on interviews for all using (auth.uid() = user_id);

-- ───── RECOMMENDATIONS ───────────────────────────────────────────
create table recommendations (
  id              uuid primary key default gen_random_uuid(),
  group_id        uuid references groups(id) on delete cascade,
  film_id         text references films(id),
  from_user_id    uuid references users(id),
  status          text check (status in ('saved','now-playing','finished')) not null,
  note            text,
  created_at      timestamptz default now()
);

create table recommendation_reactions (
  rec_id          uuid references recommendations(id) on delete cascade,
  user_id         uuid references users(id) on delete cascade,
  kind            text check (kind in ('want','saw')) not null,
  at              timestamptz default now(),
  primary key (rec_id, user_id, kind)
);

create table recommendation_replies (
  id              uuid primary key default gen_random_uuid(),
  rec_id          uuid references recommendations(id) on delete cascade,
  user_id         uuid references users(id) on delete cascade,
  text            text not null,
  at              timestamptz default now()
);

create table recommendation_events (
  id              uuid primary key default gen_random_uuid(),
  rec_id          uuid references recommendations(id) on delete cascade,
  user_id         uuid references users(id),
  type            text not null,
  at              timestamptz default now()
);

-- ───── TASTE PROFILE ─────────────────────────────────────────────
create table user_taste_tags (
  user_id         uuid references users(id) on delete cascade,
  tag             text,
  weight          int default 1,
  primary key (user_id, tag)
);

alter table user_taste_tags enable row level security;
create policy "own taste tags" on user_taste_tags for all using (auth.uid() = user_id);

-- ───── DISMISSED RECOMMENDATIONS ─────────────────────────────────
create table dismissed_recs (
  user_id         uuid references users(id) on delete cascade,
  rec_id          uuid references recommendations(id) on delete cascade,
  at              timestamptz default now(),
  primary key (user_id, rec_id)
);

alter table dismissed_recs enable row level security;
create policy "own dismissed" on dismissed_recs for all using (auth.uid() = user_id);

-- ───── NOTIFICATIONS ─────────────────────────────────────────────
create table notifications (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references users(id) on delete cascade,
  kind            text not null,
  by_user_id      uuid references users(id),
  group_id        uuid references groups(id),
  ref_type        text,
  ref_id          text,
  summary         text not null,
  read            boolean default false,
  at              timestamptz default now()
);

alter table notifications enable row level security;
create policy "own notifications" on notifications for all using (auth.uid() = user_id);

-- ───── HELPER FUNCTIONS ──────────────────────────────────────────
create or replace function increment_taste_tag(p_user_id uuid, p_tag text)
returns void language sql as $$
  update user_taste_tags
  set weight = weight + 1
  where user_id = p_user_id and tag = p_tag;
$$;
