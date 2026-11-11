-- Re-entrant lease renewal for one durable run; another active owner cannot be displaced.
create or replace function public.syncflow_acquire_analysis(p_workspace uuid,p_actor uuid,p_token uuid)
returns boolean language plpgsql security invoker set search_path='' as $$
declare acquired uuid;
begin
 perform 1 from public.syncflow_members where workspace_id=p_workspace and user_id=p_actor for share;
 if not found then raise exception 'WORKSPACE_ACCESS_DENIED'; end if;
 insert into public.syncflow_analysis_leases(workspace_id,token,expires_at)
 values(p_workspace,p_token,now()+interval '180 seconds')
 on conflict(workspace_id) do update set token=excluded.token,expires_at=excluded.expires_at
 where public.syncflow_analysis_leases.token=excluded.token or public.syncflow_analysis_leases.expires_at<now()
 returning token into acquired;
 return acquired is not null;
end;$$;
revoke execute on function public.syncflow_acquire_analysis(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.syncflow_acquire_analysis(uuid,uuid,uuid) to service_role;
