-- Disposable RLS/privilege checks. Everything is rolled back, including fake users.
begin;
do $$
declare u uuid:=gen_random_uuid(); other_user uuid:=gen_random_uuid(); w uuid:=gen_random_uuid(); w2 uuid:=gen_random_uuid();
begin
 insert into auth.users(id,email) values(u,'syncflow-isolation-'||u||'@example.invalid'),(other_user,'syncflow-isolation-'||other_user||'@example.invalid');
 insert into public.syncflow_workspaces(id,name) values(w,'Disposable isolation fixture'),(w2,'Disposable other fixture');
 insert into public.syncflow_members(workspace_id,user_id) values(w,u),(w,other_user),(w2,other_user);
 perform set_config('request.jwt.claims',json_build_object('sub',u,'role','authenticated')::text,true);
 perform set_config('syncflow.test_user',u::text,true);
 perform set_config('syncflow.test_workspace',w::text,true);
 perform set_config('syncflow.test_other',w2::text,true);
end;$$;
set local role authenticated;
do $$ begin
 if (select count(*) from public.syncflow_members)<>1 then raise exception 'Membership isolation failed'; end if;
 if (select count(*) from public.syncflow_workspaces)<>1 then raise exception 'Workspace isolation failed'; end if;
 if has_table_privilege(current_user,'public.syncflow_requests','SELECT') then raise exception 'Client can read internal aggregates'; end if;
 if has_function_privilege(current_user,'public.syncflow_commit_request(uuid,uuid,uuid,bigint,jsonb,jsonb)','EXECUTE') then raise exception 'Client can forge commands'; end if;
end;$$;
set local role anon;
do $$ begin
 if has_table_privilege(current_user,'public.syncflow_members','SELECT') then raise exception 'Anonymous membership read'; end if;
 if has_function_privilege(current_user,'public.syncflow_acquire_analysis(uuid,uuid,uuid)','EXECUTE') then raise exception 'Anonymous analysis reservation'; end if;
end;$$;
set local role service_role;
do $$
declare w uuid:=current_setting('syncflow.test_workspace')::uuid; u uuid:=current_setting('syncflow.test_user')::uuid; id uuid:=gen_random_uuid(); denied boolean:=false;
begin
 if public.syncflow_commit_request(w,u,id,0,'{"schema_version":1,"tables":{}}','{}')<>1 then raise exception 'Create failed'; end if;
 if public.syncflow_commit_request(w,u,id,1,'{"schema_version":1,"tables":{}}','{}')<>2 then raise exception 'Update failed'; end if;
 begin perform public.syncflow_commit_request(w,u,id,1,'{"schema_version":1,"tables":{}}','{}'); exception when others then denied:=sqlerrm='STORAGE_CONFLICT'; end;
 if not denied then raise exception 'Stale write accepted'; end if;
 denied:=false;
 begin perform public.syncflow_commit_request(current_setting('syncflow.test_other')::uuid,u,id,0,'{"schema_version":1,"tables":{}}','{}'); exception when others then denied:=sqlerrm='WORKSPACE_ACCESS_DENIED'; end;
 if not denied then raise exception 'Cross-workspace write accepted'; end if;
 if not public.syncflow_acquire_analysis(w,u,gen_random_uuid()) then raise exception 'Lease failed'; end if;
 if public.syncflow_acquire_analysis(w,u,gen_random_uuid()) then raise exception 'Duplicate lease accepted'; end if;
end;$$;
reset role;
rollback;
select 'PASS: membership isolation, anonymous restrictions, server-only commands, atomic version checks, cross-workspace denial, analysis lease' as result;
