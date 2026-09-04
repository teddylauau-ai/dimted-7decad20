alter table public.messages add column if not exists audio_url text;
alter table public.messages add column if not exists audio_ms integer;
alter table public.community_messages add column if not exists audio_url text;
alter table public.community_messages add column if not exists audio_ms integer;

create policy "voice readable by authenticated"
on storage.objects for select to authenticated
using (bucket_id = 'voice');

create policy "voice upload own folder"
on storage.objects for insert to authenticated
with check (bucket_id = 'voice' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "voice delete own folder"
on storage.objects for delete to authenticated
using (bucket_id = 'voice' and (storage.foldername(name))[1] = auth.uid()::text);