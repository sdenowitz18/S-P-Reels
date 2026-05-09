-- Allow 'dismissed' as a valid library list value
-- Also adds dismiss_reason column for storing why a film was dismissed

ALTER TABLE library_entries
  DROP CONSTRAINT IF EXISTS library_entries_list_check;

ALTER TABLE library_entries
  ADD CONSTRAINT library_entries_list_check
  CHECK (list IN ('watched', 'now_playing', 'watchlist', 'dismissed'));

ALTER TABLE library_entries
  ADD COLUMN IF NOT EXISTS dismiss_reason text;
