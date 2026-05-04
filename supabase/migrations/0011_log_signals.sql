-- ── Phase 2: Log signal fields on library_entries ─────────────────────────────
--
-- Adds per-log signal data to library_entries.
-- Card 2 (rewatch), Card 3 (fit check), and the computed prediction/delta fields
-- are all stored here alongside the existing my_stars / my_line / moods columns.
--
-- rewatch:             null = skipped, true = yes, false = no
-- rewatch_score:       0–10 integer, null if rewatch is false or skipped
-- fit_answer:          Card 3 primary answer
-- fit_dimension:       Card 3 follow-up — dimension key selected (e.g. 'kinetic_vs_patient')
-- fit_pole:            Card 3 follow-up — 'left' or 'right'
-- match_score_at_log:  0–100 match score computed before the user rated
-- predicted_stars:     μ + predicted_z × σ, clamped 0.5–5.0
-- delta_stars:         actual_stars − predicted_stars
-- delta_z:             delta_stars / σ
-- user_mu_at_log:      snapshot of user's mean rating at time of log
-- user_sigma_at_log:   snapshot of user's σ at time of log
-- taste_code_before:   taste code state immediately before this log
-- taste_code_after:    taste code state immediately after this log

alter table library_entries
  add column if not exists rewatch              boolean,
  add column if not exists rewatch_score        smallint check (rewatch_score >= 0 and rewatch_score <= 10),
  add column if not exists fit_answer           text check (fit_answer in ('yes', 'surprisingly_yes', 'surprisingly_no', 'no')),
  add column if not exists fit_dimension        text,
  add column if not exists fit_pole             text check (fit_pole in ('left', 'right')),
  add column if not exists match_score_at_log   smallint check (match_score_at_log >= 0 and match_score_at_log <= 100),
  add column if not exists predicted_stars      numeric(3,2),
  add column if not exists delta_stars          numeric(4,2),
  add column if not exists delta_z              numeric(5,3),
  add column if not exists user_mu_at_log       numeric(3,2),
  add column if not exists user_sigma_at_log    numeric(4,3),
  add column if not exists taste_code_before    jsonb,
  add column if not exists taste_code_after     jsonb;

-- Index for rewatchable filter: fetch user's rewatchable films sorted by score
create index if not exists idx_library_rewatch
  on library_entries (user_id, rewatch_score desc)
  where rewatch is true;
