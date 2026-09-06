-- TAAMEER Marketing Dashboard - Supabase Auth migration
-- Run this in Supabase SQL Editor BEFORE enabling the new auth flow.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  full_name text not null default '',
  job_title text,
  email text,
  phone text,
  role text not null default 'user' check (role in ('admin','user')),
  status text not null default 'active' check (status in ('active','inactive','suspended')),
  avatar text,
  accent_color text,
  modules jsonb not null default '[]'::jsonb,
  last_login timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

drop policy if exists "profiles_select_own_or_admin" on public.profiles;
create policy "profiles_select_own_or_admin"
on public.profiles for select
using (id = auth.uid() or public.current_user_role() = 'admin');

drop policy if exists "profiles_update_own_or_admin" on public.profiles;
create policy "profiles_update_own_or_admin"
on public.profiles for update
using (id = auth.uid() or public.current_user_role() = 'admin')
with check (id = auth.uid() or public.current_user_role() = 'admin');

-- Existing app_data can remain temporarily while modules/settings are migrated.
-- IMPORTANT: once Auth migration is complete, remove passwords from app_data users records.
