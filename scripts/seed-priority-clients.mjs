// Synthetic source records in the normal workspace. Live agent outputs are never canned.
import {config} from 'dotenv';
import {createClient} from '@supabase/supabase-js';
import {openSharedStore,creationId} from '../requests/shared-store.js';
import {analyzeSavedRequest} from '../requests/analyze-saved.js';
import {createClaudeProvider} from '../agents/intake/providers/claude.js';
import {createFollowUpClaudeProvider} from '../agents/follow-up/providers/claude.js';
const envFile=process.env.SYNCFLOW_SEED_ENV||'.env.local';
config({path:envFile,quiet:true});
config({path:envFile.replace(/\.local$/,''),quiet:true});
if(process.env.SYNCFLOW_SEED_PRIORITY_CLIENTS!=='1')throw Error('Explicit synthetic dataset opt-in required.');
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
 {key:'overdue',name:'Elena Moss',company:'Beacon Media',project:'Outdoor launch film',offset:-1,stage:'review'},
 {key:'today-budget',name:'Theo Brooks',company:'Field Studio',project:'Retail holiday spot',offset:0,stage:'missing'},
 {key:'today-signoff',name:'Nadia Cole',company:'Prism Agency',project:'Launch trailer',offset:0,stage:'approval'},
 {key:'soon-review',name:'Luca Reed',company:'Drift Films',project:'Festival promo',offset:1,stage:'review'},
 {key:'review-changes',name:'Amara Quinn',company:'Maple Creative',project:'Travel campaign',offset:2,stage:'changes'},
 {key:'completed',name:'Owen Ellis',company:'Copper Studio',project:'Brand documentary',offset:7,stage:'complete'},
 {key:'new-reply',name:'Sofia Lane',company:'Arc Media',project:'Community campaign',offset:4,stage:'reply'},
 {key:'catalogue-gap',name:'Jules Hart',company:'Frame Agency',project:'Product reveal',offset:3,stage:'catalogue'},
 {key:'routine-signoff',name:'Maya Finch',company:'Meadow Films',project:'Autumn story',offset:10,stage:'approval'},
 {key:'new-inquiry',name:'Leo Vale',company:'Echo Studio',project:'Social launch',offset:5,stage:'new'},
];
const providers={intakeProvider:createClaudeProvider(),followUpProvider:createFollowUpClaudeProvider()};
const results=[];
for(const spec of cases){
 const key=`priority-portfolio-v1:${spec.key}`,id=creationId(workspace,actor,key),store=await openSharedStore({client,workspaceId:workspace,actorId:actor,id});
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
   if(['review','changes','complete'].includes(spec.stage)&&store.workflow(actor,id).can_approve_brief){
    store.approveBrief({actor_id:actor,request_id:id,expected_revision:0,analysis_run_id:analysis.run_id,idempotency_key:`${key}:signoff`});
    store.recordReview({actor_id:actor,request_id:id,expected_revision:0,expected_review_version:0,operation:'assign',name:'Alex Morgan',role:'Master rights reviewer',idempotency_key:`${key}:assign`});
    if(['changes','complete'].includes(spec.stage)){
     const reviewer=store.reviewers(actor,id).reviewers[0];
     store.recordReview({actor_id:actor,request_id:id,expected_revision:0,expected_review_version:1,operation:'decision',reviewer_id:reviewer.id,status:spec.stage==='changes'?'Changes requested':'Approved',notes:spec.stage==='changes'?'The campaign cut uses an end-card logo; please clarify this usage before proceeding.':'Internal approval recorded. Music rights clearance remains separate.',idempotency_key:`${key}:decision`});
     if(spec.stage==='complete'){
      const handoff=store.handoff(actor,id);store.saveHandoff({actor_id:actor,request_id:id,expected_revision:0,expected_handoff_version:0,source_token:handoff.source_token,text:'The saved advertisement scope has been reviewed internally. No music licence has been granted.',idempotency_key:`${key}:handoff`});
      store.completeReview({actor_id:actor,request_id:id,expected_revision:0,expected_review_version:2,idempotency_key:`${key}:completion`});
     }
    }
   }
   if(spec.stage==='reply')store.appendReply({actor_id:actor,request_id:id,expected_revision:0,text:'We are changing the territory to Canada and United States. This replaces the earlier Canada-only scope. Please recheck the revised usage.',idempotency_key:`${key}:reply`});
   await store.flush();
  }
  results.push({project:spec.project,status:store.workflow(actor,id).status,id});
  console.log(JSON.stringify(results.at(-1)));
 }finally{store.dispose();}
}
const after=must(await client.from('syncflow_requests').select('id,version').eq('workspace_id',original).order('id'));
console.log(JSON.stringify({workspace,synthetic_cases:results.length,original_workspace_unchanged:JSON.stringify(before)===JSON.stringify(after),results}));
