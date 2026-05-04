-- Add critic/audience quality scores to films
alter table films
  add column if not exists imdb_id        text,
  add column if not exists imdb_rating    numeric(3,1),   -- 0.0–10.0
  add column if not exists rt_score       integer,        -- 0–100 (Rotten Tomatoes %)
  add column if not exists metacritic     integer,        -- 0–100
  add column if not exists scores_fetched_at timestamptz; -- when OMDB was last queried

create index if not exists idx_films_imdb_id on films(imdb_id);
