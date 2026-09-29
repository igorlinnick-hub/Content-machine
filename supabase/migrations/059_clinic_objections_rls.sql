-- 056 shipped clinic_objections without RLS, leaving it readable and writable
-- with the public anon key. The app only touches it via the service role,
-- which bypasses RLS, so this closes the hole without changing app behavior.

alter table public.clinic_objections enable row level security;

drop policy if exists "clinic_isolation_clinic_objections" on public.clinic_objections;
create policy "clinic_isolation_clinic_objections" on public.clinic_objections
  for all using (clinic_id = nullif(current_setting('app.clinic_id', true), '')::uuid);
