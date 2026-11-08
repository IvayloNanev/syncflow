-- Hosted migration: owner-managed, verified-email invitations. Server-only RPCs.
create table public.syncflow_invitations (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.syncflow_workspaces(id),
 email text not null check(email=lower(btrim(email)) and length(email)<=254 and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
 status text not null default 'pending' check(status in ('pending','accepted','revoked')),
 invited_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default (now()+interval '7 days'),
 accepted_by uuid references auth.users(id) on delete set null,
 accepted_at timestamptz,
 revoked_by uuid references auth.users(id) on delete set null,
 revoked_at timestamptz,
 check(expires_at>created_at)
);
create index syncflow_invitation_history_idx on public.syncflow_invitations(workspace_id,created_at desc);
create unique index syncflow_invitation_pending_idx on public.syncflow_invitations(workspace_id,email) where status='pending';
create index syncflow_invitation_recipient_idx on public.syncflow_invitations(email,expires_at) where status='pending';
create index syncflow_invitation_creator_idx on public.syncflow_invitations(invited_by);
create index syncflow_invitation_accepted_idx on public.syncflow_invitations(accepted_by);
create index syncflow_invitation_revoker_idx on public.syncflow_invitations(revoked_by);
alter table public.syncflow_invitations enable row level security;
revoke all on public.syncflow_invitations from public,anon,authenticated;
grant all on public.syncflow_invitations to service_role;
create policy server_invitations on public.syncflow_invitations to service_role using(true) with check(true);

create function public.syncflow_create_invitation(p_actor uuid,p_workspace uuid,p_email text)
returns uuid language plpgsql security invoker set search_path='' as $$
declare recipient text:=lower(btrim(p_email)); invitation uuid;
begin
 perform 1 from public.syncflow_members where user_id=p_actor and workspace_id=p_workspace and role='owner' for share;
 if not found or (select count(*) from public.syncflow_members where user_id=p_actor)<>1 then raise exception 'OWNER_REQUIRED';end if;
 if recipient is null or length(recipient)>254 or recipient !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'INVALID_EMAIL';end if;
 perform 1 from public.syncflow_workspaces where id=p_workspace for update;
 update public.syncflow_invitations set status='revoked',revoked_by=p_actor,revoked_at=now() where workspace_id=p_workspace and email=recipient and status='pending' and expires_at<=now();
 select id into invitation from public.syncflow_invitations where workspace_id=p_workspace and email=recipient and status='pending';
 if invitation is not null then return invitation;end if;
 if (select count(*) from public.syncflow_invitations where workspace_id=p_workspace and status='pending' and expires_at>now())>=50 then raise exception 'INVITATION_LIMIT';end if;
 if (select count(*) from public.syncflow_invitations where workspace_id=p_workspace and created_at>now()-interval '1 day')>=100 then raise exception 'INVITATION_LIMIT';end if;
 insert into public.syncflow_invitations(workspace_id,email,invited_by) values(p_workspace,recipient,p_actor) returning id into invitation;
 return invitation;
end;$$;

create function public.syncflow_revoke_invitation(p_actor uuid,p_workspace uuid,p_invitation uuid)
returns boolean language plpgsql security invoker set search_path='' as $$
begin
 perform 1 from public.syncflow_members where user_id=p_actor and workspace_id=p_workspace and role='owner' for share;
 if not found or (select count(*) from public.syncflow_members where user_id=p_actor)<>1 then raise exception 'OWNER_REQUIRED';end if;
 perform 1 from public.syncflow_workspaces where id=p_workspace for update;
 update public.syncflow_invitations set status='revoked',revoked_by=p_actor,revoked_at=now() where id=p_invitation and workspace_id=p_workspace and status='pending';
 return found;
end;$$;

create function public.syncflow_accept_invitation(p_actor uuid,p_invitation uuid,p_email text,p_verified boolean)
returns uuid language plpgsql security invoker set search_path='' as $$
declare account_email text:=lower(btrim(p_email)); target_workspace uuid; invitation public.syncflow_invitations%rowtype;
begin
 -- Identity/email come only from the server's verified Auth getUser(), never the browser.
 -- Service-only execution keeps those assertions inside the trusted server boundary.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_actor::text,0));
 if p_verified is distinct from true or account_email is null or account_email='' then raise exception 'VERIFIED_EMAIL_REQUIRED';end if;
 select workspace_id into target_workspace from public.syncflow_invitations where id=p_invitation;
 if target_workspace is null then raise exception 'INVITATION_UNAVAILABLE';end if;
 perform 1 from public.syncflow_workspaces where id=target_workspace for update;
 select * into invitation from public.syncflow_invitations where id=p_invitation for update;
 if invitation.email<>account_email then raise exception 'INVITATION_UNAVAILABLE';end if;
 -- Retrying an accepted invitation is idempotent, but cannot recreate removed access.
 if invitation.status='accepted' and invitation.accepted_by=p_actor and exists(select 1 from public.syncflow_members where user_id=p_actor and workspace_id=target_workspace) then return target_workspace;end if;
 if invitation.status<>'pending' or invitation.expires_at<=now() then raise exception 'INVITATION_UNAVAILABLE';end if;
 perform 1 from public.syncflow_members where user_id=invitation.invited_by and workspace_id=target_workspace and role='owner' for share;
 if not found then raise exception 'INVITATION_UNAVAILABLE';end if;
 if exists(select 1 from public.syncflow_members where user_id=p_actor and workspace_id<>target_workspace) then raise exception 'OTHER_WORKSPACE';end if;
 insert into public.syncflow_members(workspace_id,user_id,role) values(target_workspace,p_actor,'member') on conflict do nothing;
 update public.syncflow_invitations set status='accepted',accepted_by=p_actor,accepted_at=now() where id=p_invitation;
 return target_workspace;
end;$$;

-- Server supplies the verified Auth email, never editable profile claims or browser email.
create function public.syncflow_pending_invitations(p_actor uuid,p_email text,p_verified boolean)
returns table(id uuid,workspace_name text,expires_at timestamptz) language sql stable security invoker set search_path='' as $$
 select i.id,w.name,i.expires_at from public.syncflow_invitations i
 join public.syncflow_workspaces w on w.id=i.workspace_id
 join public.syncflow_members m on m.workspace_id=i.workspace_id and m.user_id=i.invited_by and m.role='owner'
 where p_verified is true and p_actor is not null and i.email=lower(btrim(p_email)) and i.status='pending' and i.expires_at>now() order by i.created_at desc limit 100;
$$;

revoke execute on function public.syncflow_create_invitation(uuid,uuid,text),public.syncflow_revoke_invitation(uuid,uuid,uuid),public.syncflow_accept_invitation(uuid,uuid,text,boolean),public.syncflow_pending_invitations(uuid,text,boolean) from public,anon,authenticated;
grant execute on function public.syncflow_create_invitation(uuid,uuid,text),public.syncflow_revoke_invitation(uuid,uuid,uuid),public.syncflow_accept_invitation(uuid,uuid,text,boolean),public.syncflow_pending_invitations(uuid,text,boolean) to service_role;
