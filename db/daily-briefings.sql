-- Server-only latest briefing, scoped by the authenticated workspace in the API.
create table public.syncflow_briefings (
 workspace_id uuid primary key references public.syncflow_workspaces(id) on delete cascade,
 report jsonb,
 snapshots jsonb not null default '{}'::jsonb,
 generated_at timestamptz not null default now(),
 generated_by uuid not null
);
alter table public.syncflow_briefings enable row level security;
revoke all on public.syncflow_briefings from public,anon,authenticated;
grant select,insert,update,delete on public.syncflow_briefings to service_role;
