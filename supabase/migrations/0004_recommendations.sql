drop table if exists notifications cascade;
drop table if exists rec_comments cascade;
drop table if exists recommendations cascade;

create table recommendations (
  id              uuid primary key default gen_random_uuid(),
  from_user_id    uuid references users(id) on delete cascade not null,
  to_user_id      uuid references users(id) on delete cascade not null,
  film_id         text references films(id) not null,
  note            text,
  created_at      timestamptz default now()
);

alter table recommendations enable row level security;

create policy "recs: sender access" on recommendations
  for all using (auth.uid() = from_user_id);

create policy "recs: recipient read" on recommendations
  for select using (auth.uid() = to_user_id);

create table rec_comments (
  id              uuid primary key default gen_random_uuid(),
  rec_id          uuid references recommendations(id) on delete cascade not null,
  user_id         uuid references users(id) on delete cascade not null,
  text            text not null,
  created_at      timestamptz default now()
);

alter table rec_comments enable row level security;

create policy "rec_comments: participants" on rec_comments
  for all using (
    auth.uid() = rec_comments.user_id or
    exists (
      select 1 from recommendations r
      where r.id = rec_comments.rec_id
        and (r.from_user_id = auth.uid() or r.to_user_id = auth.uid())
    )
  );

create table notifications (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references users(id) on delete cascade not null,
  type            text not null,
  rec_id          uuid references recommendations(id) on delete cascade,
  from_user_id    uuid references users(id) on delete set null,
  read            boolean default false not null,
  created_at      timestamptz default now()
);

alter table notifications enable row level security;

create policy "notifications: own" on notifications
  for all using (auth.uid() = user_id);
