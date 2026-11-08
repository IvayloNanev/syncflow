import Link from 'next/link';
import {redirect} from 'next/navigation';
import AccountMenu from '../../components/account-menu';
import {PendingInvitations} from '../../components/team-invitations';
import {pendingInvitations,type PendingInvite} from '../../lib/supabase/team';
import {sessionClient,sharedConfigured} from '../../lib/supabase/server';
import {loginDestination} from '../../lib/auth-destination.js';
export const dynamic='force-dynamic';
export default async function Invitations(){
 if(!sharedConfigured())redirect('/coordinator');
 const {data:{user}}=await (await sessionClient()).auth.getUser();
 if(!user)redirect(loginDestination('/invitations'));
 let invitations:PendingInvite[]=[],error='';
 try{invitations=await pendingInvitations(user);}catch{error='Invitations could not load. Refresh this page to try again.';}
 return <main className="workspace-theme auth-page"><section className="auth-card invitations-card"><Link href="/" className="auth-brand">syncflow.</Link><h1>Join your team</h1><p>Signed in as {user.email}. Invitations match your verified account email.</p><AccountMenu email={user.email}/>{error?<p role="alert">{error}</p>:<PendingInvitations invitations={invitations}/>}<p><Link href="/coordinator">Open workspace</Link></p></section></main>;
}
