-- Replace the single ALL policy with explicit read/write policies.
-- Read policy is named so the access model is legible in the dashboard.

do $$
declare
  tables text[] := array['projects','analyses','files','edges','routes','explanations','file_roles','insights'];
  t text;
  org_claim text := '(select coalesce(auth.jwt() ->> ''org_id'', auth.jwt() -> ''o'' ->> ''id''))';
begin
  foreach t in array tables loop
    execute format('drop policy if exists org_access on public.%I', t);
    execute format('create policy "members read their organization''s row" on public.%I for select to authenticated using (organization_id = %s)', t, org_claim);
    execute format('create policy "members insert their organization''s row" on public.%I for insert to authenticated with check (organization_id = %s)', t, org_claim);
    execute format('create policy "members update their organization''s row" on public.%I for update to authenticated using (organization_id = %s) with check (organization_id = %s)', t, org_claim, org_claim);
    execute format('create policy "members delete their organization''s row" on public.%I for delete to authenticated using (organization_id = %s)', t, org_claim);
  end loop;

  drop policy if exists org_access on public.organizations;
  create policy "members read their organization''s row" on public.organizations for select to authenticated using (id = (select coalesce(auth.jwt() ->> 'org_id', auth.jwt() -> 'o' ->> 'id')));
  create policy "members insert their organization''s row" on public.organizations for insert to authenticated with check (id = (select coalesce(auth.jwt() ->> 'org_id', auth.jwt() -> 'o' ->> 'id')));
  create policy "members update their organization''s row" on public.organizations for update to authenticated using (id = (select coalesce(auth.jwt() ->> 'org_id', auth.jwt() -> 'o' ->> 'id'))) with check (id = (select coalesce(auth.jwt() ->> 'org_id', auth.jwt() -> 'o' ->> 'id')));
  create policy "members delete their organization''s row" on public.organizations for delete to authenticated using (id = (select coalesce(auth.jwt() ->> 'org_id', auth.jwt() -> 'o' ->> 'id')));
end $$;