import WorkspacePicker from '../../components/workspace-picker';
import {workspaceDestination,loginDestination} from '../../lib/auth-destination.js';
import {PendingInvitations} from '../../components/team-invitations';
import {pendingInvitations,type PendingInvite} from '../../lib/supabase/team';
import Link from 'next/link';
import {redirect} from 'next/navigation';
import AccountMenu from '../../components/account-menu';
import {noAccessCopy} from '../../lib/auth-messages.js';
import {sharedConfigured,workspaceSession} from '../../lib/supabase/server';

// Access changes per request, so this must never be prerendered, even in a build without Supabase values.
export const dynamic='force-dynamic';

// Shown only to a signed-in account without exactly one workspace. Reveals no team data.
export default async function NoAccess({searchParams}:{searchParams:Promise<{next?:string}>}){
 const next=workspaceDestination((await searchParams).next);
 if(!sharedConfigured())redirect('/coordinator');
 const session=await workspaceSession();
 if(!session)redirect(loginDestination(next));
 if(session.workspaceId)redirect(next);
 const copy=noAccessCopy(session.membershipCount);
 let invitations:PendingInvite[]=[],invitationError='';
 try{invitations=await pendingInvitations(session.user);}catch{invitationError='Invitations could not load. Refresh to try again.';}
 return <main className="workspace-theme auth-page"><section className="auth-card">
  <Link href="/" className="auth-brand">syncflow.</Link>
  <p className="eyebrow">YOUR MUSIC LICENSING WORKSPACE</p>
  <h1>{session.membershipCount>1?'Choose your workspace':copy.title}</h1>
  <p>{session.membershipCount>1?'Choose which workspace you want to open.':copy.explanation}</p>
  {session.membershipCount>1&&<WorkspacePicker/>}
  <p className="auth-account-label">Signed in as</p>
  <AccountMenu email={session.user.email}/>
  {session.membershipCount<2&&(invitationError?<p role="alert">{invitationError}</p>:<PendingInvitations invitations={invitations}/>)}
  <h2 className="auth-subheading">What to do next</h2>
  <p>{session.membershipCount>1?'Select a workspace above and choose Open workspace. Each workspace keeps its requests separate.':copy.nextStep}</p>
  <p className="auth-switch"><Link href={next} prefetch={false}>Check my access again</Link></p>
 </section></main>;
}
