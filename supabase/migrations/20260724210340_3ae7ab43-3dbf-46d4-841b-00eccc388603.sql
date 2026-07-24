-- design_slots: allow designers full access
CREATE POLICY "design_slots designer read" ON public.design_slots FOR SELECT
  USING (public.has_role(auth.uid(), 'designer'));
CREATE POLICY "design_slots designer insert" ON public.design_slots FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'designer'));
CREATE POLICY "design_slots designer update" ON public.design_slots FOR UPDATE
  USING (public.has_role(auth.uid(), 'designer'))
  WITH CHECK (public.has_role(auth.uid(), 'designer'));
CREATE POLICY "design_slots designer delete" ON public.design_slots FOR DELETE
  USING (public.has_role(auth.uid(), 'designer'));

-- delivery_slots: allow editors full access
CREATE POLICY "delivery_slots editor read" ON public.delivery_slots FOR SELECT
  USING (public.has_role(auth.uid(), 'editor'));
CREATE POLICY "delivery_slots editor insert" ON public.delivery_slots FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'editor'));
CREATE POLICY "delivery_slots editor update" ON public.delivery_slots FOR UPDATE
  USING (public.has_role(auth.uid(), 'editor'))
  WITH CHECK (public.has_role(auth.uid(), 'editor'));
CREATE POLICY "delivery_slots editor delete" ON public.delivery_slots FOR DELETE
  USING (public.has_role(auth.uid(), 'editor'));

-- storage bucket design-references: allow designers to insert/delete
CREATE POLICY "design-references designer insert" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'design-references' AND public.has_role(auth.uid(), 'designer'));
CREATE POLICY "design-references designer delete" ON storage.objects FOR DELETE
  USING (bucket_id = 'design-references' AND public.has_role(auth.uid(), 'designer'));