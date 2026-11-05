create or replace function public.publish_analysis_progress()
returns trigger
language plpgsql
security definer
as $$
begin
  if new.stage is not null then
    perform realtime.send(
      jsonb_build_object('status', new.status, 'stage', new.stage, 'message', new.stage_message),
      'progress',
      'analysis:' || new.id::text,
      true
    );
  end if;
  return new;
end;
$$;
