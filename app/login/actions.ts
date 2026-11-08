'use server';
import {workspaceDestination,loginDestination} from '../../lib/auth-destination.js';
import {NEW_PASSWORD_MIN} from '../../lib/auth-messages.js';
import {headers,cookies} from 'next/headers';
import {redirect} from 'next/navigation';
import {passwordResetErrorNotice,resendErrorNotice,resendInputNotice,signInErrorNotice,signInInputNotice,signUpErrorNotice,signUpInputNotice} from '../../lib/auth-messages.js';
import {sessionClient,sharedConfigured} from '../../lib/supabase/server';
import {requestOrigin} from '../../server/request-origin.js';

type Client=Awaited<ReturnType<typeof sessionClient>>;
const field=(form:FormData,name:string)=>String(form.get(name)||'');
const show=(notice:string,form:FormData):never=>redirect(loginDestination(field(form,'next'),{message:notice}));

// Supabase reports most failures as values, but a missing key or network fault can throw.
async function authError(run:(client:Client)=>Promise<{error:{code?:string}|null}>){
 try{return (await run(await sessionClient())).error;}catch{return {code:'unexpected'};}
}
// Confirmation links return here. Supabase must also allow this URL in its Auth redirect settings.
async function confirmationUrl(form:FormData,recovery=false){
 const origin=requestOrigin({headers:await headers()});
 if(!origin)return undefined;
 (await cookies()).set('syncflow-auth-return',JSON.stringify({next:workspaceDestination(field(form,'next')),recovery}),{httpOnly:true,sameSite:'lax',secure:origin.startsWith('https:'),path:'/auth/callback',maxAge:3600});
 return `${origin}/auth/callback`;
}

export async function login(form:FormData){
 if(!sharedConfigured())redirect('/dashboard');
 const email=field(form,'email').trim(),password=field(form,'password');
 const invalid=signInInputNotice(email,password);if(invalid)show(invalid,form);
 const error=await authError(client=>client.auth.signInWithPassword({email,password}));
 if(error)show(signInErrorNotice(error),form);
 redirect(workspaceDestination(field(form,'next')));
}
export async function signup(form:FormData){
 if(!sharedConfigured())redirect('/login');
 const email=field(form,'email').trim(),password=field(form,'password');
 const invalid=signUpInputNotice(email,password);if(invalid)show(invalid,form);
 const emailRedirectTo=await confirmationUrl(form);
 const error=await authError(client=>client.auth.signUp({email,password,options:{emailRedirectTo}}));
 show(error?signUpErrorNotice(error):'check-email',form);
}
export async function resendConfirmation(form:FormData){
 if(!sharedConfigured())redirect('/login');
 const email=field(form,'email').trim();
 const invalid=resendInputNotice(email);if(invalid)show(invalid,form);
 const emailRedirectTo=await confirmationUrl(form);
 const error=await authError(client=>client.auth.resend({type:'signup',email,options:{emailRedirectTo}}));
 show(error?resendErrorNotice(error):'resent',form);
}

export async function requestPasswordReset(form:FormData){
 if(!sharedConfigured())show('reset-unavailable',form);
 if(resendInputNotice(field(form,'email').trim()))show('reset-email',form);
 const redirectTo=await confirmationUrl(form,true);
 const error=await authError(client=>client.auth.resetPasswordForEmail(field(form,'email').trim(),{redirectTo}));
 show(error?'reset-unavailable':'reset-sent',form);
}
export async function updatePassword(form:FormData){
 if(!sharedConfigured())show('reset-unavailable',form);
 const password=field(form,'password');
 if(password.length<NEW_PASSWORD_MIN||password.length>1024)show('reset-password',form);
 if(password!==field(form,'confirm'))show('reset-mismatch',form);
 const client=await sessionClient();
 const {data:{user},error:sessionError}=await client.auth.getUser();
 if(sessionError||!user)show('reset-link-failed',form);
 const error=await authError(client=>client.auth.updateUser({password}));
 if(error)show(passwordResetErrorNotice(error),form);
 redirect(workspaceDestination(field(form,'next')));
}
