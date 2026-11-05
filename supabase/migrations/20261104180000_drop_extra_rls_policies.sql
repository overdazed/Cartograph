-- Keep a single read policy per table. Writes are added when a phase needs them.

do $$
declare
  tables text[] := array['projects','analyses','files','edges','routes','explanations','file_roles','insights','organizations'];
  t text;
begin
  foreach t in array tables loop
    execute format('drop policy if exists "members insert their organization''s row" on public.%I', t);
    execute format('drop policy if exists "members update their organization''s row" on public.%I', t);
    execute format('drop policy if exists "members delete their organization''s row" on public.%I', t);
  end loop;
end $$;