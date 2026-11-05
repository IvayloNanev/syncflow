import Link from 'next/link';
import {redirect} from 'next/navigation';
import AccountMenu from '../../components/account-menu';
import {noAccessCopy} from '../../lib/auth-messages.js';
import {sharedConfigured,workspaceSession} from '../../lib/supabase/server';

// Access changes per request, so this must never be prerendered, even in a build without Supabase values.
export const dynamic='force-dynamic';

// Shown only to a signed-in account without exactly one workspace. Reveals no team data.
export default async function NoAccess(){
 if(!sharedConfigured())redirect('/coordinator');
 const session=await workspaceSession();
 if(!session)redirect('/login');
 if(session.workspaceId)redirect('/coordinator');
 const copy=noAccessCopy(session.membershipCount);
 return <main className="workspace-theme auth-page"><section className="auth-card">
  <Link href="/" className="auth-brand">syncflow.</Link>
  <p className="eyebrow">YOUR MUSIC LICENSING WORKSPACE</p>
  <h1>{copy.title}</h1>
  <p>{copy.explanation}</p>
  <p className="auth-account-label">Signed in as</p>
  <AccountMenu email={session.user.email}/>
  <h2 className="auth-subheading">What to do next</h2>
  <p>{copy.nextStep}</p>
  <p className="auth-switch"><Link href="/coordinator" prefetch={false}>Check my access again</Link></p>
 </section></main>;
}
