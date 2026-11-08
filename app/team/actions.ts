'use server';
import {revalidatePath} from 'next/cache';
import {redirect} from 'next/navigation';
import {changeInvitation} from '../../lib/supabase/team';
import {sharedConfigured} from '../../lib/supabase/server';
export async function manageInvitation(_previous:{message:string;ok:boolean},form:FormData){
 const action=String(form.get('action')||'');
 if(!sharedConfigured())return {ok:false,message:'Team invitations require the shared backend.'};
 try{await changeInvitation(action,{email:String(form.get('email')||''),invitationId:String(form.get('invitation_id')||'')});}
 catch(error){return {ok:false,message:error instanceof Error?error.message:'The invitation could not be updated.'};}
 revalidatePath('/team');revalidatePath('/no-access');revalidatePath('/invitations');
 if(action==='accept')redirect('/dashboard');
 return {ok:true,message:action==='create'?'Invitation created or already pending. It expires after seven days. No email has been sent; share the invitation instructions below.':'Pending invitation revoked. Accepted memberships are unchanged.'};
}
