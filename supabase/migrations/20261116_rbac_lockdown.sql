-- Printables Studio — move all job/PDF access behind the server (/api).
--
-- APPLY ONLY AFTER the Google-login / RBAC version of the app is deployed:
-- the previous version of the app reads and writes these tables directly from
-- the browser, and this migration removes that access.
--
-- After this, the only way to read, create, download or delete jobs is through
-- the /api functions, which verify the caller and check their role against the
-- central employee store (Upstash) on every request using the service-role key
-- (which bypasses RLS). With RLS enabled and no policy, `anon` and
-- `authenticated` get nothing — even with a valid session and the public key.
--
-- Nothing here deletes or modifies any row or file. Rollback:
-- 20261116_rbac_lockdown_rollback.sql

-- jobs: server only
drop policy if exists "Any signed-in user can view all jobs" on public.jobs;
drop policy if exists "Users can insert their own jobs" on public.jobs;
drop policy if exists "Users can delete their own jobs" on public.jobs;
alter table public.jobs enable row level security;
revoke all on public.jobs from anon, authenticated;

-- job-pdfs bucket: server only (downloads/uploads use short-lived signed URLs)
drop policy if exists "Any signed-in user can read job PDFs" on storage.objects;
drop policy if exists "Users can upload their own job PDFs" on storage.objects;
drop policy if exists "Users can delete their own job PDFs" on storage.objects;

-- profiles: a signed-in user can see their own row and change only their name
-- (no longer a directory of everyone's email addresses).
drop policy if exists "Profiles are viewable by any signed-in user" on public.profiles;
drop policy if exists "Users can view their own profile" on public.profiles;
create policy "Users can view their own profile"
  on public.profiles for select
  to authenticated
  using (auth.uid() = id);

revoke all on public.profiles from anon;
revoke insert, delete, truncate, references, trigger on public.profiles from authenticated;
revoke update on public.profiles from authenticated;
grant update (full_name, updated_at) on public.profiles to authenticated;

-- realtime: jobs changes are no longer streamed to browsers (the app polls /api)
do $$
begin
  if exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'jobs'
  ) then
    alter publication supabase_realtime drop table public.jobs;
  end if;
end $$;

-- Block brand-new email/password sign-ups. Email sign-up auto-confirms, so
-- someone could otherwise register a colleague's address with their own
-- password before that colleague first signs in with Google, and Google would
-- then link to the attacker's account. Existing email/password accounts keep
-- working (rollback path); Google sign-ups are unaffected.
create or replace function public.block_new_password_signups()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if coalesce(new.raw_app_meta_data->>'provider', 'email') = 'email' then
    raise exception 'New accounts are created with Google sign-in only.';
  end if;
  return new;
end;
$$;

drop trigger if exists block_new_password_signups_trigger on auth.users;
create trigger block_new_password_signups_trigger
  before insert on auth.users
  for each row execute function public.block_new_password_signups();
