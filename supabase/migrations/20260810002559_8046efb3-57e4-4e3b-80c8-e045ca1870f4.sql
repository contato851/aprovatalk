ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS planning_title text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS briefing text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS script text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS internal_status text NOT NULL DEFAULT 'draft';

UPDATE public.posts SET planning_title = caption WHERE planning_title = '' AND caption <> '';