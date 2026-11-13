import {NextResponse} from 'next/server';
import {workspaceSession,storageClient} from '../../lib/supabase/server';
import {requestOrigin} from '../../server/request-origin.js';
export async function POST(req:Request){
 const origin=requestOrigin(req);if(!origin||req.headers.get('origin')!==origin)return new Response('Use the workspace selector.',{status:403});
 const session=await workspaceSession();if(!session)return new Response('Sign in first.',{status:401});
 if(session.demo)return new Response('Exit the guest demo before selecting a team workspace.',{status:403});
 const input=await req.formData(),workspace=input.get('workspace');
 if(typeof workspace!=='string'||! /^[a-f0-9-]{36}$/i.test(workspace))return new Response('Invalid workspace.',{status:400});
 const {data,error}=await storageClient().from('syncflow_members').select('workspace_id').eq('user_id',session.user.id).eq('workspace_id',workspace).maybeSingle();
 if(error||!data)return new Response('Workspace access required.',{status:403});
 const response=NextResponse.redirect(new URL('/dashboard',origin),303);
 response.cookies.set('syncflow-workspace',workspace,{httpOnly:true,secure:new URL(origin).protocol==='https:',sameSite:'lax',path:'/',maxAge:60*60*24*30});
 return response;
}
