-- Shared, atomic budgets for every web model attempt. No client access or prompt storage.
create table public.syncflow_ai_limits (
 workspace_id uuid primary key references public.syncflow_workspaces(id),
 daily_calls integer not null default 60 check(daily_calls between 1 and 10000),
 member_daily_calls integer not null default 30 check(member_daily_calls between 1 and 10000),
 daily_input_bytes bigint not null default 2000000 check(daily_input_bytes>0),
 member_daily_input_bytes bigint not null default 1000000 check(member_daily_input_bytes>0),
 enabled boolean not null default true
);
create table public.syncflow_ai_usage (
 workspace_id uuid not null references public.syncflow_workspaces(id),
 actor_id uuid not null references auth.users(id),
 usage_day date not null,
 calls integer not null default 0 check(calls>=0),
 input_bytes bigint not null default 0 check(input_bytes>=0),
 minute_start timestamptz not null,
 minute_calls integer not null default 0,
 last_feature text not null,
 primary key(workspace_id,actor_id,usage_day)
);
alter table public.syncflow_ai_limits enable row level security;
alter table public.syncflow_ai_usage enable row level security;
revoke all on public.syncflow_ai_limits,public.syncflow_ai_usage from public,anon,authenticated;
grant all on public.syncflow_ai_limits,public.syncflow_ai_usage to service_role;
create policy server_ai_limits on public.syncflow_ai_limits to service_role using(true) with check(true);
create policy server_ai_usage on public.syncflow_ai_usage to service_role using(true) with check(true);
create function public.syncflow_reserve_ai_usage(p_workspace uuid,p_actor uuid,p_feature text,p_input_bytes integer)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare
 limits public.syncflow_ai_limits%rowtype;
 used public.syncflow_ai_usage%rowtype;
 total_calls bigint; total_bytes bigint;
 today date := (now() at time zone 'UTC')::date;
 minute_now timestamptz := date_trunc('minute',now());
 retry_day integer := greatest(1,extract(epoch from ((today+1)::timestamp at time zone 'UTC')-now())::integer);
begin
 if p_feature is null or p_feature not in ('coordinator','daily_brief','internal_review') or p_input_bytes is null or p_input_bytes<1 or p_input_bytes>256000 then raise exception 'INVALID_USAGE_REQUEST'; end if;
 perform 1 from public.syncflow_members where workspace_id=p_workspace and user_id=p_actor for share;
 if not found then raise exception 'WORKSPACE_ACCESS_DENIED'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_workspace::text,0));
 insert into public.syncflow_ai_limits(workspace_id) values(p_workspace) on conflict do nothing;
 select * into limits from public.syncflow_ai_limits where workspace_id=p_workspace for update;
 select * into used from public.syncflow_ai_usage where workspace_id=p_workspace and actor_id=p_actor and usage_day=today;
 select coalesce(sum(calls),0),coalesce(sum(input_bytes),0) into total_calls,total_bytes from public.syncflow_ai_usage where workspace_id=p_workspace and usage_day=today;
 if not limits.enabled or total_calls>=limits.daily_calls or coalesce(used.calls,0)>=limits.member_daily_calls or total_bytes+p_input_bytes>limits.daily_input_bytes or coalesce(used.input_bytes,0)+p_input_bytes>limits.member_daily_input_bytes then
  return jsonb_build_object('allowed',false,'retry_after',retry_day);
 end if;
 if used.minute_start=minute_now and used.minute_calls>=6 then return jsonb_build_object('allowed',false,'retry_after',60); end if;
 insert into public.syncflow_ai_usage(workspace_id,actor_id,usage_day,calls,input_bytes,minute_start,minute_calls,last_feature)
 values(p_workspace,p_actor,today,1,p_input_bytes,minute_now,1,p_feature)
 on conflict(workspace_id,actor_id,usage_day) do update set calls=public.syncflow_ai_usage.calls+1,input_bytes=public.syncflow_ai_usage.input_bytes+excluded.input_bytes,minute_start=minute_now,minute_calls=case when public.syncflow_ai_usage.minute_start=minute_now then public.syncflow_ai_usage.minute_calls+1 else 1 end,last_feature=p_feature;
 return jsonb_build_object('allowed',true);
end;$$;
revoke execute on function public.syncflow_reserve_ai_usage(uuid,uuid,text,integer) from public,anon,authenticated;
grant execute on function public.syncflow_reserve_ai_usage(uuid,uuid,text,integer) to service_role;
