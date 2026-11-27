import {createHash,createHmac,randomBytes} from 'node:crypto';
export const DEMO_COOKIE='syncflow-guest-demo';
export const DEMO_SECONDS=2*60*60;
export const isDemoWorkspace=id=>typeof id==='string'&&/^de000000-[a-f0-9-]{27}$/i.test(id);
export const newDemoToken=()=>randomBytes(32).toString('hex');
export function demoTokenHash(token){return typeof token==='string'&&/^[a-f0-9]{64}$/.test(token)?createHash('sha256').update(token).digest('hex'):null;}
export function demoIpHash(headers,secret,{vercel=process.env.VERCEL==='1',production=process.env.NODE_ENV==='production'}={}){
 // Only Vercel's platform-overwritten IP header is trusted in production.
 const ip=vercel?headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim():!production?'local-development':null;
 if(!ip||!secret)throw Error('DEMO_NETWORK_UNAVAILABLE');
 return createHmac('sha256',secret).update('syncflow-demo-ip:'+ip).digest('hex');
}
export async function readDemoSession(client,token){
 const hash=demoTokenHash(token);if(!hash)return null;
 const {data,error}=await client.rpc('syncflow_read_demo',{p_hash:hash});
 if(error)throw Error('DEMO_ACCESS_UNAVAILABLE');
 if(!data||!isDemoWorkspace(data.workspace_id)||typeof data.actor_id!=='string'||!Number.isFinite(Date.parse(data.expires_at))||Date.parse(data.expires_at)<=Date.now())return null;
 return data;
}
export async function reserveDemo(client,workspaceId,actorId,kind,key,bytes=0){
 if(!isDemoWorkspace(workspaceId))return true;
 const {data,error}=await client.rpc('syncflow_reserve_demo',{p_workspace:workspaceId,p_actor:actorId,p_kind:kind,p_key:key,p_bytes:bytes});
 if(error||typeof data?.allowed!=='boolean')throw Error('DEMO_USAGE_UNAVAILABLE');
 return data.allowed;
}
