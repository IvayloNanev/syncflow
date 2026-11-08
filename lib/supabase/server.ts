import 'server-only';
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
 const client=await sessionClient();const {data:{user},error}=await client.auth.getUser();
 if(error||!user)return null;
 const {data:members,error:memberError}=await client.from('syncflow_members').select('workspace_id,role').eq('user_id',user.id);
 if(memberError)throw new Error('Workspace lookup failed');
 const preferred=(await cookies()).get('syncflow-workspace')?.value;
 const selected=selectWorkspace(members||[],preferred);
 return {user,workspaceId:selected?.workspace_id??null,role:selected?.role??null,membershipCount:members?.length??0};
}
