ALTER TABLE public.scripts ADD COLUMN IF NOT EXISTS post_id uuid REFERENCES public.posts(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS scripts_post_id_idx ON public.scripts(post_id);