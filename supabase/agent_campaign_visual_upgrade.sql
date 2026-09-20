-- Agent Campaigns visual-directory upgrade: public profile imagery with protected writes.
-- Profile photographs are public-facing sales-agent imagery. Upload, update and delete
-- remain restricted to authenticated users who have access to the module.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'agent-campaign-photos',
  'agent-campaign-photos',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists agent_campaign_photos_insert on storage.objects;
create policy agent_campaign_photos_insert
on storage.objects for insert to authenticated
with check (
  bucket_id = 'agent-campaign-photos'
  and (select public.agent_campaign_module_access())
);

drop policy if exists agent_campaign_photos_update on storage.objects;
create policy agent_campaign_photos_update
on storage.objects for update to authenticated
using (
  bucket_id = 'agent-campaign-photos'
  and (select public.agent_campaign_module_access())
)
with check (
  bucket_id = 'agent-campaign-photos'
  and (select public.agent_campaign_module_access())
);

drop policy if exists agent_campaign_photos_delete on storage.objects;
create policy agent_campaign_photos_delete
on storage.objects for delete to authenticated
using (
  bucket_id = 'agent-campaign-photos'
  and (select public.agent_campaign_module_access())
);
