// Opt-in hosted test: only disposable identities/workspaces; no email or model calls.
import {config} from 'dotenv';
import {createClient} from '@supabase/supabase-js';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
config({path:'.env.local',quiet:true});
if(process.env.SYNCFLOW_LIVE_TEST!=='1')throw new Error('Set SYNCFLOW_LIVE_TEST=1 to create disposable auth fixtures.');
const origin=process.env.SYNCFLOW_TEST_APP_URL||'http://127.0.0.1:3000';
const admin=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SECRET_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const publicClient=()=>createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const must=r=>{if(r.error)throw new Error(`Auth fixture failed (${r.error.code||'provider'})`);return r.data;};
const email=`syncflow-auth-check-${randomUUID()}@example.invalid`,password=`Check-${randomUUID()}-aA7!`,replacement=`Check-${randomUUID()}-aA7!`,workspace=randomUUID();
let user,created=false;const jar=new Map();
async function call(path,options={}){const response=await fetch(new URL(path,origin),{...options,redirect:'manual',headers:{cookie:[...jar].map(([k,v])=>`${k}=${v}`).join('; '),origin,...options.headers}});for(const cookie of response.headers.getSetCookie()){const pair=cookie.split(';')[0],at=pair.indexOf('=');jar.set(pair.slice(0,at),pair.slice(at+1));}return response;}
async function submit(path,fields){const page=await call(path);const html=await page.text();const formHtml=[...html.matchAll(/<form\b[^>]*>[\s\S]*?<\/form>/g)].map(match=>match[0]).find(value=>Object.keys(fields).every(key=>new RegExp(`name="${key}"`).test(value)));const id=formHtml?.match(/name="(\$ACTION_ID_[^"]+)"/);assert.ok(id,'server action form exists');const form=new FormData();form.set(id[1],'');for(const [key,value] of Object.entries(fields))form.set(key,value);return call(path,{method:'POST',body:form});}
try{
 user=must(await admin.auth.admin.createUser({email,password,email_confirm:true})).user;
 must(await admin.from('syncflow_workspaces').insert({id:workspace,name:`Disposable auth check ${workspace}`}));created=true;
 const next='/internal?request=00000000-0000-4000-8000-000000000000';
 const entry=await call(next);assert.equal(entry.status,307);assert.equal(new URL(entry.headers.get('location'),origin).searchParams.get('next'),next);
 const signin=await submit(`/login?next=${encodeURIComponent(next)}`,{email,password,next});assert.equal(signin.status,303);assert.equal(signin.headers.get('location'),next);
 const noAccess=await call(next);assert.equal(new URL(noAccess.headers.get('location'),origin).searchParams.get('next'),next);
 const waiting=await call(`/no-access?next=${encodeURIComponent(next)}`);assert.match(await waiting.text(),/not on a team yet/);
 must(await admin.from('syncflow_members').insert({workspace_id:workspace,user_id:user.id,role:'member'}));
 const recheck=await call(`/no-access?next=${encodeURIComponent(next)}`);assert.equal(recheck.headers.get('location'),next);
 const landing=await call('/');assert.match(await landing.text(),/Open workspace/);
 const resetPath=`/login?mode=reset&next=${encodeURIComponent(next)}`;
 const reused=await submit(resetPath,{password,confirm:password,next});assert.equal(new URL(reused.headers.get('location'),origin).searchParams.get('message'),'reset-same-password');
 const mismatch=await submit(resetPath,{password:replacement,confirm:'different',next});assert.equal(new URL(mismatch.headers.get('location'),origin).searchParams.get('message'),'reset-mismatch');
 const updated=await submit(resetPath,{password:replacement,confirm:replacement,next});assert.equal(updated.status,303);assert.equal(updated.headers.get('location'),next);
 assert.ok((await publicClient().auth.signInWithPassword({email,password})).error,'old test password no longer works');
 must(await publicClient().auth.signInWithPassword({email,password:replacement}));
 const signedOut=await call('/auth/signout',{method:'POST'});assert.equal(signedOut.status,303);
 const unauthReset=await call(resetPath);assert.equal(new URL(unauthReset.headers.get('location'),origin).searchParams.get('message'),'reset-link-failed');
 jar.set('syncflow-auth-return',encodeURIComponent(JSON.stringify({next,recovery:true})));
 const failedLink=await call('/auth/callback');assert.equal(new URL(failedLink.headers.get('location'),origin).searchParams.get('message'),'reset-link-failed');
 const defaultSignin=await submit('/login',{email,password:replacement});assert.equal(defaultSignin.headers.get('location'),'/dashboard');
 const dashboard=await call('/dashboard');assert.equal(dashboard.status,200);assert.match(await dashboard.text(),/Client history/);
 console.log('PASS: default dashboard landing, deep-link sign-in, membership recheck, signed-in landing, password validation/update, sign-out and expired recovery link. No emails sent.');
}finally{
 if(created){must(await admin.from('syncflow_members').delete().eq('workspace_id',workspace));must(await admin.from('syncflow_workspaces').delete().eq('id',workspace));}
 if(user)must(await admin.auth.admin.deleteUser(user.id));
 console.log('Disposable auth identity and workspace removed.');
}
