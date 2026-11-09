-- Accept external senders for new cases only; preserve case reply and workspace checks.
create or replace function public.syncflow_commit_email(p_token text,p_email text,p_sender text,p_id uuid,p_expected bigint,p_state jsonb,p_dashboard jsonb,p_subject text,p_attachments integer)
returns uuid language plpgsql security invoker set search_path='' as $$
declare r public.syncflow_email_routes; existing uuid;
begin
 select * into r from public.syncflow_email_routes where token=p_token and enabled for share;
 if not found then raise exception 'FORWARDING_DENIED'; end if;
 perform 1 from public.syncflow_members m
 where m.workspace_id=r.workspace_id and m.user_id=r.actor_id and (r.request_id is null or lower(r.forwarder_email)=lower(p_sender)) for share of m;
 if not found then raise exception 'FORWARDING_DENIED'; end if;
 if r.request_id is not null and r.request_id<>p_id then raise exception 'FORWARDING_DENIED'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_email,0));
 select request_id into existing from public.syncflow_email_receipts where email_id=p_email;
 if found then return existing; end if;
 perform public.syncflow_commit_request(r.workspace_id,r.actor_id,p_id,p_expected,p_state,p_dashboard);
 insert into public.syncflow_email_receipts(email_id,workspace_id,request_id,subject,sender,attachment_count)
 values(p_email,r.workspace_id,p_id,left(p_subject,500),p_sender,p_attachments);
 return p_id;
end;$$;
revoke execute on function public.syncflow_commit_email(text,text,text,uuid,bigint,jsonb,jsonb,text,integer) from public,anon,authenticated;
grant execute on function public.syncflow_commit_email(text,text,text,uuid,bigint,jsonb,jsonb,text,integer) to service_role;
