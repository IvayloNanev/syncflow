import AuthSubmit from '../../components/auth-submit';
import Link from 'next/link';
import {NEW_PASSWORD_MIN,noticeFor} from '../../lib/auth-messages.js';
import {login,resendConfirmation,signup} from './actions';

const EmailField=()=><><label htmlFor="email">Email</label><input id="email" name="email" type="email" autoComplete="email" maxLength={254} required/></>;

function SignIn(){
 return <>
  <h1>Sign in</h1>
  <p>Open your team’s licensing requests.</p>
  <form action={login}>
   <EmailField/>
   <label htmlFor="password">Password</label>
   <input id="password" name="password" type="password" autoComplete="current-password" maxLength={1024} required/>
   <AuthSubmit label="Sign in" pendingLabel="Signing in…"/>
  </form>
  <p className="auth-switch">New to SyncFlow? <Link href="/login?mode=signup">Create an account</Link></p>
 </>;
}

function SignUp(){
 return <>
  <h1>Create your account</h1>
  <p>Next you’ll confirm your email. A workspace owner then adds you to your team, and until then you won’t see any requests.</p>
  <form action={signup}>
   <EmailField/>
   <label htmlFor="password">Password</label>
   <input id="password" name="password" type="password" autoComplete="new-password" minLength={NEW_PASSWORD_MIN} maxLength={1024} aria-describedby="password-help" required/>
   <p id="password-help" className="auth-help">At least {NEW_PASSWORD_MIN} characters.</p>
   <AuthSubmit label="Create account" pendingLabel="Creating account…"/>
  </form>
  <p className="auth-switch">Already have an account? <Link href="/login">Sign in</Link></p>
 </>;
}

function Verify(){
 return <>
  <h1>Check your email</h1>
  <ol className="auth-steps">
   <li>Open the confirmation email. It can take a few minutes, so check your spam folder too.</li>
   <li>Open the link in this same browser.</li>
   <li>A workspace owner adds you to your team. You can’t open requests until they do.</li>
  </ol>
  <form action={resendConfirmation}>
   <EmailField/>
   <AuthSubmit label="Send a new link" pendingLabel="Sending…"/>
  </form>
  <p className="auth-switch"><Link href="/login">Back to sign in</Link></p>
 </>;
}

export default async function Login({searchParams}:{searchParams:Promise<{message?:string;mode?:string}>}){
 const {message,mode}=await searchParams;
 const notice=noticeFor(message);
 const view=notice?.view??(mode==='signup'?'signup':'signin');
 return <main className="workspace-theme auth-page"><section className="auth-card">
  <Link href="/" className="auth-brand">syncflow.</Link>
  <p className="eyebrow">YOUR MUSIC LICENSING WORKSPACE</p>
  {notice&&<p role={notice.tone==='error'?'alert':'status'} className={`auth-notice auth-notice-${notice.tone}`}>{notice.text}</p>}
  {view==='signup'?<SignUp/>:view==='verify'?<Verify/>:<SignIn/>}
 </section></main>;
}
