-- Isolated guest workspaces. These tables and RPCs are service-role-only.
-- Apply after the shared schema, AI budgets and durable AI migrations.
create table public.syncflow_demo_settings (
 id boolean primary key default true check(id),
 enabled boolean not null default false,
 actor_id uuid references auth.users(id),
 daily_sessions integer not null default 20 check(daily_sessions between 1 and 100),
 daily_provider_calls integer not null default 60 check(daily_provider_calls between 1 and 1000)
);
insert into public.syncflow_demo_settings(id) values(true);
create table public.syncflow_demo_sessions (
 token_hash text primary key check(token_hash ~ '^[a-f0-9]{64}$'),
 workspace_id uuid not null unique references public.syncflow_workspaces(id),
 actor_id uuid not null references auth.users(id),
 ip_hash text not null check(ip_hash ~ '^[a-f0-9]{64}$'),
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default now()+interval '2 hours',
 ready boolean not null default false,
 command_count integer not null default 0,
 create_count integer not null default 0
);
create index syncflow_demo_sessions_ip_created on public.syncflow_demo_sessions(ip_hash,created_at);
create table public.syncflow_demo_reservations (
 workspace_id uuid not null references public.syncflow_demo_sessions(workspace_id),
 kind text not null check(kind in ('run','provider')),
 key text not null check(length(key) between 1 and 1000),
 input_bytes integer not null default 0,
 created_at timestamptz not null default now(),
 primary key(workspace_id,kind,key)
);
create index syncflow_demo_reservations_created on public.syncflow_demo_reservations(created_at,kind);
alter table public.syncflow_demo_settings enable row level security;
alter table public.syncflow_demo_sessions enable row level security;
alter table public.syncflow_demo_reservations enable row level security;
revoke all on public.syncflow_demo_settings,public.syncflow_demo_sessions,public.syncflow_demo_reservations from public,anon,authenticated;
grant all on public.syncflow_demo_settings,public.syncflow_demo_sessions,public.syncflow_demo_reservations to service_role;

