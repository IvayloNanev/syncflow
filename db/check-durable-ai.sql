-- Disposable users/workspace; no provider calls and all rows roll back.
begin;
do $$
declare u uuid:=gen_random_uuid(); outsider uuid:=gen_random_uuid(); w uuid:=gen_random_uuid(); token uuid:=gen_random_uuid(); denied boolean:=false; result jsonb;
begin
 insert into auth.users(id,email) values(u,'durable-'||u||'@example.invalid'),(outsider,'durable-'||outsider||'@example.invalid');
 insert into public.syncflow_workspaces(id,name) values(w,'Disposable durable AI fixture');
 insert into public.syncflow_members(workspace_id,user_id) values(w,u);
 if not public.syncflow_acquire_analysis(w,u,token) then raise exception 'Lease rejected'; end if;
 if not public.syncflow_acquire_analysis(w,u,token) then raise exception 'Same run cannot renew'; end if;
 if public.syncflow_acquire_analysis(w,u,gen_random_uuid()) then raise exception 'Other owner stole active lease'; end if;
 result:=public.syncflow_reserve_durable_ai_attempt(w,u,'coordinator',100,'synthetic:intake:0',repeat('a',64));
 if result->>'allowed'<>'true' then raise exception 'First claim failed'; end if;
 result:=public.syncflow_reserve_durable_ai_attempt(w,u,'coordinator',100,'synthetic:intake:0',repeat('a',64));
 if result->>'duplicate'<>'true' or result->>'allowed'<>'false' then raise exception 'Duplicate claim accepted'; end if;
 if (select calls from public.syncflow_ai_usage where workspace_id=w and actor_id=u)<>1 then raise exception 'Duplicate charged quota'; end if;
 begin perform public.syncflow_reserve_durable_ai_attempt(w,u,'coordinator',100,'synthetic:intake:0',repeat('b',64));exception when others then denied:=sqlerrm='ATTEMPT_CONFLICT';end;
 if not denied then raise exception 'Changed payload reused claim'; end if;
 denied:=false;
 begin perform public.syncflow_reserve_durable_ai_attempt(w,outsider,'coordinator',100,'foreign',repeat('a',64));exception when others then denied:=sqlerrm='WORKSPACE_ACCESS_DENIED';end;
 if not denied then raise exception 'Nonmember claim accepted'; end if;
end;$$;
set local role authenticated;
do $$begin
 if has_table_privilege(current_user,'public.syncflow_ai_attempts','SELECT') or has_function_privilege(current_user,'public.syncflow_reserve_durable_ai_attempt(uuid,uuid,text,integer,text,text)','EXECUTE') then raise exception 'Browser role can access attempt ledger';end if;
end;$$;
reset role;
rollback;
select 'PASS: lease renewal, exclusive ownership, single claim/quota charge, payload conflict, membership and browser isolation; all fixture rows rolled back' as result;
