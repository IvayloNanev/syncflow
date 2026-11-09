create or replace function public.syncflow_normalize_request_summary()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 new.dashboard := coalesce(new.dashboard,'{}'::jsonb) || jsonb_build_object(
  'id',new.id::text,
  'revision',coalesce((new.state #>> '{tables,requests,0,revision}')::integer,0));
 return new;
end;$$;
revoke all on function public.syncflow_normalize_request_summary() from public,anon,authenticated;
create trigger syncflow_request_summary_identity before insert or update of dashboard,state on public.syncflow_requests for each row execute function public.syncflow_normalize_request_summary();
