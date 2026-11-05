'use server';
import {headers} from 'next/headers';
import {redirect} from 'next/navigation';
import {resendErrorNotice,resendInputNotice,signInErrorNotice,signInInputNotice,signUpErrorNotice,signUpInputNotice} from '../../lib/auth-messages.js';
import {sessionClient,sharedConfigured} from '../../lib/supabase/server';
import {requestOrigin} from '../../server/request-origin.js';

type Client=Awaited<ReturnType<typeof sessionClient>>;
const field=(form:FormData,name:string)=>String(form.get(name)||'');
const show=(notice:string):never=>redirect(`/login?message=${notice}`);

// Supabase reports most failures as values, but a missing key or network fault can throw.
async function authError(run:(client:Client)=>Promise<{error:{code?:string}|null}>){
 try{return (await run(await sessionClient())).error;}catch{return {code:'unexpected'};}
}
// Confirmation links return here. Supabase must also allow this URL in its Auth redirect settings.
async function confirmationUrl(){
 const origin=requestOrigin({headers:await headers()});
 return origin?`${origin}/auth/callback`:undefined;
}

export async function login(form:FormData){
 if(!sharedConfigured())redirect('/coordinator');
 const email=field(form,'email').trim(),password=field(form,'password');
 const invalid=signInInputNotice(email,password);if(invalid)show(invalid);
 const error=await authError(client=>client.auth.signInWithPassword({email,password}));
 if(error)show(signInErrorNotice(error));
 redirect('/coordinator');
}
export async function signup(form:FormData){
 if(!sharedConfigured())redirect('/login');
 const email=field(form,'email').trim(),password=field(form,'password');
 const invalid=signUpInputNotice(email,password);if(invalid)show(invalid);
 const emailRedirectTo=await confirmationUrl();
 const error=await authError(client=>client.auth.signUp({email,password,options:{emailRedirectTo}}));
 show(error?signUpErrorNotice(error):'check-email');
}
export async function resendConfirmation(form:FormData){
 if(!sharedConfigured())redirect('/login');
 const email=field(form,'email').trim();
 const invalid=resendInputNotice(email);if(invalid)show(invalid);
 const emailRedirectTo=await confirmationUrl();
 const error=await authError(client=>client.auth.resend({type:'signup',email,options:{emailRedirectTo}}));
 show(error?resendErrorNotice(error):'resent');
}
