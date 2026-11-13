import {cookies} from 'next/headers';
import {storageClient,sharedConfigured} from '../../../../lib/supabase/server';
import {requestOrigin} from '../../../../server/request-origin.js';
import {DEMO_COOKIE,DEMO_SECONDS,newDemoToken,demoTokenHash,demoIpHash,readDemoSession} from '../../../../server/demo-policy.js';
import {seedDemo} from '../../../../server/demo-seed.js';
export const runtime='nodejs';
export const maxDuration=60;
const json=(status:number,body:unknown)=>Response.json(body,{status,headers:{'cache-control':'private, no-store'}});
export async function GET(){
 if(!sharedConfigured())return json(200,{active:false,available:false});
 try{const client=storageClient(),token=(await cookies()).get(DEMO_COOKIE)?.value;
  if(token){const session=await readDemoSession(client,token);return json(200,{active:!!session,expired:!session,...(session?{expires_at:session.expires_at,remaining_calls:session.remaining_calls}:{})});}
  const {data,error}=await client.from('syncflow_demo_settings').select('enabled,actor_id').eq('id',true).maybeSingle();
  return json(200,{active:false,available:!error&&!!data?.enabled&&!!data.actor_id});
 }catch{return json(503,{error:'Demo access could not be checked.'});}
}
export async function POST(req:Request){
 const origin=requestOrigin(req);if(!origin||req.headers.get('origin')!==origin)return json(403,{error:'Start the demo from this website.'});
 if(!sharedConfigured()||!process.env.ANTHROPIC_API_KEY||!process.env.ANTHROPIC_MODEL)return json(503,{error:'Live demo setup is pending. Please try again later.'});
 try{
  const jar=await cookies(),client=storageClient(),current=jar.get(DEMO_COOKIE)?.value;
  if(current&&await readDemoSession(client,current))return json(200,{destination:'/dashboard'});
  const token=newDemoToken(),hash=demoTokenHash(token)!;
  const {data,error}=await client.rpc('syncflow_create_demo',{p_hash:hash,p_ip:demoIpHash(req.headers,process.env.SUPABASE_SECRET_KEY)});
  if(error||!data?.workspace_id)return json(error?.message?.includes('LIMIT')?429:503,{error:error?.message?.includes('LIMIT')?'Today’s guest session limit has been reached. Please try again tomorrow.':'Live demo is unavailable. Please try again later.'});
  await seedDemo(client,data.workspace_id,data.actor_id);
  const {error:readyError}=await client.from('syncflow_demo_sessions').update({ready:true}).eq('token_hash',hash);
  if(readyError)throw Error('DEMO_START_FAILED');
  jar.set(DEMO_COOKIE,token,{httpOnly:true,secure:new URL(origin).protocol==='https:',sameSite:'lax',path:'/',maxAge:DEMO_SECONDS});
  return json(201,{destination:'/dashboard'});
 }catch{return json(503,{error:'The guest workspace could not start. Please try again later.'});}
}
export async function DELETE(req:Request){
 const origin=requestOrigin(req);if(!origin||req.headers.get('origin')!==origin)return json(403,{error:'Exit the demo from this website.'});
 try{const jar=await cookies(),token=jar.get(DEMO_COOKIE)?.value,hash=demoTokenHash(token);
  if(hash){const {error}=await storageClient().from('syncflow_demo_sessions').update({expires_at:new Date().toISOString()}).eq('token_hash',hash);if(error)throw Error('DEMO_EXIT_FAILED');}
  jar.set(DEMO_COOKIE,'',{httpOnly:true,secure:new URL(origin).protocol==='https:',sameSite:'lax',path:'/',maxAge:0});
  return json(200,{destination:'/'});
 }catch{return json(503,{error:'Demo exit could not finish. Please retry.'});}
}
