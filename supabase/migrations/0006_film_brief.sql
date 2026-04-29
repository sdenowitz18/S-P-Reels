-- Add AI-generated brief to films table
alter table films
  add column if not exists ai_brief jsonb,
  add column if not exists brief_at  timestamptz;
