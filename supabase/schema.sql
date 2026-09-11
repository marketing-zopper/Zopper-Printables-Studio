-- Zopper Printables Studio — Supabase schema
-- Run this once in the Supabase SQL Editor (Dashboard -> SQL Editor -> New query).
-- Safe to re-run: uses IF NOT EXISTS / CREATE OR REPLACE / DROP ... IF EXISTS throughout.

-- ============================================================
-- 1. Profiles (one row per user, keyed to auth.users)
-- ============================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "Profiles are viewable by any signed-in user" on public.profiles;
create policy "Profiles are viewable by any signed-in user"
  on public.profiles for select
  to authenticated
  using (true);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ============================================================
-- 2. Restrict signup to @zopper.com — enforced server-side, so it
--    can't be bypassed by calling the Supabase API directly.
-- ============================================================
create or replace function public.enforce_zopper_email_domain()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.email !~* '^[a-zA-Z0-9._%+-]+@zopper\.com$' then
    raise exception 'Only @zopper.com email addresses are allowed to sign up.';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_zopper_email_domain_trigger on auth.users;
create trigger enforce_zopper_email_domain_trigger
  before insert on auth.users
  for each row execute function public.enforce_zopper_email_domain();

-- ============================================================
-- 3. Auto-create a profile row whenever a new user is created
--    (must be AFTER INSERT — the auth.users row must exist first
--    for the profiles foreign key to be satisfiable).
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- 4. Jobs (shared team-wide history: anyone signed in can see
--    every job; only the creator can delete their own)
-- ============================================================
create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_by_name text,
  created_by_email text,
  name text not null,
  created_at timestamptz not null default now(),
  page_count int,
  width_mm numeric,
  height_mm numeric,
  options jsonb not null default '{}'::jsonb,
  report jsonb not null default '{}'::jsonb,
  pdf_path text not null
);

alter table public.jobs enable row level security;

drop policy if exists "Any signed-in user can view all jobs" on public.jobs;
create policy "Any signed-in user can view all jobs"
  on public.jobs for select
  to authenticated
  using (true);

drop policy if exists "Users can insert their own jobs" on public.jobs;
create policy "Users can insert their own jobs"
  on public.jobs for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own jobs" on public.jobs;
create policy "Users can delete their own jobs"
  on public.jobs for delete
  to authenticated
  using (auth.uid() = user_id);

-- ============================================================
-- 5. Storage bucket for the actual PDF files
--    Path convention: job-pdfs/<user_id>/<job_id>.pdf
-- ============================================================
insert into storage.buckets (id, name, public)
values ('job-pdfs', 'job-pdfs', false)
on conflict (id) do nothing;

drop policy if exists "Any signed-in user can read job PDFs" on storage.objects;
create policy "Any signed-in user can read job PDFs"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'job-pdfs');

drop policy if exists "Users can upload their own job PDFs" on storage.objects;
create policy "Users can upload their own job PDFs"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'job-pdfs' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users can delete their own job PDFs" on storage.objects;
create policy "Users can delete their own job PDFs"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'job-pdfs' and (storage.foldername(name))[1] = auth.uid()::text);

-- ============================================================
-- 6. Realtime — so everyone's job list updates live, not just on refresh
-- ============================================================
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'jobs'
  ) then
    alter publication supabase_realtime add table public.jobs;
  end if;
end $$;
