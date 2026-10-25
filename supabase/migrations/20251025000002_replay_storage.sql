-- OptiFlow Supabase migration 0002 — private replay storage.
-- Mesh replay is stored ONLY when the user opts in (preferences.saveReplay).
-- Objects live under <user_id>/<client_session_id>.json in a PRIVATE bucket,
-- so no signed URL or public link ever exposes another user's replay.
-- If your project already has a bucket named "replays", the insert is skipped.

insert into storage.buckets (id, name, public)
values ('replays', 'replays', false)
on conflict (id) do nothing;

-- Storage RLS (storage.objects has RLS enabled by Supabase by default).
-- foldername(name)[1] is the first path segment = the owner's user id.
create policy "replays: owner read" on storage.objects
  for select using (bucket_id = 'replays' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "replays: owner insert" on storage.objects
  for insert with check (bucket_id = 'replays' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "replays: owner update" on storage.objects
  for update using (bucket_id = 'replays' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'replays' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "replays: owner delete" on storage.objects
  for delete using (bucket_id = 'replays' and (storage.foldername(name))[1] = auth.uid()::text);
