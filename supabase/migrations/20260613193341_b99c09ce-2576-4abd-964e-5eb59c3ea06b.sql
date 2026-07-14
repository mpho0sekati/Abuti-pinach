
CREATE POLICY "listing photos read all auth" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'listing-photos');
CREATE POLICY "listing photos insert own folder" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'listing-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "listing photos update own" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'listing-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "listing photos delete own" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'listing-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
