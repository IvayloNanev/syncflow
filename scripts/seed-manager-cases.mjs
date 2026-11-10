// Synthetic source records in the normal workspace. Live agent outputs are never canned.
import {config} from 'dotenv';
import {createClient} from '@supabase/supabase-js';
import {loadBriefing} from '../server/briefing-store.js';
import {openSharedStore,creationId} from '../requests/shared-store.js';
import {analyzeSavedRequest} from '../requests/analyze-saved.js';
import {createClaudeProvider} from '../agents/intake/providers/claude.js';
import {createFollowUpClaudeProvider} from '../agents/follow-up/providers/claude.js';
const envFile=process.env.SYNCFLOW_SEED_ENV||'.env.local';
config({path:envFile,quiet:true});
config({path:envFile.replace(/\.local$/,''),quiet:true});
if(process.env.SYNCFLOW_SEED_MANAGER_CASES!=='1')throw Error('Explicit synthetic dataset opt-in required.');
const original='09eece27-cee6-4286-94b7-870e3ad8f7a1';
const client=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SECRET_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const must=({data,error})=>{if(error)throw Error(error.code||'STORAGE_FAILED');return data;};
const members=must(await client.from('syncflow_members').select('user_id').eq('workspace_id',original).eq('role','owner'));
if(members.length!==1)throw Error('Expected one original workspace owner.');
const actor=members[0].user_id;
const workspace=creationId('isolated-client-portfolio',actor,'natural-priority-v1');
const target=must(await client.from('syncflow_workspaces').select('id,name').eq('id',workspace).maybeSingle());
if(target&&target.name!=='Client Portfolio')throw Error('Portfolio workspace conflict.');
if(!target)must(await client.from('syncflow_workspaces').insert({id:workspace,name:'Client Portfolio'}));
if(!must(await client.from('syncflow_members').select('user_id').eq('workspace_id',workspace).eq('user_id',actor).maybeSingle()))must(await client.from('syncflow_members').insert({workspace_id:workspace,user_id:actor,role:'owner'}));
const before=must(await client.from('syncflow_requests').select('id,version').eq('workspace_id',original).order('id'));
const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Toronto',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const day=offset=>new Date(Date.parse(today+'T12:00:00Z')+offset*86400000).toISOString().slice(0,10);
const cases=[
 {key:'manager-refusal',name:'Avery Stone',company:'Stone Creative',project:'Summer brand film',offset:4,stage:'declined'},
 {key:'manager-conflict',name:'Riley Park',company:'Park Films',project:'City launch campaign',offset:5,stage:'conflict'},
 {key:'manager-overdue',name:'Casey Reed',company:'Cedar Agency',project:'Winter campaign',offset:-2,stage:'review'},
];
const providers={intakeProvider:createClaudeProvider(),followUpProvider:createFollowUpClaudeProvider()};
const results=[];
for(const spec of cases){
 const key=`manager-demo-v1:${spec.key}`,id=creationId(workspace,actor,key),store=await openSharedStore({client,workspaceId:workspace,actorId:actor,id});
 try{
  const exists=must(await client.from('syncflow_requests').select('id').eq('workspace_id',workspace).eq('id',id).maybeSingle());
  if(exists){results.push({project:spec.project,status:store.workflow(actor,id).status,existing:true});continue;}
  const artist=spec.stage==='catalogue'?'Orion Vale':'Maya Rivers',track=spec.stage==='catalogue'?'Glass Satellites':'Northern Lights';
  const email=`Hello,\nI am ${spec.name} at ${spec.company}. Contact: ${spec.name} (${spec.company}), ${spec.name.toLowerCase().replace(' ','.')}@${spec.company.toLowerCase().replaceAll(' ','')}.example.\nProject: ${spec.project}. We would like to license "${track}" by ${artist}, original recording, for an online advertisement on Instagram and YouTube in Canada. Campaign term: three months starting ${day(14)}. Music excerpt: 30 seconds.\n${spec.stage==='missing'?'Our budget has not been decided yet.':'Budget: CAD 5,000 total for both master and publishing rights.'}\nPlease respond by ${day(spec.offset)} at 17:00 America/Toronto.\nThank you,\n${spec.name}`;
  store.create({actor_id:actor,idempotency_key:key,email,timezone:'America/Toronto',recording_id:spec.stage==='catalogue'?null:'TRACK-0001'});await store.flush();
  if(spec.stage!=='new'){
   await analyzeSavedRequest(store,{actor_id:actor,request_id:id,expected_revision:0,idempotency_key:`${key}:analysis`},providers);await store.flush();
   const analysis=store.activeAnalysis(actor,id);
   if(!analysis?.result?.ok){results.push({project:spec.project,status:store.workflow(actor,id).status,analysis_failed:true});continue;}
   if(['review','declined','conflict'].includes(spec.stage)&&store.workflow(actor,id).can_approve_brief){
    store.approveBrief({actor_id:actor,request_id:id,expected_revision:0,analysis_run_id:analysis.run_id,idempotency_key:`${key}:signoff`});
    store.recordReview({actor_id:actor,request_id:id,expected_revision:0,expected_review_version:0,operation:'assign',name:'Alex Morgan',role:'Master rights reviewer',idempotency_key:`${key}:assign`});
    if(spec.stage==='declined'){
     const reviewer=store.reviewers(actor,id).reviewers[0];
     store.recordReview({actor_id:actor,request_id:id,expected_revision:0,expected_review_version:1,operation:'decision',reviewer_id:reviewer.id,status:'Declined',notes:'Reviewer refuses the proposed advertising use. Manager must decide whether to revise the scope or stop the request.',idempotency_key:`${key}:declined`});
    }
    if(spec.stage==='conflict'){
     const reviewer=store.reviewers(actor,id).reviewers[0];
     store.recordReview({actor_id:actor,request_id:id,expected_revision:0,expected_review_version:1,operation:'decision',reviewer_id:reviewer.id,status:'Approved',notes:'Master-side reviewer accepts the proposed scope internally; no rights granted.',idempotency_key:`${key}:approved`});
     store.recordReview({actor_id:actor,request_id:id,expected_revision:0,expected_review_version:2,operation:'assign',name:'Jamie Lee (demo)',role:'Publishing reviewer',idempotency_key:`${key}:second-reviewer`});
     const second=store.reviewers(actor,id).reviewers[1];
     store.recordReview({actor_id:actor,request_id:id,expected_revision:0,expected_review_version:3,operation:'decision',reviewer_id:second.id,status:'Changes requested',notes:'Publishing reviewer requires a shorter term, conflicting with the accepted master-side scope. Manager decision required.',idempotency_key:`${key}:changes`});
    }
   }
   if(spec.stage==='reply')store.appendReply({actor_id:actor,request_id:id,expected_revision:0,text:'We are changing the territory to Canada and United States. This replaces the earlier Canada-only scope. Please recheck the revised usage.',idempotency_key:`${key}:reply`});
   await store.flush();
  }
  results.push({project:spec.project,status:store.workflow(actor,id).status,id});
  console.log(JSON.stringify(results.at(-1)));
 }finally{store.dispose();}
}
// Ensure the conflicting-decision scenario has both saved reviewer records even
// when intake found an independent clarification issue.
const conflictKey='manager-demo-v1:manager-conflict';
const conflictId=creationId(workspace,actor,conflictKey);
const conflictStore=await openSharedStore({client,workspaceId:workspace,actorId:actor,id:conflictId});
try{
 if(conflictStore.reviewers(actor,conflictId).reviewers.length===0){
  conflictStore.recordReview({actor_id:actor,request_id:conflictId,expected_revision:0,expected_review_version:0,operation:'assign',name:'Alex Morgan',role:'Master rights reviewer',idempotency_key:`${conflictKey}:assign`});
  const first=conflictStore.reviewers(actor,conflictId).reviewers[0];
  conflictStore.recordReview({actor_id:actor,request_id:conflictId,expected_revision:0,expected_review_version:1,operation:'decision',reviewer_id:first.id,status:'Approved',notes:'Synthetic case: master-side reviewer accepts the proposed scope internally; no rights granted.',idempotency_key:`${conflictKey}:approved`});
  conflictStore.recordReview({actor_id:actor,request_id:conflictId,expected_revision:0,expected_review_version:2,operation:'assign',name:'Jamie Lee',role:'Publishing reviewer',idempotency_key:`${conflictKey}:second-reviewer`});
  const second=conflictStore.reviewers(actor,conflictId).reviewers[1];
  conflictStore.recordReview({actor_id:actor,request_id:conflictId,expected_revision:0,expected_review_version:3,operation:'decision',reviewer_id:second.id,status:'Changes requested',notes:'Synthetic case: publishing reviewer requires a shorter term than the master-side scope. Manager must resolve the conflicting decisions.',idempotency_key:`${conflictKey}:changes`});
  await conflictStore.flush();
 }
}finally{conflictStore.dispose();}
const verified=await loadBriefing(client,workspace,actor);
const routes=verified.supervision.items.filter(item=>cases.some(spec=>item.request_id===creationId(workspace,actor,`manager-demo-v1:${spec.key}`))).map(item=>({project:item.project,destination:item.handoff.destination,reason:item.reason}));
if(routes.length!==3||routes.some(item=>item.destination!=='internal'))throw Error('Manager case routing verification failed.');
console.log(JSON.stringify({verified_routes:routes}));
const after=must(await client.from('syncflow_requests').select('id,version').eq('workspace_id',original).order('id'));
console.log(JSON.stringify({workspace,synthetic_cases:results.length,original_workspace_unchanged:JSON.stringify(before)===JSON.stringify(after),results}));
