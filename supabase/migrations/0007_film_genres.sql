-- Add TMDB genre labels to films (raw TMDB data, factual)
alter table films
  add column if not exists tmdb_genres text[];
