import {randomBytes} from 'node:crypto';
import {workspaceSession,storageClient} from '../../../lib/supabase/server';
import {requestOrigin} from '../../../server/request-origin.js';
const json=(status:number,body:unknown)=>Response.json(body,{status,headers:{'cache-control':'private, no-store'}});
export async function POST(req:Request){
 const origin=requestOrigin(req);if(!origin||req.headers.get('origin')!==origin)return json(403,{error:'Open forwarding from Coordinator.'});
 const session=await workspaceSession();if(!session?.workspaceId)return json(401,{error:'Sign in to your workspace.'});
 if(!session.user.email_confirmed_at)return json(403,{error:'Verify your account email first.'});
 const domain=process.env.SYNCFLOW_INBOUND_DOMAIN;
 if(!domain||!process.env.RESEND_INBOUND_API_KEY||!process.env.RESEND_INBOUND_WEBHOOK_SECRET)return json(503,{error:'Email forwarding setup is pending. You can still paste an email.'});
 let requestId:string|null=null;
 try{const input=await req.json();requestId=input.request_id??null;if(requestId&&!/^[a-f0-9-]{36}$/.test(requestId))return json(400,{error:'Invalid case.'});}catch{return json(400,{error:'Invalid request.'});}
 const client=storageClient();
 if(requestId){const {data,error}=await client.from('syncflow_requests').select('id').eq('workspace_id',session.workspaceId).eq('id',requestId).maybeSingle();if(error||!data)return json(404,{error:'Case not found.'});}
 let query=client.from('syncflow_email_routes').select('token').eq('workspace_id',session.workspaceId).eq('actor_id',session.user.id).eq('enabled',true);
 query=requestId?query.eq('request_id',requestId):query.is('request_id',null);
 const {data,error}=await query.limit(1).maybeSingle();if(error)return json(503,{error:'Forwarding is unavailable. Try again.'});
 let token=data?.token;
 if(!token){token=randomBytes(20).toString('hex');const {error}=await client.from('syncflow_email_routes').insert({token,workspace_id:session.workspaceId,actor_id:session.user.id,forwarder_email:session.user.email!.toLowerCase(),request_id:requestId});if(error)return json(503,{error:'Forwarding address could not be created.'});}
 const shortAddress=token===process.env.SYNCFLOW_INBOUND_REQUESTS_TOKEN;
 return json(200,{address:shortAddress?`requests@${domain}`:`sf-${token}@${domain}`,aliasPreview:shortAddress&&process.env.NODE_ENV!=='production',sender:session.user.email,caseSpecific:!!requestId,live:process.env.NODE_ENV==='production'});
}

export async function GET(req:Request){
 const session=await workspaceSession();if(!session?.workspaceId)return json(401,{error:'Sign in to your workspace.'});
 const requestId=new URL(req.url).searchParams.get('request_id');
 if(requestId&&!/^[a-f0-9-]{36}$/.test(requestId))return json(400,{error:'Invalid request.'});
 let query=storageClient().from('syncflow_email_receipts').select('email_id,request_id,subject,sender,received_at').eq('workspace_id',session.workspaceId);
 if(requestId)query=query.eq('request_id',requestId);
 const {data,error}=await query.order('received_at',{ascending:false}).limit(20);
 if(error)return json(503,{error:'Unable to load incoming emails. Retrying…'});
 const ids=[...new Set((data||[]).map(email=>email.request_id))];
 if(!ids.length)return json(200,{emails:[]});
 const {data:cases,error:caseError}=await storageClient().from('syncflow_requests').select('id,dashboard').eq('workspace_id',session.workspaceId).in('id',ids);
 if(caseError)return json(503,{error:'Unable to load incoming emails. Retrying…'});
 const active=new Set((cases||[]).filter(item=>!item.dashboard?.deleted_at).map(item=>item.id));
 return json(200,{emails:(data||[]).filter(email=>active.has(email.request_id))});
}
