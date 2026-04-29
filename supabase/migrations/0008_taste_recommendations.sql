-- Caches AI-generated taste recommendations per user so the page loads instantly.
-- Regenerated on demand (refresh button) or when stale.
create table if not exists taste_recommendations (
  user_id   uuid primary key references auth.users(id) on delete cascade,
  films     jsonb        not null default '[]',
  generated_at timestamptz not null default now()
);

alter table taste_recommendations enable row level security;

create policy "users manage own taste recommendations"
  on taste_recommendations for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
