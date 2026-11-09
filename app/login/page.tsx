import SiteHeader from '../../components/site-header';
import {googleAuthEnabled} from '../../lib/google-auth';
import landing from "../landing.module.css";
import styles from "./login.module.css";
import {redirect} from 'next/navigation';
import {sessionClient,sharedConfigured} from '../../lib/supabase/server';
import {workspaceDestination,loginDestination} from '../../lib/auth-destination.js';
import AuthSubmit from '../../components/auth-submit';
import Link from 'next/link';
import {NEW_PASSWORD_MIN,noticeFor} from '../../lib/auth-messages.js';
import {loginWithGoogle,login,resendConfirmation,signup,requestPasswordReset,updatePassword} from './actions';

const EmailField=()=><><label htmlFor="email">Email</label><input id="email" name="email" type="email" autoComplete="email" maxLength={254} required/></>;

function GoogleEntry({next}:{next:string}){return <><form action={loginWithGoogle} className={styles.googleForm}><input type="hidden" name="next" value={next}/><AuthSubmit label="Continue with Google" pendingLabel="Connecting to Google…"/></form><div className={styles.divider}><span>or use email</span></div></>;}

function SignIn({next,google}:{next:string;google:boolean}){
 return <>
  <h1>Sign in</h1>
  <p>Open your team’s licensing requests.</p>
  {google&&<GoogleEntry next={next}/>}
  <form action={login}>
   <input type="hidden" name="next" value={next}/><EmailField/>
   <label htmlFor="password">Password</label>
   <input id="password" name="password" type="password" autoComplete="current-password" maxLength={1024} required/>
   <AuthSubmit label="Sign in" pendingLabel="Signing in…"/>
  </form>
  <p className="auth-switch"><Link href={loginDestination(next,{mode:"forgot"})}>Forgot password?</Link></p>
  <p className="auth-switch">New to SyncFlow? <Link href={loginDestination(next,{mode:"signup"})}>Create an account</Link></p>
 </>;
}

function SignUp({next,google}:{next:string;google:boolean}){
 return <>
  <h1>Create your account</h1>
  <p>Use Google or create an account with email. You’ll need a workspace invitation to view requests.</p>
  {google&&<GoogleEntry next={next}/>}
  <form action={signup}>
   <input type="hidden" name="next" value={next}/><EmailField/>
   <label htmlFor="password">Password</label>
   <input id="password" name="password" type="password" autoComplete="new-password" minLength={NEW_PASSWORD_MIN} maxLength={1024} aria-describedby="password-help" required/>
   <p id="password-help" className="auth-help">At least {NEW_PASSWORD_MIN} characters.</p>
   <AuthSubmit label="Create account" pendingLabel="Creating account…"/>
  </form>
  <p className="auth-switch">Already have an account? <Link href={loginDestination(next)}>Sign in</Link></p>
 </>;
}

function Verify({next}:{next:string}){
 return <>
  <h1>Check your email</h1>
  <ol className="auth-steps">
   <li>Open the confirmation email. It can take a few minutes, so check your spam folder too.</li>
   <li>Open the link in this same browser.</li>
   <li>A workspace owner adds you to your team. You can’t open requests until they do.</li>
  </ol>
  <form action={resendConfirmation}>
   <input type="hidden" name="next" value={next}/><EmailField/>
   <AuthSubmit label="Send a new link" pendingLabel="Sending…"/>
  </form>
  <p className="auth-switch"><Link href={loginDestination(next)}>Back to sign in</Link></p>
 </>;
}

function Recovery({next,reset}:{next:string;reset:boolean}){
 return <><h1>{reset?'Set a new password':'Reset your password'}</h1><p>{reset?'Choose a new password, then return to your request.':'We’ll email a reset link. Open it in this same browser.'}</p><form action={reset?updatePassword:requestPasswordReset}>
 <input type="hidden" name="next" value={next}/>
 {reset?<><label htmlFor="password">New password</label><input id="password" name="password" type="password" autoComplete="new-password" minLength={NEW_PASSWORD_MIN} maxLength={1024} required/><label htmlFor="confirm">Confirm new password</label><input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={NEW_PASSWORD_MIN} maxLength={1024} required/><p className="auth-help">At least {NEW_PASSWORD_MIN} characters.</p></>:<EmailField/>}
 <AuthSubmit label={reset?'Save password & continue':'Send reset link'} pendingLabel={reset?'Saving…':'Sending…'}/></form><p className="auth-switch"><Link href={loginDestination(next)}>Back to sign in</Link></p></>;
}

export default async function Login({searchParams}:{searchParams:Promise<{message?:string;mode?:string;next?:string}>}){
 const {message,mode,next:destination}=await searchParams;
 const next=workspaceDestination(destination);
 const google=await googleAuthEnabled();
 const notice=noticeFor(message);
 const view=notice?.view??(['signup','forgot','reset'].includes(mode||'')?mode:'signin');
 if(sharedConfigured()){const {data:{user}}=await (await sessionClient()).auth.getUser();if(view==='reset'&&!user)redirect(loginDestination(next,{message:'reset-link-failed'}));if(user&&view==='signin')redirect(next);}
 return <div className={`workspace-theme ${landing.page} ${styles.page}`}><SiteHeader><Link className={styles.home} href="/">Back to home</Link></SiteHeader><main className={styles.main}><div className={`${landing.record} ${styles.record}`} aria-hidden="true"><div /></div><section className={`auth-card ${styles.card}`} aria-label="Account access">
  <p className={styles.eyebrow}>YOUR MUSIC LICENSING WORKSPACE</p>
  {notice&&<p role={notice.tone==='error'?'alert':'status'} className={`auth-notice auth-notice-${notice.tone}`}>{notice.text}</p>}
  {view==='signup'?<SignUp next={next} google={google}/>:view==='verify'?<Verify next={next}/>:view==='forgot'||view==='reset'?<Recovery next={next} reset={view==='reset'}/>:<SignIn next={next} google={google}/>}
 </section></main><footer className={landing.footer}><span>Less admin. More momentum.</span><span>SyncFlow</span></footer></div>;
}
