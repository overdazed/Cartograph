-- Add organizations table so rows own a real foreign key to an organization,
-- with cascade delete, plus row-level security on it.

create table public.organizations (
  id text primary key,
  name text,
  slug text,
  created_at timestamptz not null default now()
);

insert into public.organizations (id, name, slug) values
  ('org_3Le8rZIfgm45L4EIkO6oFImR4yv', 'overdazed''s Organization', 'overdazed-s-organization-1793803372900906382'),
  ('org_3LeJKgQ9FjF1x9Ldi89wV7WZzaf', 'Test', 'test-1793808537745169505');

alter table public.projects add constraint projects_organization_id_fkey foreign key (organization_id) references public.organizations (id) on delete cascade;
alter table public.analyses add constraint analyses_organization_id_fkey foreign key (organization_id) references public.organizations (id) on delete cascade;
alter table public.files add constraint files_organization_id_fkey foreign key (organization_id) references public.organizations (id) on delete cascade;
alter table public.edges add constraint edges_organization_id_fkey foreign key (organization_id) references public.organizations (id) on delete cascade;
alter table public.routes add constraint routes_organization_id_fkey foreign key (organization_id) references public.organizations (id) on delete cascade;
alter table public.explanations add constraint explanations_organization_id_fkey foreign key (organization_id) references public.organizations (id) on delete cascade;
alter table public.file_roles add constraint file_roles_organization_id_fkey foreign key (organization_id) references public.organizations (id) on delete cascade;
alter table public.insights add constraint insights_organization_id_fkey foreign key (organization_id) references public.organizations (id) on delete cascade;

alter table public.organizations enable row level security;
create policy org_access on public.organizations
  for all to authenticated
  using (id = (select coalesce(auth.jwt() ->> 'org_id', auth.jwt() -> 'o' ->> 'id')))
  with check (id = (select coalesce(auth.jwt() ->> 'org_id', auth.jwt() -> 'o' ->> 'id')));

grant select, insert, update, delete on public.organizations to authenticated;