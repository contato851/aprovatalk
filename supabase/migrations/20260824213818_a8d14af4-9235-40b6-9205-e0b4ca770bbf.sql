CREATE TABLE public.scripts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT '',
  script_date date,
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.scripts TO authenticated;
GRANT ALL ON public.scripts TO service_role;
ALTER TABLE public.scripts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "scripts team read" ON public.scripts FOR SELECT TO authenticated
USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'designer'::app_role) OR has_role(auth.uid(),'editor'::app_role));
CREATE POLICY "scripts team insert" ON public.scripts FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'designer'::app_role) OR has_role(auth.uid(),'editor'::app_role));
CREATE POLICY "scripts team update" ON public.scripts FOR UPDATE TO authenticated
USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'designer'::app_role) OR has_role(auth.uid(),'editor'::app_role))
WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'designer'::app_role) OR has_role(auth.uid(),'editor'::app_role));
CREATE POLICY "scripts team delete" ON public.scripts FOR DELETE TO authenticated
USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'designer'::app_role) OR has_role(auth.uid(),'editor'::app_role));

CREATE TRIGGER scripts_set_updated_at BEFORE UPDATE ON public.scripts
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.script_scenes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  script_id uuid NOT NULL REFERENCES public.scripts(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0,
  scene text NOT NULL DEFAULT '',
  soundtrack text NOT NULL DEFAULT '',
  lettering text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.script_scenes TO authenticated;
GRANT ALL ON public.script_scenes TO service_role;
ALTER TABLE public.script_scenes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "script_scenes team read" ON public.script_scenes FOR SELECT TO authenticated
USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'designer'::app_role) OR has_role(auth.uid(),'editor'::app_role));
CREATE POLICY "script_scenes team insert" ON public.script_scenes FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'designer'::app_role) OR has_role(auth.uid(),'editor'::app_role));
CREATE POLICY "script_scenes team update" ON public.script_scenes FOR UPDATE TO authenticated
USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'designer'::app_role) OR has_role(auth.uid(),'editor'::app_role))
WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'designer'::app_role) OR has_role(auth.uid(),'editor'::app_role));
CREATE POLICY "script_scenes team delete" ON public.script_scenes FOR DELETE TO authenticated
USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'designer'::app_role) OR has_role(auth.uid(),'editor'::app_role));

CREATE TRIGGER script_scenes_set_updated_at BEFORE UPDATE ON public.script_scenes
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX script_scenes_script_id_idx ON public.script_scenes(script_id);
CREATE INDEX scripts_client_id_idx ON public.scripts(client_id);

ALTER TABLE public.delivery_slots ADD COLUMN script_id uuid REFERENCES public.scripts(id) ON DELETE SET NULL;

CREATE POLICY "clients team read" ON public.clients FOR SELECT TO authenticated
USING (has_role(auth.uid(),'designer'::app_role) OR has_role(auth.uid(),'editor'::app_role));