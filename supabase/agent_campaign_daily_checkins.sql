-- Daily accountability for active agent campaigns and automatic calendar months.

create table if not exists public.agent_campaign_daily_checkins (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.agent_campaign_campaigns(id) on delete cascade,
  checkin_date date not null,
  state text not null default 'due' check (state in ('due', 'missed', 'completed')),
  status_update_id uuid references public.agent_campaign_status_updates(id) on delete set null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (campaign_id, checkin_date)
);

create index if not exists agent_campaign_daily_campaign_date_idx
  on public.agent_campaign_daily_checkins(campaign_id, checkin_date desc);
create index if not exists agent_campaign_daily_state_date_idx
  on public.agent_campaign_daily_checkins(state, checkin_date desc);
create index if not exists agent_campaign_daily_status_update_idx
  on public.agent_campaign_daily_checkins(status_update_id)
  where status_update_id is not null;

alter table public.agent_campaign_daily_checkins enable row level security;

drop policy if exists agent_campaign_daily_select on public.agent_campaign_daily_checkins;
create policy agent_campaign_daily_select
  on public.agent_campaign_daily_checkins for select to authenticated
  using ((select public.agent_campaign_module_access()));

drop policy if exists agent_campaign_daily_insert on public.agent_campaign_daily_checkins;
create policy agent_campaign_daily_insert
  on public.agent_campaign_daily_checkins for insert to authenticated
  with check ((select public.agent_campaign_module_access()));

drop policy if exists agent_campaign_daily_update on public.agent_campaign_daily_checkins;
create policy agent_campaign_daily_update
  on public.agent_campaign_daily_checkins for update to authenticated
  using ((select public.agent_campaign_module_access()))
  with check ((select public.agent_campaign_module_access()));

drop policy if exists agent_campaign_daily_delete on public.agent_campaign_daily_checkins;
create policy agent_campaign_daily_delete
  on public.agent_campaign_daily_checkins for delete to authenticated
  using ((select public.agent_campaign_module_access()));

grant select, insert, update, delete on public.agent_campaign_daily_checkins to authenticated;
revoke all on public.agent_campaign_daily_checkins from anon;

create or replace function public.agent_campaign_sync_daily_checkins()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not public.agent_campaign_module_access() then
    raise exception 'Not authorized';
  end if;

  insert into public.agent_campaign_months (
    month_start, period_label, period_start, period_end, total_budget, status, created_by, updated_by
  )
  values (
    date_trunc('month', current_date)::date,
    to_char(current_date, 'FMMonth YYYY'),
    date_trunc('month', current_date)::date,
    (date_trunc('month', current_date) + interval '1 month - 1 day')::date,
    0, 'planning', auth.uid(), auth.uid()
  )
  on conflict (month_start) do nothing;

  update public.agent_campaign_daily_checkins
  set state = 'missed'
  where state = 'due' and checkin_date < current_date;

  insert into public.agent_campaign_daily_checkins (campaign_id, checkin_date, state)
  select c.id,
         d::date,
         case when d::date < current_date then 'missed' else 'due' end
  from public.agent_campaign_campaigns c
  cross join lateral generate_series(
    greatest(coalesce(c.start_date, c.created_at::date), date_trunc('month', current_date)::date),
    least(coalesce(c.end_date, current_date), current_date),
    interval '1 day'
  ) d
  where c.status in ('active', 'learning')
    and coalesce(c.end_date, current_date) >= date_trunc('month', current_date)::date
    and coalesce(c.start_date, c.created_at::date) <= current_date
  on conflict (campaign_id, checkin_date) do nothing;
end;
$$;

revoke all on function public.agent_campaign_sync_daily_checkins() from public;
revoke all on function public.agent_campaign_sync_daily_checkins() from anon;
grant execute on function public.agent_campaign_sync_daily_checkins() to authenticated;
