-- At-most-one network attempt per durable step attempt. No prompt/output storage.
create table public.syncflow_ai_attempts(
 workspace_id uuid not null references public.syncflow_workspaces(id),
 attempt_key text not null check(length(attempt_key) between 1 and 200),
 actor_id uuid not null references auth.users(id),
 digest text not null check(digest ~ '^[a-f0-9]{64}$'),
 allowed boolean not null default false,
 created_at timestamptz not null default now(),
 primary key(workspace_id,attempt_key)
);
alter table public.syncflow_ai_attempts enable row level security;
revoke all on public.syncflow_ai_attempts from public,anon,authenticated;
grant all on public.syncflow_ai_attempts to service_role;
create policy server_attempts on public.syncflow_ai_attempts to service_role using(true) with check(true);
create function public.syncflow_reserve_durable_ai_attempt(p_workspace uuid,p_actor uuid,p_feature text,p_input_bytes integer,p_key text,p_digest text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare reservation jsonb; inserted text; previous public.syncflow_ai_attempts;
begin
 if p_key is null or length(p_key) not between 1 and 200 or p_digest is null or p_digest !~ '^[a-f0-9]{64}$' then raise exception 'INVALID_ATTEMPT'; end if;
 perform 1 from public.syncflow_members where workspace_id=p_workspace and user_id=p_actor for share;
 if not found then raise exception 'WORKSPACE_ACCESS_DENIED'; end if;
 insert into public.syncflow_ai_attempts(workspace_id,attempt_key,actor_id,digest) values(p_workspace,p_key,p_actor,p_digest)
 on conflict do nothing returning attempt_key into inserted;
 if inserted is null then
  select * into previous from public.syncflow_ai_attempts where workspace_id=p_workspace and attempt_key=p_key;
  if previous.digest<>p_digest or previous.actor_id<>p_actor then raise exception 'ATTEMPT_CONFLICT'; end if;
  return jsonb_build_object('allowed',false,'duplicate',true);
 end if;
 reservation:=public.syncflow_reserve_ai_usage(p_workspace,p_actor,p_feature,p_input_bytes);
 update public.syncflow_ai_attempts set allowed=(reservation->>'allowed')::boolean where workspace_id=p_workspace and attempt_key=p_key;
 return reservation;
end;$$;
revoke execute on function public.syncflow_reserve_durable_ai_attempt(uuid,uuid,text,integer,text,text) from public,anon,authenticated;
grant execute on function public.syncflow_reserve_durable_ai_attempt(uuid,uuid,text,integer,text,text) to service_role;
