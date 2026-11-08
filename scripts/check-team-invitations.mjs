// Opt-in live test. Creates only disposable users/workspaces; sends no email.
import {config} from 'dotenv';
import {createClient} from '@supabase/supabase-js';
import {createServerClient} from '@supabase/ssr';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
config({path:'.env.local',quiet:true});
if(process.env.SYNCFLOW_LIVE_TEST!=='1')throw new Error('Set SYNCFLOW_LIVE_TEST=1 to create disposable invitation fixtures.');
const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const admin=createClient(url,process.env.SUPABASE_SECRET_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const origin=process.env.SYNCFLOW_TEST_APP_URL||'http://127.0.0.1:3000';
const workspaces=[randomUUID(),randomUUID()],users=[];let created=false;
const must=r=>{if(r.error)throw new Error(`Invitation test provider failure (${r.error.code||r.error.message})`);return r.data;};
const rpc=(name,args)=>admin.rpc(`syncflow_${name}`,args);
const denied=async result=>assert.ok((await result).error,'access must be denied');
const decode=s=>s.replaceAll('&quot;','"').replaceAll('&#x27;',"'").replaceAll('&amp;','&').replaceAll('&lt;','<').replaceAll('&gt;','>');
async function call(user,path,options={}){return fetch(new URL(path,origin),{...options,redirect:'manual',headers:{cookie:user.cookie(),origin,...options.headers}});}
async function action(user,path,operation,fields){
 const html=await (await call(user,path)).text();
 const form=[...html.matchAll(/<form\b[^>]*>([\s\S]*?)<\/form>/g)].map(m=>m[1]).find(body=>body.includes(`name="action" value="${operation}"`));assert.ok(form,`${operation} form visible`);
 const data=new FormData();for(const input of form.matchAll(/<input\b[^>]*>/g)){const name=input[0].match(/name="([^"]*)"/)?.[1],value=input[0].match(/value="([^"]*)"/)?.[1];if(name)data.set(decode(name),decode(value||''));}
 for(const [name,value] of Object.entries(fields))data.set(name,value);
 return call(user,path,{method:'POST',body:data});
}
try{
 must(await admin.from('syncflow_workspaces').insert(workspaces.map(id=>({id,name:`Disposable invitation check ${id}`}))));created=true;
 for(let i=0;i<5;i++){
  const email=`syncflow-invitation-${randomUUID()}@example.invalid`,password=`Test-${randomUUID()}-aA7!`;
  const user=must(await admin.auth.admin.createUser({email,password,email_confirm:true})).user;users.push(user);
  const jar=new Map();const client=createServerClient(url,key,{cookies:{getAll:()=>[...jar].map(([name,value])=>({name,value})),setAll:values=>values.forEach(({name,value})=>jar.set(name,value))}});
  must(await client.auth.signInWithPassword({email,password}));user.cookie=()=>[...jar].map(([name,value])=>`${name}=${value}`).join('; ');user.client=client;
 }
 const [owner,otherOwner,member,recipient,stranger]=users;
 must(await admin.from('syncflow_members').insert([{workspace_id:workspaces[0],user_id:owner.id,role:'owner'},{workspace_id:workspaces[1],user_id:otherOwner.id,role:'owner'},{workspace_id:workspaces[0],user_id:member.id,role:'member'}]));
 await denied(rpc('create_invitation',{p_actor:member.id,p_workspace:workspaces[0],p_email:recipient.email}));
 await denied(rpc('create_invitation',{p_actor:otherOwner.id,p_workspace:workspaces[0],p_email:recipient.email}));
 await denied(member.client.rpc('syncflow_create_invitation',{p_actor:owner.id,p_workspace:workspaces[0],p_email:recipient.email}));
 assert.ok((await member.client.from('syncflow_invitations').select('email')).error,'invitation addresses are not client-readable');
 const createdResponse=await action(owner,'/team','create',{email:recipient.email});assert.equal(createdResponse.status,200);assert.match(await createdResponse.text(),/Invitation created or already pending/);
 const invitation=must(await admin.from('syncflow_invitations').select('id,expires_at,created_at').eq('workspace_id',workspaces[0]).eq('email',recipient.email).single());
 assert.ok(Date.parse(invitation.expires_at)-Date.parse(invitation.created_at)===7*86400000);
 assert.equal(must(await rpc('create_invitation',{p_actor:owner.id,p_workspace:workspaces[0],p_email:recipient.email.toUpperCase()})),invitation.id,'duplicate creation reuses pending invitation');
 const waiting=await call(recipient,'/no-access');assert.match(await waiting.text(),/Accept invitation/);
 const notMine=must(await rpc('pending_invitations',{p_actor:stranger.id,p_email:stranger.email,p_verified:true}));assert.equal(notMine.length,0);
 const forged=await action(recipient,'/invitations','accept',{invitation_id:invitation.id,email:stranger.email,role:'owner',actor_id:owner.id});assert.equal(forged.status,303,'browser-supplied identity and role ignored');
 const membership=must(await admin.from('syncflow_members').select('role').eq('user_id',recipient.id).single());assert.equal(membership.role,'member');
 assert.equal(must(await rpc('accept_invitation',{p_actor:recipient.id,p_invitation:invitation.id,p_email:recipient.email,p_verified:true})),workspaces[0],'accept retry is idempotent');
 // Revocation, expiry and verified-email boundary.
 const wrong=must(await rpc('create_invitation',{p_actor:owner.id,p_workspace:workspaces[0],p_email:stranger.email}));
 await denied(rpc('accept_invitation',{p_actor:member.id,p_invitation:wrong,p_email:member.email,p_verified:true}));
 await denied(rpc('accept_invitation',{p_actor:stranger.id,p_invitation:wrong,p_email:stranger.email,p_verified:false}));
 const revokeResponse=await action(owner,'/team','revoke',{invitation_id:wrong});assert.equal(revokeResponse.status,200);await denied(rpc('accept_invitation',{p_actor:stranger.id,p_invitation:wrong,p_email:stranger.email,p_verified:true}));
 const expired=must(await rpc('create_invitation',{p_actor:owner.id,p_workspace:workspaces[0],p_email:stranger.email}));
 must(await admin.from('syncflow_invitations').update({created_at:new Date(Date.now()-9*86400000).toISOString(),expires_at:new Date(Date.now()-86400000).toISOString()}).eq('id',expired));
 await denied(rpc('accept_invitation',{p_actor:stranger.id,p_invitation:expired,p_email:stranger.email,p_verified:true}));
 // New invitation refreshes an expired record, but never reuses its ID.
 const fresh=must(await rpc('create_invitation',{p_actor:owner.id,p_workspace:workspaces[0],p_email:stranger.email}));assert.notEqual(fresh,expired);
 const second=must(await rpc('create_invitation',{p_actor:otherOwner.id,p_workspace:workspaces[1],p_email:stranger.email}));
 const outcomes=await Promise.all([rpc('accept_invitation',{p_actor:stranger.id,p_invitation:fresh,p_email:stranger.email,p_verified:true}),rpc('accept_invitation',{p_actor:stranger.id,p_invitation:second,p_email:stranger.email,p_verified:true})]);assert.equal(outcomes.filter(r=>!r.error).length,1,'one account cannot join two workspaces concurrently');
 const memberships=must(await admin.from('syncflow_members').select('workspace_id').eq('user_id',stranger.id));assert.equal(memberships.length,1);
 const ownerless=must(await rpc('create_invitation',{p_actor:owner.id,p_workspace:workspaces[0],p_email:'unused@example.invalid'}));
 must(await admin.from('syncflow_members').update({role:'member'}).eq('user_id',owner.id));
 await denied(rpc('accept_invitation',{p_actor:stranger.id,p_invitation:ownerless,p_email:'unused@example.invalid',p_verified:true}));
 const formerOwner=await call(owner,'/team');assert.match(await formerOwner.text(),/Owner access required/);
 console.log('PASS: owner-only creation/revocation, pending visibility, verified email, expiry, duplicate/retry safety, member-only acceptance, client privilege denial and concurrent workspace isolation. No email sent.');
}finally{
 if(created){must(await admin.from('syncflow_invitations').delete().in('workspace_id',workspaces));must(await admin.from('syncflow_members').delete().in('workspace_id',workspaces));must(await admin.from('syncflow_workspaces').delete().in('id',workspaces));}
 for(const user of users)must(await admin.auth.admin.deleteUser(user.id));
 console.log('Disposable invitation fixtures removed.');
}
