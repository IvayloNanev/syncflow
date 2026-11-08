import 'server-only';
import {storageClient,workspaceSession} from './server';
import {invitationEmail,invitationError} from '../team-invitations.js';
export type Invite={id:string;email:string;status:string;created_at:string;expires_at:string;accepted_at:string|null;revoked_at:string|null};
export type PendingInvite={id:string;workspace_name:string;expires_at:string};
export async function pendingInvitations(user:{id:string;email?:string;email_confirmed_at?:string}):Promise<PendingInvite[]>{
 const {data,error}=await storageClient().rpc('syncflow_pending_invitations',{p_actor:user.id,p_email:user.email||'',p_verified:!!user.email_confirmed_at});
 if(error)throw new Error('Invitations could not load. Try again.');
 return data||[];
}
export async function ownerInvitations(){
 const session=await workspaceSession();
 if(!session?.workspaceId||session.role!=='owner')throw new Error('Only a workspace owner can manage invitations.');
 const {data,error}=await storageClient().from('syncflow_invitations').select('id,email,status,created_at,expires_at,accepted_at,revoked_at').eq('workspace_id',session.workspaceId).order('created_at',{ascending:false}).limit(100);
 if(error)throw new Error('Invitations could not load. Try again.');
 return (data||[]) as Invite[];
}
export async function changeInvitation(action:string,input:{email?:string;invitationId?:string}){
 const session=await workspaceSession();
 if(!session)throw new Error('Sign in before managing an invitation.');
 if(action==='accept'){
  if(!session.user.email_confirmed_at)throw new Error('Verify your account email before accepting an invitation.');
  if(!/^[0-9a-f-]{36}$/i.test(input.invitationId||''))throw new Error('This invitation is unavailable.');
  const {error}=await storageClient().rpc('syncflow_accept_invitation',{p_actor:session.user.id,p_invitation:input.invitationId,p_email:session.user.email||'',p_verified:!!session.user.email_confirmed_at});
  if(error)throw new Error(invitationError(error));
  return;
 }
 if(!session.workspaceId||session.role!=='owner')throw new Error('Only a workspace owner can manage invitations.');
 const params={p_actor:session.user.id,p_workspace:session.workspaceId};
 if(action==='create'){
  const email=invitationEmail(input.email);if(!email)throw new Error('Enter a complete email address.');
  if(email===session.user.email?.toLowerCase())throw new Error('Your account already belongs to this workspace.');
  const {error}=await storageClient().rpc('syncflow_create_invitation',{...params,p_email:email});
  if(error)throw new Error(invitationError(error));
 }else if(action==='revoke'){
  if(!/^[0-9a-f-]{36}$/i.test(input.invitationId||''))throw new Error('This invitation is unavailable.');
  const {error}=await storageClient().rpc('syncflow_revoke_invitation',{...params,p_invitation:input.invitationId});
  if(error)throw new Error(invitationError(error));
 }else throw new Error('Unknown invitation action.');
}
