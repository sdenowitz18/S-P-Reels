-- Add TMDB vote data to films table
alter table films
  add column if not exists tmdb_vote_average numeric(4,1),
  add column if not exists tmdb_vote_count   integer;
