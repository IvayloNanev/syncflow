'use server';
import {redirect} from 'next/navigation';
import {sessionClient,sharedConfigured} from '../../lib/supabase/server';
export async function login(form:FormData){
 if(!sharedConfigured())redirect('/coordinator');
 const email=String(form.get('email')||'').trim(),password=String(form.get('password')||'');
 if(email.length>254||password.length>1024||!email.includes('@')||password.length<8)redirect('/login?message=invalid');
 const client=await sessionClient();const {error}=await client.auth.signInWithPassword({email,password});
 if(error)redirect('/login?message=invalid');redirect('/coordinator');
}
export async function signup(form:FormData){
 if(!sharedConfigured())redirect('/login');
 const email=String(form.get('email')||'').trim(),password=String(form.get('password')||'');
 if(email.length>254||password.length>1024||!email.includes('@')||password.length<12)redirect('/login?message=password');
 const client=await sessionClient();
 const {error}=await client.auth.signUp({email,password});
 if(error)redirect('/login?message=signup');redirect('/login?message=check-email');
}
