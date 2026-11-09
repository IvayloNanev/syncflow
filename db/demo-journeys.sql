-- Synthetic sandbox state is isolated from syncflow_requests and email routes.
create table public.syncflow_demo_runs (
 workspace_id uuid not null references public.syncflow_workspaces(id) on delete cascade,
 actor_id uuid not null,
 version bigint not null default 1,
 state jsonb not null,
 primary key(workspace_id,actor_id)
);
alter table public.syncflow_demo_runs enable row level security;
revoke all on public.syncflow_demo_runs from public,anon,authenticated;
grant select,insert,update,delete on public.syncflow_demo_runs to service_role;
