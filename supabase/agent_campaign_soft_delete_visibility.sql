-- Binned records stay queryable by administrators only.

drop policy if exists agent_campaign_agents_select on public.agent_campaign_agents;
create policy agent_campaign_agents_select
  on public.agent_campaign_agents for select to authenticated
  using (
    (select public.agent_campaign_module_access())
    and (deleted_at is null or (select public.agent_campaign_is_admin()))
  );

drop policy if exists agent_campaign_agents_update on public.agent_campaign_agents;
create policy agent_campaign_agents_update
  on public.agent_campaign_agents for update to authenticated
  using (
    (select public.agent_campaign_module_access())
    and (deleted_at is null or (select public.agent_campaign_is_admin()))
  )
  with check (
    (select public.agent_campaign_module_access())
    and (deleted_at is null or (select public.agent_campaign_is_admin()))
  );

drop policy if exists agent_campaign_campaigns_select on public.agent_campaign_campaigns;
create policy agent_campaign_campaigns_select
  on public.agent_campaign_campaigns for select to authenticated
  using (
    (select public.agent_campaign_module_access())
    and (deleted_at is null or (select public.agent_campaign_is_admin()))
  );

drop policy if exists agent_campaign_campaigns_update on public.agent_campaign_campaigns;
create policy agent_campaign_campaigns_update
  on public.agent_campaign_campaigns for update to authenticated
  using (
    (select public.agent_campaign_module_access())
    and (deleted_at is null or (select public.agent_campaign_is_admin()))
  )
  with check (
    (select public.agent_campaign_module_access())
    and (deleted_at is null or (select public.agent_campaign_is_admin()))
  );

create index if not exists agent_campaign_agents_deleted_by_idx
  on public.agent_campaign_agents(deleted_by);
create index if not exists agent_campaign_campaigns_deleted_by_idx
  on public.agent_campaign_campaigns(deleted_by);

