
DROP POLICY IF EXISTS "delivery_slots public read" ON public.delivery_slots;
DROP POLICY IF EXISTS "design_slots public read" ON public.design_slots;

CREATE POLICY "delivery_slots admin read"
  ON public.delivery_slots
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "design_slots admin read"
  ON public.design_slots
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

REVOKE SELECT ON public.delivery_slots FROM anon;
REVOKE SELECT ON public.design_slots FROM anon;
