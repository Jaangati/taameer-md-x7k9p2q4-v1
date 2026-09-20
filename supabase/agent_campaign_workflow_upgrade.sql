-- Agent Campaigns workflow upgrade: account readiness, flexible planning periods,
-- and durable campaign check-in history.

alter table public.agent_campaign_accounts
  add column if not exists starting_posts_setup_done boolean not null default false,
  add column if not exists job_title_added boolean not null default false,
  add column if not exists ads_manager_linked boolean not null default false;

alter table public.agent_campaign_months
  add column if not exists period_label text,
  add column if not exists period_start date,
  add column if not exists period_end date;

update public.agent_campaign_months
set period_label = coalesce(period_label, to_char(month_start, 'FMMonth YYYY')),
    period_start = coalesce(period_start, month_start),
    period_end = coalesce(period_end, (month_start + interval '1 month - 1 day')::date)
where period_label is null or period_start is null or period_end is null;

alter table public.agent_campaign_months
  alter column period_start set default current_date,
  add constraint agent_campaign_period_dates_check
    check (period_end is null or period_start is null or period_end >= period_start);

create table if not exists public.agent_campaign_status_updates (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.agent_campaign_campaigns(id) on delete cascade,
  status text not null check (status in ('draft','scheduled','active','learning','paused','completed','cancelled')),
  summary text not null check (char_length(btrim(summary)) between 2 and 240),
  changes text[] not null default '{}',
  notes text,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists agent_campaign_status_updates_campaign_idx
  on public.agent_campaign_status_updates(campaign_id, created_at desc);
create index if not exists agent_campaign_status_updates_created_by_idx
  on public.agent_campaign_status_updates(created_by);

alter table public.agent_campaign_status_updates enable row level security;

drop policy if exists agent_campaign_status_updates_select on public.agent_campaign_status_updates;
create policy agent_campaign_status_updates_select
  on public.agent_campaign_status_updates for select to authenticated
  using ((select public.agent_campaign_module_access()));

drop policy if exists agent_campaign_status_updates_insert on public.agent_campaign_status_updates;
create policy agent_campaign_status_updates_insert
  on public.agent_campaign_status_updates for insert to authenticated
  with check ((select public.agent_campaign_module_access()) and created_by = (select auth.uid()));

drop policy if exists agent_campaign_status_updates_update on public.agent_campaign_status_updates;
create policy agent_campaign_status_updates_update
  on public.agent_campaign_status_updates for update to authenticated
  using ((select public.agent_campaign_module_access()))
  with check ((select public.agent_campaign_module_access()));

drop policy if exists agent_campaign_status_updates_delete on public.agent_campaign_status_updates;
create policy agent_campaign_status_updates_delete
  on public.agent_campaign_status_updates for delete to authenticated
  using ((select public.agent_campaign_module_access()));

grant select, insert, update, delete on public.agent_campaign_status_updates to authenticated;
revoke all on public.agent_campaign_status_updates from anon;
