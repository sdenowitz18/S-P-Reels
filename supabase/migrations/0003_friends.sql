-- Add rewatch field to library_entries
alter table library_entries add column if not exists rewatch text check (rewatch in ('yes', 'maybe', 'no'));

-- Friend requests table
create table if not exists friend_requests (
  id              uuid primary key default gen_random_uuid(),
  from_user_id    uuid references users(id) on delete cascade not null,
  to_email        text not null,
  to_user_id      uuid references users(id) on delete cascade,
  status          text check (status in ('pending', 'accepted', 'declined')) default 'pending' not null,
  created_at      timestamptz default now(),
  unique (from_user_id, to_email)
);

alter table friend_requests enable row level security;

-- sender can see & create their own requests
create policy "friend_requests: sender access" on friend_requests
  for all using (auth.uid() = from_user_id);

-- recipient can see requests addressed to them (matched by user_id after signup)
create policy "friend_requests: recipient read" on friend_requests
  for select using (auth.uid() = to_user_id);

-- recipient can accept/decline
create policy "friend_requests: recipient update" on friend_requests
  for update using (auth.uid() = to_user_id);

-- When a new user joins, link any pending friend requests to their account
-- (call this from the app layer on signup / first login)
