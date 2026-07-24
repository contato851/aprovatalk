
CREATE TABLE public.post_adjustment_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  time_seconds numeric NOT NULL,
  note text NOT NULL DEFAULT '',
  frame_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX post_adjustment_points_post_id_idx ON public.post_adjustment_points(post_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.post_adjustment_points TO authenticated;
GRANT ALL ON public.post_adjustment_points TO service_role;

ALTER TABLE public.post_adjustment_points ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage post_adjustment_points"
ON public.post_adjustment_points
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
