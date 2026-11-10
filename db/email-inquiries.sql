-- Incoming email is an inquiry until an operator saves it as a case.
create table public.syncflow_inquiries(
 email_id text primary key,
 workspace_id uuid not null references public.syncflow_workspaces(id),
 actor_id uuid not null references auth.users(id),
 sender text not null, subject text not null, body text not null check(length(body) between 1 and 20000),
 attachment_count integer not null default 0 check(attachment_count>=0),
 received_at timestamptz not null default now(),
 request_id uuid,
 foreign key(workspace_id,request_id) references public.syncflow_requests(workspace_id,id)
);
create index syncflow_inquiries_pending on public.syncflow_inquiries(workspace_id,received_at desc) where request_id is null;
alter table public.syncflow_inquiries enable row level security;
revoke all on public.syncflow_inquiries from public,anon,authenticated;
grant all on public.syncflow_inquiries to service_role;
create policy server_inquiries on public.syncflow_inquiries to service_role using(true) with check(true);

create function public.syncflow_capture_inquiry(p_token text,p_email text,p_sender text,p_subject text,p_body text,p_attachments integer)
returns text language plpgsql security invoker set search_path='' as $$
declare r public.syncflow_email_routes;
begin
 select * into r from public.syncflow_email_routes where token=p_token and enabled and request_id is null for share;
 if not found then raise exception 'FORWARDING_DENIED'; end if;
 perform 1 from public.syncflow_members where workspace_id=r.workspace_id and user_id=r.actor_id for share;
 if not found then raise exception 'FORWARDING_DENIED'; end if;
 insert into public.syncflow_inquiries(email_id,workspace_id,actor_id,sender,subject,body,attachment_count)
 values(p_email,r.workspace_id,r.actor_id,p_sender,left(p_subject,500),p_body,p_attachments)
 on conflict(email_id) do nothing;
 return p_email;
end;$$;
revoke execute on function public.syncflow_capture_inquiry(text,text,text,text,text,integer) from public,anon,authenticated;
grant execute on function public.syncflow_capture_inquiry(text,text,text,text,text,integer) to service_role;

create function public.syncflow_save_inquiry(p_workspace uuid,p_actor uuid,p_email text,p_id uuid,p_state jsonb,p_dashboard jsonb)
returns uuid language plpgsql security invoker set search_path='' as $$
declare i public.syncflow_inquiries;
begin
 perform 1 from public.syncflow_members where workspace_id=p_workspace and user_id=p_actor for share;
 if not found then raise exception 'WORKSPACE_ACCESS_DENIED'; end if;
 select * into i from public.syncflow_inquiries where email_id=p_email and workspace_id=p_workspace for update;
 if not found then raise exception 'INQUIRY_NOT_FOUND'; end if;
 if i.request_id is not null then return i.request_id; end if;
 perform public.syncflow_commit_request(p_workspace,p_actor,p_id,0,p_state,p_dashboard);
 update public.syncflow_inquiries set request_id=p_id where email_id=p_email;
 insert into public.syncflow_email_receipts(email_id,workspace_id,request_id,subject,sender,attachment_count)
 values(i.email_id,p_workspace,p_id,i.subject,i.sender,i.attachment_count);
 return p_id;
end;$$;
revoke execute on function public.syncflow_save_inquiry(uuid,uuid,text,uuid,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.syncflow_save_inquiry(uuid,uuid,text,uuid,jsonb,jsonb) to service_role;

-- Compatibility with the already-deployed receiving handler: stage new email,
-- preserve existing case replies, and never create a case on delivery.
create or replace function public.syncflow_commit_email(p_token text,p_email text,p_sender text,p_id uuid,p_expected bigint,p_state jsonb,p_dashboard jsonb,p_subject text,p_attachments integer)
returns uuid language plpgsql security invoker set search_path='' as $$
declare r public.syncflow_email_routes; existing uuid; original text;
begin
 select * into r from public.syncflow_email_routes where token=p_token and enabled for share;
 if not found then raise exception 'FORWARDING_DENIED'; end if;
 perform 1 from public.syncflow_members m where m.workspace_id=r.workspace_id and m.user_id=r.actor_id
 and (r.request_id is null or lower(r.forwarder_email)=lower(p_sender)) for share of m;
 if not found then raise exception 'FORWARDING_DENIED'; end if;
 if r.request_id is not null and r.request_id<>p_id then raise exception 'FORWARDING_DENIED'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_email,0));
 select request_id into existing from public.syncflow_email_receipts where email_id=p_email;
 if found then return existing; end if;
 if r.request_id is null then
  original:=((p_state#>>'{tables,requests,0,body}')::jsonb)#>>'{messages,0,text}';
  perform public.syncflow_capture_inquiry(p_token,p_email,p_sender,p_subject,original,p_attachments);
  return null;
 end if;
 perform public.syncflow_commit_request(r.workspace_id,r.actor_id,p_id,p_expected,p_state,p_dashboard);
 insert into public.syncflow_email_receipts(email_id,workspace_id,request_id,subject,sender,attachment_count)
 values(p_email,r.workspace_id,p_id,left(p_subject,500),p_sender,p_attachments);
 return p_id;
end;$$;
