import Link from 'next/link';
import {headers} from 'next/headers';
import AccountMenu from '../../components/account-menu';
import PageNavigation from '../../components/page-navigation';
import TeamInvitations from '../../components/team-invitations';
import {requireWorkspace} from '../../lib/supabase/access';
import {ownerInvitations,type Invite} from '../../lib/supabase/team';
import {requestOrigin} from '../../server/request-origin.js';
export const dynamic='force-dynamic';
export default async function Team(){
 const session=await requireWorkspace('/team');
 if(!session)return <main className="workspace-theme auth-page"><section className="auth-card"><h1>Team invitations need a shared workspace</h1><Link href="/coordinator">Back to coordinator</Link></section></main>;
 let invitations:Invite[]=[],error='';
 if(session.role==='owner'){try{invitations=await ownerInvitations();}catch{error='Invitations could not load. Refresh to try again.';}}
 const origin=requestOrigin({headers:await headers()});
 return <div className="workspace-theme"><header className="portal-bar"><Link href="/">SyncFlow · Team</Link><PageNavigation current="team"/><AccountMenu email={session.user.email}/></header><main className="team-workspace"><p className="eyebrow">WORKSPACE ACCESS</p><h1>Team invitations</h1><p>Signed in as {session.user.email} · {session.role==='owner'?'Workspace owner':'Workspace member'}</p>{session.role!=='owner'?<section className="result-panel"><h2>Owner access required</h2><p>Ask your workspace owner to invite teammates. Your existing workspace access is unchanged.</p></section>:error?<p role="alert" className="analysis-error">{error}</p>:origin?<TeamInvitations invitations={invitations} joinUrl={`${origin}/invitations`}/>:<p role="alert">The app address is not configured. Set the deployment origin before sharing invitations.</p>}</main></div>;
}
