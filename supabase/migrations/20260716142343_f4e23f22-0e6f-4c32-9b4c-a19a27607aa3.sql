
CREATE POLICY "Admins read talk buckets"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id IN ('avatars','post-media','post-covers') AND public.has_role(auth.uid(),'admin'));

CREATE POLICY "Admins write talk buckets"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id IN ('avatars','post-media','post-covers') AND public.has_role(auth.uid(),'admin'));

CREATE POLICY "Admins update talk buckets"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id IN ('avatars','post-media','post-covers') AND public.has_role(auth.uid(),'admin'));

CREATE POLICY "Admins delete talk buckets"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id IN ('avatars','post-media','post-covers') AND public.has_role(auth.uid(),'admin'));
