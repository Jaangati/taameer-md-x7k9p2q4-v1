-- Keep daily accountability focused on visible campaigns for active roster members.

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
  join public.agent_campaign_agents a on a.id = c.agent_id
  cross join lateral generate_series(
    greatest(coalesce(c.start_date, c.created_at::date), date_trunc('month', current_date)::date),
    least(coalesce(c.end_date, current_date), current_date),
    interval '1 day'
  ) d
  where c.status in ('active', 'learning')
    and c.deleted_at is null
    and a.deleted_at is null
    and coalesce(c.end_date, current_date) >= date_trunc('month', current_date)::date
    and coalesce(c.start_date, c.created_at::date) <= current_date
  on conflict (campaign_id, checkin_date) do nothing;
end;
$$;

revoke all on function public.agent_campaign_sync_daily_checkins() from public, anon;
grant execute on function public.agent_campaign_sync_daily_checkins() to authenticated;

