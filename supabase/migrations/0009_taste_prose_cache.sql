-- Cache the AI-generated taste prose so it doesn't regenerate on every page load.
-- taste_prose_film_count stores how many rated+dimensioned films existed when the
-- prose was last generated. If the count changes, the route regenerates it.

alter table users
  add column if not exists taste_prose            text,
  add column if not exists taste_prose_film_count integer;
