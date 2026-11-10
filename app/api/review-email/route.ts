import {workspaceSession,storageClient} from '../../../lib/supabase/server';
import {loadBriefing} from '../../../server/briefing-store.js';
import {caseListing,contextForReview,currentAssessment,reviewFingerprint} from '../../../agents/internal/lifecycle.js';
import {caseCorrespondence} from '../../../requests/correspondence.js';
import {openSharedStore} from '../../../requests/shared-store.js';
import {reviewRows} from '../../../server/internal-review-store.js';
export async function GET(req:Request){
 const json=(status:number,body:unknown)=>Response.json(body,{status,headers:{'cache-control':'private, no-store'}});
 try{
 const session=await workspaceSession();if(!session?.workspaceId)return json(403,{error:'Workspace access required.'});
 const id=new URL(req.url).searchParams.get('request');if(!id||!(/^[a-f0-9-]{36}$/i.test(id)))return json(400,{error:'Choose a saved case.'});
 const client=storageClient(),{cases}=await loadBriefing(client,session.workspaceId,session.user.id,{requestId:id}),c=cases.find(c=>c.id===id);
 if(!c)return json(404,{error:'Request not found in this workspace.'});
 const {assessments,queue}=await reviewRows(client,session.workspaceId),assessment=currentAssessment(c,assessments);
 const store=await openSharedStore({client,workspaceId:session.workspaceId,actorId:session.user.id,id:c.id});
 let correspondence;try{correspondence=caseCorrespondence(c.messages,store.analyses(session.user.id,c.id),assessments.filter((row:{request_id:string})=>row.request_id===c.id));}finally{store.dispose();}
 const current=await workspaceSession();if(current?.workspaceId!==session.workspaceId||current?.user.id!==session.user.id)return json(403,{error:'Workspace access changed.'});
 const confirmed:{field_key:string;value:unknown;state:string}[]=c.confirmed_fields||[],confirmedKeys=new Set(confirmed.filter(f=>f.state==='confirmed').map(f=>f.field_key));
 return json(200,{editor_scope:`${session.user.id}:${session.workspaceId}`,request_id:c.id,revision:c.revision,routing:caseListing(c,assessment),fingerprint:reviewFingerprint(c),assessment,queued:queue.some((row:{request_id:string;active:boolean})=>row.request_id===c.id&&row.active),context:contextForReview(c),reviewers:c.reviewers,workflow:c.workflow,facts:[...(c.agent_fields||[]).filter((f:{field_key:string})=>!confirmedKeys.has(f.field_key)).map((f:{field_key:string;value:unknown})=>({label:f.field_key,value:f.value,source:'Extracted from email'})),...confirmed.map((f:{field_key:string;value:unknown;state:string})=>({label:f.field_key,value:f.value,source:f.state==='confirmed'?'Confirmed':'Saved fact'}))],messages:c.messages,correspondence});
 }catch{return json(503,{error:'Could not load review context. Please retry.'});}
}
