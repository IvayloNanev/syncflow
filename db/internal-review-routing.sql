alter table public.syncflow_internal_queue add column active boolean not null default true;
alter table public.syncflow_internal_queue add column returned_at timestamptz;
alter table public.syncflow_internal_queue add column returned_by uuid;
create function public.syncflow_return_internal_case(p_workspace uuid,p_actor uuid,p_request uuid,p_version bigint)
returns void language plpgsql security invoker set search_path='' as $$
begin
 perform 1 from public.syncflow_members where workspace_id=p_workspace and user_id=p_actor for share;
 if not found then raise exception 'WORKSPACE_ACCESS_DENIED';end if;
 perform 1 from public.syncflow_requests where workspace_id=p_workspace and id=p_request and version=p_version for share;
 if not found then raise exception 'STORAGE_CONFLICT';end if;
 update public.syncflow_internal_queue set active=false,returned_at=now(),returned_by=p_actor where workspace_id=p_workspace and request_id=p_request;
end;$$;
revoke execute on function public.syncflow_return_internal_case(uuid,uuid,uuid,bigint) from public,anon,authenticated;
grant execute on function public.syncflow_return_internal_case(uuid,uuid,uuid,bigint) to service_role;
