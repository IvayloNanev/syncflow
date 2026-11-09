-- Explicit handoffs and immutable, snapshot-bound assessments. Server-only access.
create table public.syncflow_internal_queue (
 workspace_id uuid not null,
 request_id uuid not null,
 admitted_by uuid not null,
 admitted_at timestamptz not null default now(),
 primary key(workspace_id,request_id),
 foreign key(workspace_id,request_id) references public.syncflow_requests(workspace_id,id) on delete cascade
);
create table public.syncflow_internal_assessments (
 workspace_id uuid not null,
 request_id uuid not null,
 fingerprint text not null,
 request_version bigint not null,
 result jsonb not null,
 generated_by uuid not null,
 generated_at timestamptz not null default now(),
 primary key(workspace_id,request_id,fingerprint),
 foreign key(workspace_id,request_id) references public.syncflow_requests(workspace_id,id) on delete cascade
);
alter table public.syncflow_internal_queue enable row level security;
alter table public.syncflow_internal_assessments enable row level security;
revoke all on public.syncflow_internal_queue,public.syncflow_internal_assessments from public,anon,authenticated;
grant select,insert,update,delete on public.syncflow_internal_queue,public.syncflow_internal_assessments to service_role;
create function public.syncflow_save_internal_assessment(p_workspace uuid,p_actor uuid,p_request uuid,p_version bigint,p_fingerprint text,p_result jsonb)
returns void language plpgsql security invoker set search_path='' as $$
begin
 perform 1 from public.syncflow_members where workspace_id=p_workspace and user_id=p_actor for share;
 if not found then raise exception 'WORKSPACE_ACCESS_DENIED';end if;
 perform 1 from public.syncflow_requests where workspace_id=p_workspace and id=p_request and version=p_version for share;
 if not found then raise exception 'STORAGE_CONFLICT';end if;
 insert into public.syncflow_internal_assessments(workspace_id,request_id,fingerprint,request_version,result,generated_by)
 values(p_workspace,p_request,p_fingerprint,p_version,p_result,p_actor) on conflict do nothing;
end;$$;
revoke execute on function public.syncflow_save_internal_assessment(uuid,uuid,uuid,bigint,text,jsonb) from public,anon,authenticated;
grant execute on function public.syncflow_save_internal_assessment(uuid,uuid,uuid,bigint,text,jsonb) to service_role;
