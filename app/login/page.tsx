import {workspaceSession} from '../../lib/supabase/server';
import AccountMenu from '../../components/account-menu';
import Link from 'next/link';
import {login,signup} from './actions';
const messages:Record<string,string>={invalid:'Unable to sign in. Check your details and confirm your email.',password:'Use a valid email and a password of at least 12 characters.',signup:'Unable to create the account. Try again later.',membership:'You are signed in. A workspace owner must add your account before you can open requests.', 'check-email':'Check your inbox to confirm your account, then sign in. Workspace membership is granted separately.'};
export default async function Login({searchParams}:{searchParams:Promise<{message?:string}>}){
 const {message}=await searchParams;
 const session=message==='membership'?await workspaceSession():null;
 return <main className="workspace-theme auth-page"><section className="auth-card"><Link href="/" className="auth-brand">syncflow.</Link><p className="eyebrow">YOUR MUSIC LICENSING WORKSPACE</p><h1>Welcome back.</h1><p>Sign in to work on your team’s requests.</p>{message&&messages[message]&&<p role="status" className="auth-notice">{messages[message]}</p>}
 {session&&<AccountMenu email={session.user.email}/>}
 <form><label htmlFor="email">Email</label><input id="email" name="email" type="email" autoComplete="email" maxLength={254} required/><label htmlFor="password">Password</label><input id="password" name="password" type="password" autoComplete="current-password" minLength={8} maxLength={1024} required/><button formAction={login}>Sign in</button><button className="auth-secondary" formAction={signup}>Create account</button><p className="auth-help">New account? Use at least 12 characters. Creating an account does not grant access to another team’s data.</p></form></section></main>;
}