create function public.syncflow_create_demo(p_hash text,p_ip text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare cfg public.syncflow_demo_settings%rowtype; w uuid; starts timestamptz := date_trunc('day',now() at time zone 'UTC') at time zone 'UTC';
begin
 if p_hash is null or p_hash !~ '^[a-f0-9]{64}$' or p_ip is null or p_ip !~ '^[a-f0-9]{64}$' then raise exception 'INVALID_DEMO'; end if;
 perform pg_advisory_xact_lock(hashtextextended('syncflow-demo-admission',0));
 select * into cfg from public.syncflow_demo_settings where id=true;
 if not coalesce(cfg.enabled,false) or cfg.actor_id is null then raise exception 'DEMO_UNAVAILABLE'; end if;
 -- The service identity may belong only to the reserved demo namespace.
 if exists(select 1 from public.syncflow_members where user_id=cfg.actor_id and workspace_id::text not like 'de000000-%') then raise exception 'DEMO_ACTOR_NOT_ISOLATED'; end if;
 if (select count(*) from public.syncflow_demo_sessions where created_at>=starts)>=cfg.daily_sessions
 or (select count(*) from public.syncflow_demo_sessions where ip_hash=p_ip and created_at>=starts)>=3 then raise exception 'DEMO_SESSION_LIMIT'; end if;
 w := ('de000000-'||substr(gen_random_uuid()::text,10))::uuid;
 insert into public.syncflow_workspaces(id,name) values(w,'Guest demo · fictional cases');
 insert into public.syncflow_members(workspace_id,user_id,role) values(w,cfg.actor_id,'member');
 insert into public.syncflow_demo_sessions(token_hash,workspace_id,actor_id,ip_hash) values(p_hash,w,cfg.actor_id,p_ip);
 insert into public.syncflow_ai_limits(workspace_id,daily_calls,member_daily_calls,daily_input_bytes,member_daily_input_bytes)
 values(w,12,12,500000,500000);
 return jsonb_build_object('workspace_id',w,'actor_id',cfg.actor_id);
end;$$;

create function public.syncflow_read_demo(p_hash text)
returns jsonb language sql security invoker set search_path='' as $$
 select jsonb_build_object('workspace_id',s.workspace_id,'actor_id',s.actor_id,'expires_at',s.expires_at,
 'remaining_calls',greatest(0,12-(select count(*) from public.syncflow_demo_reservations r where r.workspace_id=s.workspace_id and kind='provider')))
 from public.syncflow_demo_sessions s
 join public.syncflow_members m on m.workspace_id=s.workspace_id and m.user_id=s.actor_id
 join public.syncflow_demo_settings cfg on cfg.id and cfg.enabled
 where s.token_hash=p_hash and s.ready and s.expires_at>now();
$$;

create function public.syncflow_reserve_demo(p_workspace uuid,p_actor uuid,p_kind text,p_key text,p_bytes integer default 0)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare s public.syncflow_demo_sessions%rowtype; cfg public.syncflow_demo_settings%rowtype; starts timestamptz := date_trunc('day',now() at time zone 'UTC') at time zone 'UTC';
begin
 if p_kind is null or p_kind not in ('run','provider','command','create') or p_key is null or length(p_key) not between 1 and 1000 or p_bytes is null or p_bytes<0 or p_bytes>64000 then raise exception 'INVALID_DEMO_USAGE'; end if;
 perform pg_advisory_xact_lock(hashtextextended('syncflow-demo-budget',0));
 select * into cfg from public.syncflow_demo_settings where id=true;
 select * into s from public.syncflow_demo_sessions where workspace_id=p_workspace and actor_id=p_actor for update;
 if not found or not s.ready or s.expires_at<=now() or not coalesce(cfg.enabled,false)
 or not exists(select 1 from public.syncflow_members where workspace_id=p_workspace and user_id=p_actor) then return jsonb_build_object('allowed',false); end if;
 if p_kind in ('command','create') then
  if s.command_count>=100 or (p_kind='create' and s.create_count>=6) then return jsonb_build_object('allowed',false); end if;
  update public.syncflow_demo_sessions set command_count=command_count+1,create_count=create_count+case when p_kind='create' then 1 else 0 end where workspace_id=p_workspace;
  return jsonb_build_object('allowed',true);
 end if;
 if exists(select 1 from public.syncflow_demo_reservations where workspace_id=p_workspace and kind=p_kind and key=p_key) then return jsonb_build_object('allowed',true); end if;
 if p_kind='run' and (select count(*) from public.syncflow_demo_reservations where workspace_id=p_workspace and kind='run')>=8 then return jsonb_build_object('allowed',false); end if;
 if p_kind='provider' and (
  (select count(*) from public.syncflow_demo_reservations where workspace_id=p_workspace and kind='provider')>=12
  or (select count(*) from public.syncflow_demo_reservations where kind='provider' and created_at>=starts)>=cfg.daily_provider_calls
  or (select count(*) from public.syncflow_demo_reservations r join public.syncflow_demo_sessions x on x.workspace_id=r.workspace_id where r.kind='provider' and r.created_at>=starts and x.ip_hash=s.ip_hash)>=24
 ) then return jsonb_build_object('allowed',false); end if;
 insert into public.syncflow_demo_reservations(workspace_id,kind,key,input_bytes) values(p_workspace,p_kind,p_key,p_bytes);
 return jsonb_build_object('allowed',true);
end;$$;
revoke execute on function public.syncflow_create_demo(text,text),public.syncflow_read_demo(text),public.syncflow_reserve_demo(uuid,uuid,text,text,integer) from public,anon,authenticated;
grant execute on function public.syncflow_create_demo(text,text),public.syncflow_read_demo(text),public.syncflow_reserve_demo(uuid,uuid,text,text,integer) to service_role;
