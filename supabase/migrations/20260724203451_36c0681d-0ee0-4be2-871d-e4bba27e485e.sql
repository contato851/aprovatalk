
CREATE TABLE public.delivery_slots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slot_date DATE NOT NULL,
  slot_index SMALLINT NOT NULL CHECK (slot_index >= 0 AND slot_index < 5),
  client TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL DEFAULT '',
  folder_link TEXT NOT NULL DEFAULT '',
  done BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (slot_date, slot_index)
);

CREATE INDEX delivery_slots_date_idx ON public.delivery_slots (slot_date);

GRANT SELECT ON public.delivery_slots TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.delivery_slots TO authenticated;
GRANT ALL ON public.delivery_slots TO service_role;

ALTER TABLE public.delivery_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "delivery_slots public read" ON public.delivery_slots
  FOR SELECT USING (true);
CREATE POLICY "delivery_slots admin insert" ON public.delivery_slots
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "delivery_slots admin update" ON public.delivery_slots
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "delivery_slots admin delete" ON public.delivery_slots
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER delivery_slots_updated_at
BEFORE UPDATE ON public.delivery_slots
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
