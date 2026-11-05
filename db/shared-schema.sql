-- Shared persistence. Only the trusted Next.js server may write request aggregates.
create table public.syncflow_workspaces (
 id uuid primary key default gen_random_uuid(), name text not null,
 created_at timestamptz not null default now()
);
create table public.syncflow_members (
 workspace_id uuid not null references public.syncflow_workspaces(id),
 user_id uuid not null references auth.users(id) on delete cascade,
 role text not null default 'member' check (role in ('owner','member')),
 primary key(workspace_id,user_id)
);
create index syncflow_members_user_idx on public.syncflow_members(user_id);
create table public.syncflow_requests (
 workspace_id uuid not null references public.syncflow_workspaces(id),
 id uuid not null, version bigint not null check(version > 0),
 state jsonb not null check(state->>'schema_version' = '1'),
 dashboard jsonb not null, updated_at timestamptz not null default now(),
 primary key(workspace_id,id)
);
alter table public.syncflow_workspaces enable row level security;
alter table public.syncflow_members enable row level security;
alter table public.syncflow_requests enable row level security;
revoke all on public.syncflow_workspaces, public.syncflow_members, public.syncflow_requests from anon, authenticated;
grant select on public.syncflow_members, public.syncflow_workspaces to authenticated;
grant all on public.syncflow_workspaces, public.syncflow_members, public.syncflow_requests to service_role;
create policy own_memberships on public.syncflow_members for select to authenticated using (user_id = (select auth.uid()));
create policy member_workspaces on public.syncflow_workspaces for select to authenticated using (
 exists(select 1 from public.syncflow_members m where m.workspace_id=id and m.user_id=(select auth.uid()))
);
-- No client policy/grant on request payloads. Domain commands and audit identity are server-owned.
create policy server_requests on public.syncflow_requests to service_role using (true) with check (true);
create policy server_workspaces on public.syncflow_workspaces to service_role using (true) with check (true);
create policy server_members on public.syncflow_members to service_role using (true) with check (true);

-- Atomic compare-and-swap; version covers every edit, analysis and reviewer change.
-- SECURITY INVOKER and service_role-only EXECUTE: neither anonymous nor signed-in
-- clients can forge validated analysis, approvals or audit identities.
create function public.syncflow_commit_request(p_workspace uuid,p_actor uuid,p_id uuid,p_expected bigint,p_state jsonb,p_dashboard jsonb)
returns bigint language plpgsql security invoker set search_path = '' as $$
declare next_version bigint;
begin
 perform 1 from public.syncflow_members where workspace_id=p_workspace and user_id=p_actor for share;
 if not found then raise exception 'WORKSPACE_ACCESS_DENIED'; end if;
 if p_expected=0 then
  insert into public.syncflow_requests(workspace_id,id,version,state,dashboard)
  values(p_workspace,p_id,1,p_state,p_dashboard) on conflict do nothing returning version into next_version;
 else
  update public.syncflow_requests set version=version+1,state=p_state,dashboard=p_dashboard,updated_at=now()
  where workspace_id=p_workspace and id=p_id and version=p_expected returning version into next_version;
 end if;
 if next_version is null then raise exception 'STORAGE_CONFLICT'; end if;
 return next_version;
end;
$$;
revoke execute on function public.syncflow_commit_request(uuid,uuid,uuid,bigint,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.syncflow_commit_request(uuid,uuid,uuid,bigint,jsonb,jsonb) to service_role;

-- Supabase-created automatic-RLS event trigger needs no client EXECUTE grant.
revoke execute on function public.rls_auto_enable() from public,anon,authenticated;
