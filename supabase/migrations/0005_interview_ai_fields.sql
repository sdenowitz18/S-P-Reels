-- Add AI rating suggestion and sentiment tags to interviews
alter table interviews
  add column if not exists ai_rating jsonb,
  add column if not exists sentiment_tags jsonb;
