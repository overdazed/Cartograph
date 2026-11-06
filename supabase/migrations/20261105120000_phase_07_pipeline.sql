-- Phase 7: pipeline support

-- Resolve duplicate project_id values before enforcing one analysis per project,
-- keeping the newest analysis for each project.
delete from public.analyses a
using public.analyses b
where a.project_id = b.project_id
  and a.created_at < b.created_at;

-- unique constraint: one analysis per project (repository)
alter table public.analyses
  add constraint analyses_one_per_project unique (project_id);

-- unique constraint: one project per organization and repository URL
alter table public.projects
  add constraint projects_org_url_unique unique (organization_id, repository_url);

-- Trigger function that publishes stage + message to the per-analysis channel.
create or replace function public.publish_analysis_progress()
returns trigger
language plpgsql
security definer
as $$
begin
  if new.stage is not null then
    perform realtime.send(
      jsonb_build_object('stage', new.stage, 'message', new.stage_message),
      'progress',
      'analysis:' || new.id::text,
      true
    );
  end if;
  return new;
end;
$$;

create trigger analyses_progress_trigger
after insert or update of stage, stage_message on public.analyses
for each row
execute function public.publish_analysis_progress();

-- Who may subscribe to a progress channel is a policy, same as the data.
create policy "members read their analysis progress"
on realtime.messages
for select
to authenticated
using (
  realtime.messages.extension = 'broadcast'
  and realtime.topic() like 'analysis:%'
  and exists (
    select 1 from public.analyses a
    where a.id::text = split_part(realtime.topic(), ':', 2)
      and a.organization_id = coalesce(auth.jwt() ->> 'org_id', auth.jwt() -> 'o' ->> 'id')
  )
);
