-- Add comment_public field to library_entries
-- Defaults to false (private). Users must opt-in to make comments public.
-- Public comments appear on the friend activity feed.

ALTER TABLE library_entries
  ADD COLUMN IF NOT EXISTS comment_public boolean NOT NULL DEFAULT false;
