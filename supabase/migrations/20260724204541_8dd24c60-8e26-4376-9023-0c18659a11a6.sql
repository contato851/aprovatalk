
CREATE TABLE public.design_slots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slot_date DATE NOT NULL,
  slot_index SMALLINT NOT NULL CHECK (slot_index >= 0 AND slot_index < 5),
  client TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL DEFAULT '',
  folder_link TEXT NOT NULL DEFAULT '',
  briefing TEXT NOT NULL DEFAULT '',
  copy TEXT NOT NULL DEFAULT '',
  references_images TEXT[] NOT NULL DEFAULT '{}',
  done BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (slot_date, slot_index)
);

CREATE INDEX design_slots_date_idx ON public.design_slots (slot_date);

GRANT SELECT ON public.design_slots TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.design_slots TO authenticated;
GRANT ALL ON public.design_slots TO service_role;

ALTER TABLE public.design_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "design_slots public read" ON public.design_slots FOR SELECT USING (true);
CREATE POLICY "design_slots admin insert" ON public.design_slots FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "design_slots admin update" ON public.design_slots FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "design_slots admin delete" ON public.design_slots FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER design_slots_updated_at
BEFORE UPDATE ON public.design_slots
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY "design-references authenticated read" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'design-references');
CREATE POLICY "design-references admin insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'design-references' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "design-references admin delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'design-references' AND public.has_role(auth.uid(), 'admin'));
