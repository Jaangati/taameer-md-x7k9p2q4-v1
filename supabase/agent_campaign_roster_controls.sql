-- Agent Campaigns roster lifecycle, readiness reconciliation and protected deletion.

alter table public.agent_campaign_agents
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references public.profiles(id) on delete set null;

alter table public.agent_campaign_campaigns
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references public.profiles(id) on delete set null;

create index if not exists agent_campaign_agents_deleted_at_idx
  on public.agent_campaign_agents(deleted_at);
create index if not exists agent_campaign_campaigns_deleted_at_idx
  on public.agent_campaign_campaigns(deleted_at);
create unique index if not exists agent_campaign_agents_phone_unique
  on public.agent_campaign_agents(regexp_replace(work_phone, '[^0-9+]', '', 'g'))
  where nullif(regexp_replace(work_phone, '[^0-9+]', '', 'g'), '') is not null;

create or replace function public.agent_campaign_is_admin()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  );
$$;

create or replace function public.agent_campaign_protect_deleted_fields()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if (old.deleted_at is distinct from new.deleted_at
      or old.deleted_by is distinct from new.deleted_by)
     and not (select public.agent_campaign_is_admin()) then
    raise exception 'Only administrators can delete or restore records';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_agent_campaign_agent_deletion on public.agent_campaign_agents;
create trigger protect_agent_campaign_agent_deletion
before update of deleted_at, deleted_by on public.agent_campaign_agents
for each row execute function public.agent_campaign_protect_deleted_fields();

drop trigger if exists protect_agent_campaign_campaign_deletion on public.agent_campaign_campaigns;
create trigger protect_agent_campaign_campaign_deletion
before update of deleted_at, deleted_by on public.agent_campaign_campaigns
for each row execute function public.agent_campaign_protect_deleted_fields();

drop policy if exists agent_campaign_agents_delete on public.agent_campaign_agents;
create policy agent_campaign_agents_delete
  on public.agent_campaign_agents for delete to authenticated
  using ((select public.agent_campaign_is_admin()));

drop policy if exists agent_campaign_campaigns_delete on public.agent_campaign_campaigns;
create policy agent_campaign_campaigns_delete
  on public.agent_campaign_campaigns for delete to authenticated
  using ((select public.agent_campaign_is_admin()));

create or replace function public.agent_campaign_reconcile_account_status()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  complete boolean;
begin
  complete := new.two_factor_enabled
    and new.credentials_saved
    and new.profile_picture_approved
    and new.starting_posts_setup_done
    and new.bio_added_correctly
    and new.job_title_added
    and new.agent_informed
    and new.ads_manager_linked;

  if complete and new.status <> 'campaign_active' then
    new.status := 'ready';
  elsif not complete and new.status = 'ready' then
    new.status := 'under_setup';
  end if;
  return new;
end;
$$;

drop trigger if exists reconcile_agent_campaign_account_status on public.agent_campaign_accounts;
create trigger reconcile_agent_campaign_account_status
before insert or update on public.agent_campaign_accounts
for each row execute function public.agent_campaign_reconcile_account_status();

update public.agent_campaign_accounts
set status = case
  when two_factor_enabled
    and credentials_saved
    and profile_picture_approved
    and starting_posts_setup_done
    and bio_added_correctly
    and job_title_added
    and agent_informed
    and ads_manager_linked
    and status <> 'campaign_active' then 'ready'
  when status = 'ready' then 'under_setup'
  else status
end;

grant execute on function public.agent_campaign_is_admin() to authenticated;
revoke all on function public.agent_campaign_is_admin() from public, anon;

