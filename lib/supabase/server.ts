import 'server-only';
import type {User} from '@supabase/supabase-js';
import {DEMO_COOKIE,readDemoSession} from '../../server/demo-policy.js';
import {selectWorkspace} from '../workspace-selection.js';
import {createServerClient} from '@supabase/ssr';
import {createClient} from '@supabase/supabase-js';
import {cookies} from 'next/headers';
export function sharedConfigured(){return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);}
export async function sessionClient(){
 const jar=await cookies();
 return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,{
  cookies:{getAll:()=>jar.getAll(),setAll(values){try{values.forEach(({name,value,options})=>jar.set(name,value,options));}catch{/* Proxy refreshes server-component sessions. */}}}
 });
}
export function storageClient(){if(!process.env.SUPABASE_SECRET_KEY)throw new Error('Shared storage is not configured');return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SECRET_KEY!,{auth:{persistSession:false,autoRefreshToken:false}});}
export async function workspaceSession(){
 const token=(await cookies()).get(DEMO_COOKIE)?.value;
 // A demo cookie selects only its private server-owned workspace, even if the
 // browser also has a real sign-in. Never fall through to real data on expiry.
 if(token){
  const guest=await readDemoSession(storageClient(),token);if(!guest)return null;
  const user:User={id:guest.actor_id,aud:'authenticated',created_at:'',app_metadata:{},user_metadata:{name:'Demo visitor'},is_anonymous:true};
  return {user,workspaceId:guest.workspace_id as string,role:'guest',membershipCount:1,demo:{expiresAt:guest.expires_at as string}};
 }
 const client=await sessionClient();const {data:{user},error}=await client.auth.getUser();
 if(error||!user)return null;
 const {data:members,error:memberError}=await client.from('syncflow_members').select('workspace_id,role').eq('user_id',user.id);
 if(memberError)throw new Error('Workspace lookup failed');
 const preferred=(await cookies()).get('syncflow-workspace')?.value;
 let ordered=members||[];
 if(ordered.length>1&&!ordered.some(member=>member.workspace_id===preferred)){
  const {data:workspaces,error:workspaceError}=await client.from('syncflow_workspaces').select('id').order('created_at').order('id');
  if(workspaceError)throw new Error('Workspace lookup failed');
  ordered=(workspaces||[]).flatMap(workspace=>ordered.filter(member=>member.workspace_id===workspace.id));
 }
 const selected=selectWorkspace(ordered,preferred);
 return {user,workspaceId:selected?.workspace_id??null,role:selected?.role??null,membershipCount:members?.length??0,demo:undefined};
}
