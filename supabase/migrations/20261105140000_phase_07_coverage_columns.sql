alter table public.analyses
  add column if not exists files_found integer,
  add column if not exists files_parsed integer,
  add column if not exists imports_total integer,
  add column if not exists imports_resolved integer,
  add column if not exists imports_resolved_external integer,
  add column if not exists imports_excluded integer,
  add column if not exists adapter text;
