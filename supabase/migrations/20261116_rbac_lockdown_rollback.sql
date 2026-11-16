-- Restores the access rules that existed before 20261116_rbac_lockdown.sql
-- (the policies in supabase/schema.sql as first created). Only needed if the
-- old, direct-from-the-browser version of the app has to come back.

grant all on public.jobs to anon, authenticated;
grant all on public.profiles to anon, authenticated;

drop policy if exists "Any signed-in user can view all jobs" on public.jobs;
create policy "Any signed-in user can view all jobs"
  on public.jobs for select to authenticated using (true);

drop policy if exists "Users can insert their own jobs" on public.jobs;
create policy "Users can insert their own jobs"
  on public.jobs for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own jobs" on public.jobs;
create policy "Users can delete their own jobs"
  on public.jobs for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "Any signed-in user can read job PDFs" on storage.objects;
create policy "Any signed-in user can read job PDFs"
  on storage.objects for select to authenticated using (bucket_id = 'job-pdfs');

drop policy if exists "Users can upload their own job PDFs" on storage.objects;
create policy "Users can upload their own job PDFs"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'job-pdfs' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users can delete their own job PDFs" on storage.objects;
create policy "Users can delete their own job PDFs"
  on storage.objects for delete to authenticated
  using (bucket_id = 'job-pdfs' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users can view their own profile" on public.profiles;
drop policy if exists "Profiles are viewable by any signed-in user" on public.profiles;
create policy "Profiles are viewable by any signed-in user"
  on public.profiles for select to authenticated using (true);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'jobs'
  ) then
    alter publication supabase_realtime add table public.jobs;
  end if;
end $$;

drop trigger if exists block_new_password_signups_trigger on auth.users;
drop function if exists public.block_new_password_signups();
