alter table public.edges add column if not exists type_only boolean not null default false;

create or replace function public.insert_analysis_edges(
  p_analysis_id uuid,
  p_organization_id text,
  p_edges jsonb
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  e jsonb;
begin
  for e in select value from jsonb_array_elements(p_edges) loop
    if not exists (
      select 1 from public.files f
      where f.analysis_id = p_analysis_id and f.path = e->>'source_path'
    ) then
      raise exception 'unknown source file: %', e->>'source_path';
    end if;
    if not exists (
      select 1 from public.files f
      where f.analysis_id = p_analysis_id and f.path = e->>'target_path'
    ) then
      raise exception 'unknown target file: %', e->>'target_path';
    end if;
  end loop;

  insert into public.edges (analysis_id, organization_id, source_file_id, target_file_id, source_path, target_path, kind, type_only)
  select p_analysis_id, p_organization_id,
    sf.id, tf.id,
    e.source_path, e.target_path, e.kind, coalesce(e.type_only, false)
  from jsonb_to_recordset(p_edges) as e(source_path text, target_path text, kind text, type_only boolean)
  join public.files sf on sf.analysis_id = p_analysis_id and sf.path = e.source_path
  join public.files tf on tf.analysis_id = p_analysis_id and tf.path = e.target_path;
end;
$$;

revoke all on function public.insert_analysis_edges(uuid, text, jsonb) from public;
revoke all on function public.insert_analysis_edges(uuid, text, jsonb) from anon;
revoke all on function public.insert_analysis_edges(uuid, text, jsonb) from authenticated;
grant execute on function public.insert_analysis_edges(uuid, text, jsonb) to service_role;
