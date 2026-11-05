-- Phase 2: dashboard and schema.
-- Eight tables, each owned by an organization via organization_id.
-- Access is decided entirely by row-level security reading the org claim
-- off the Clerk JWT; application code never filters by organization.

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null,
  repository_url text,
  name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.analyses (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null,
  project_id uuid references public.projects (id) on delete cascade,
  repository_url text not null,
  commit_sha text,
  status text not null default 'pending',
  stage text,
  stage_message text,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.files (
  id uuid primary key default gen_random_uuid(),
  analysis_id uuid not null references public.analyses (id) on delete cascade,
  organization_id text not null,
  path text not null,
  folder text,
  line_count integer,
  byte_size integer,
  content_hash text,
  created_at timestamptz not null default now()
);

create table public.edges (
  id uuid primary key default gen_random_uuid(),
  analysis_id uuid not null references public.analyses (id) on delete cascade,
  organization_id text not null,
  source_file_id uuid references public.files (id) on delete cascade,
  target_file_id uuid references public.files (id) on delete cascade,
  source_path text not null,
  target_path text not null,
  kind text not null,
  created_at timestamptz not null default now()
);

create table public.routes (
  id uuid primary key default gen_random_uuid(),
  analysis_id uuid not null references public.analyses (id) on delete cascade,
  organization_id text not null,
  method text not null,
  path text not null,
  file_path text not null,
  created_at timestamptz not null default now()
);

create table public.explanations (
  id uuid primary key default gen_random_uuid(),
  analysis_id uuid not null references public.analyses (id) on delete cascade,
  organization_id text not null,
  target_kind text not null,
  target_key text not null,
  content text not null,
  model text,
  prompt_version text,
  content_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.file_roles (
  id uuid primary key default gen_random_uuid(),
  analysis_id uuid not null references public.analyses (id) on delete cascade,
  organization_id text not null,
  file_path text not null,
  role text not null,
  source text not null default 'convention',
  created_at timestamptz not null default now()
);

create table public.insights (
  id uuid primary key default gen_random_uuid(),
  analysis_id uuid not null references public.analyses (id) on delete cascade,
  organization_id text not null,
  kind text not null,
  message text not null,
  file_path text,
  created_at timestamptz not null default now()
);

-- Row-level security on all eight.
alter table public.projects enable row level security;
alter table public.analyses enable row level security;
alter table public.files enable row level security;
alter table public.edges enable row level security;
alter table public.routes enable row level security;
alter table public.explanations enable row level security;
alter table public.file_roles enable row level security;
alter table public.insights enable row level security;

-- The organization claim may arrive either at the top level (org_id) or nested
-- under the "o" object (o.id), depending on the Clerk token shape.
create policy org_access on public.projects
  for all to authenticated
  using (organization_id = (select coalesce(auth.jwt() ->> 'org_id', auth.jwt() -> 'o' ->> 'id')))
  with check (organization_id = (select coalesce(auth.jwt() ->> 'org_id', auth.jwt() -> 'o' ->> 'id')));

create policy org_access on public.analyses
  for all to authenticated
  using (organization_id = (select coalesce(auth.jwt() ->> 'org_id', auth.jwt() -> 'o' ->> 'id')))
  with check (organization_id = (select coalesce(auth.jwt() ->> 'org_id', auth.jwt() -> 'o' ->> 'id')));

create policy org_access on public.files
  for all to authenticated
  using (organization_id = (select coalesce(auth.jwt() ->> 'org_id', auth.jwt() -> 'o' ->> 'id')))
  with check (organization_id = (select coalesce(auth.jwt() ->> 'org_id', auth.jwt() -> 'o' ->> 'id')));

create policy org_access on public.edges
  for all to authenticated
  using (organization_id = (select coalesce(auth.jwt() ->> 'org_id', auth.jwt() -> 'o' ->> 'id')))
  with check (organization_id = (select coalesce(auth.jwt() ->> 'org_id', auth.jwt() -> 'o' ->> 'id')));

create policy org_access on public.routes
  for all to authenticated
  using (organization_id = (select coalesce(auth.jwt() ->> 'org_id', auth.jwt() -> 'o' ->> 'id')))
  with check (organization_id = (select coalesce(auth.jwt() ->> 'org_id', auth.jwt() -> 'o' ->> 'id')));

create policy org_access on public.explanations
  for all to authenticated
  using (organization_id = (select coalesce(auth.jwt() ->> 'org_id', auth.jwt() -> 'o' ->> 'id')))
  with check (organization_id = (select coalesce(auth.jwt() ->> 'org_id', auth.jwt() -> 'o' ->> 'id')));

create policy org_access on public.file_roles
  for all to authenticated
  using (organization_id = (select coalesce(auth.jwt() ->> 'org_id', auth.jwt() -> 'o' ->> 'id')))
  with check (organization_id = (select coalesce(auth.jwt() ->> 'org_id', auth.jwt() -> 'o' ->> 'id')));

create policy org_access on public.insights
  for all to authenticated
  using (organization_id = (select coalesce(auth.jwt() ->> 'org_id', auth.jwt() -> 'o' ->> 'id')))
  with check (organization_id = (select coalesce(auth.jwt() ->> 'org_id', auth.jwt() -> 'o' ->> 'id')));

-- Expose tables to the authenticated role (RLS still governs rows).
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;