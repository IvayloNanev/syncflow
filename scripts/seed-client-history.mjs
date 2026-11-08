// Opt-in, idempotent fictional workspace seed. Domain engine validates all cases;
// no model calls, emails or writes to existing workspace requests.
import {config} from 'dotenv';
import {createClient} from '@supabase/supabase-js';
import {readFileSync} from 'node:fs';
import {openSharedStore,creationId,listSharedRequests} from '../requests/shared-store.js';
import {analyzeSavedRequest} from '../requests/analyze-saved.js';
import {createFollowUpMockProvider} from '../agents/follow-up/providers/mock.js';
config({path:'.env.local',quiet:true});
if(process.env.SYNCFLOW_SEED_TEST_HISTORY!=='1')throw new Error('Explicit test-history opt-in required.');
const workspace='b7a8e7df-ef85-4c35-a1ce-88ed575c713b';
const original='09eece27-cee6-4286-94b7-870e3ad8f7a1';
const client=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SECRET_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const must=({data,error})=>{if(error)throw new Error(`Seed failed: ${error.code||error.message}`);return data;};
const members=must(await client.from('syncflow_members').select('user_id').eq('workspace_id',original).eq('role','owner'));
if(members.length!==1)throw new Error('Expected exactly one existing owner.');
const actor=members[0].user_id;
const before=must(await client.from('syncflow_requests').select('id,version').eq('workspace_id',original));
const existing=must(await client.from('syncflow_workspaces').select('id,name').eq('id',workspace).maybeSingle());
if(existing&&existing.name!=='SyncFlow Test · Fictional Clients')throw new Error('Workspace ID conflict.');
if(!existing)must(await client.from('syncflow_workspaces').insert({id:workspace,name:'SyncFlow Test · Fictional Clients'}));
const membership=must(await client.from('syncflow_members').select('user_id').eq('workspace_id',workspace).eq('user_id',actor).maybeSingle());
if(!membership)must(await client.from('syncflow_members').insert({workspace_id:workspace,user_id:actor,role:'owner'}));
const cases=[
 ['Alex Chen · Northstar Creative','Winter campaign','missing',2],
 ['Alex Chen · Northstar Creative','Spring launch','complete',1],
 ['Priya Shah · Harbor Films','Festival trailer','approval',2],
 ['Priya Shah · Harbor Films','Documentary promo','review',1],
 ['Sam Rivera · Atlas Studio','Travel series','changes',2],
 ['Sam Rivera · Atlas Studio','City campaign','complete',1],
 ['Morgan Lee · Orbit Media','Brand film','reply',2],
 ['Casey Brooks · Cedar Agency','Holiday campaign','approval',1],
];
const fixtureText=readFileSync(new URL('../fixtures/development/complete.json',import.meta.url),'utf8');
for(const [name,project,stage,replies] of cases){
 const key=`fictional-history-v1:${project}`;
 const id=creationId(workspace,actor,key);
 const store=await openSharedStore({client,workspaceId:workspace,actorId:actor,id});
 try{
  if(must(await client.from('syncflow_requests').select('id').eq('workspace_id',workspace).eq('id',id).maybeSingle()))continue;
  const fixture=JSON.parse(fixtureText.replaceAll('Jordan Pike',name).replaceAll('Northlight launch',project).replaceAll('Artist A','Maya Rivers').replaceAll('Track X','Northern Lights'));
  let email=fixture.context.messages[0].text.replace('November 6, 2026.','December 10, 2026 at 17:00 America/Toronto.');
  const deadline=fixture.intake.proposed_changes.find(p=>p.field_key==='response_deadline');
  deadline.proposed_value={supplied_text:'December 10, 2026 at 17:00 America/Toronto',date:'2026-12-10',time:'17:00',timezone:'America/Toronto'};
  deadline.evidence[0].exact_quote=deadline.proposed_value.supplied_text;
  if(stage==='missing'){
   email=email.replace('Budget CAD 5,000 for both rights. ','');
   fixture.intake.proposed_changes=fixture.intake.proposed_changes.filter(p=>!['budget','rights_scope'].includes(p.field_key));
  }
  store.create({actor_id:actor,idempotency_key:key,email:`FICTIONAL TEST CASE — not a real client request. ${email}`,timezone:'America/Toronto',recording_id:'TRACK-0001'});
  for(let i=0;i<replies;i++)store.appendReply({actor_id:actor,request_id:id,expected_revision:i,text:i===0?'Fictional client reply: please use the scope in our original message. This is test data.':'Fictional client reply: the campaign details remain unchanged. Please continue the review.',idempotency_key:`${key}:reply:${i}`});
  let revision=replies;
  await analyzeSavedRequest(store,{actor_id:actor,request_id:id,expected_revision:revision,idempotency_key:`${key}:analysis`},{intakeProvider:{id:'fictional-history-fixture',mode:'mock',generate:async({context})=>({...fixture.intake,run_id:context.run_id,base_record_version:context.base_record_version,proposed_changes:fixture.intake.proposed_changes.map(p=>({...p,evidence:p.evidence.map(e=>({...e,message_id:context.messages[0].message_id}))}))})},followUpProvider:createFollowUpMockProvider()});
  if(['review','changes','complete'].includes(stage)){
   store.approveBrief({actor_id:actor,request_id:id,expected_revision:revision,analysis_run_id:store.activeAnalysis(actor,id).run_id,idempotency_key:`${key}:approval`});
   store.recordReview({actor_id:actor,request_id:id,expected_revision:revision,expected_review_version:0,operation:'assign',name:'Taylor Reed (fictional)',role:'Master rights reviewer',idempotency_key:`${key}:assign`});
   const reviewer=store.reviewers(actor,id).reviewers[0];
   if(stage!=='review')store.recordReview({actor_id:actor,request_id:id,expected_revision:revision,expected_review_version:1,operation:'decision',reviewer_id:reviewer.id,status:stage==='changes'?'Changes requested':'Approved',notes:stage==='changes'?'Fictional decision: clarify the platform scope before approval.':'Fictional internal approval for testing only. No rights granted.',idempotency_key:`${key}:decision`});
   const handoff=store.handoff(actor,id);
   store.saveHandoff({actor_id:actor,request_id:id,expected_revision:revision,expected_handoff_version:0,source_token:handoff.source_token,text:`Fictional handoff for ${project}. Review the saved scope and record your internal decision. No licence is granted.`,idempotency_key:`${key}:handoff`});
   if(stage==='complete')store.completeReview({actor_id:actor,request_id:id,expected_revision:revision,expected_review_version:2,idempotency_key:`${key}:complete`});
  }
  if(stage==='reply')store.appendReply({actor_id:actor,request_id:id,expected_revision:revision,text:'Fictional scope change: the campaign now also includes the United States. Please recheck this change.',idempotency_key:`${key}:scope-change`});
  await store.flush();
  console.log(JSON.stringify({project,status:store.workflow(actor,id).status,messages:store.get(actor,id).messages.length}));
 }finally{store.dispose();}
}
const after=must(await client.from('syncflow_requests').select('id,version').eq('workspace_id',original));
if(JSON.stringify(before)!==JSON.stringify(after))throw new Error('Original workspace changed during seed; inspect before proceeding.');
const records=await listSharedRequests(client,workspace);
if(records.length!==8)throw new Error('Expected eight saved test cases.');
console.log(JSON.stringify({workspace,clients:new Set(records.map(r=>r.contact)).size,requests:records.length,messages:records.reduce((n,r)=>n+r.message_count,0),originalWorkspaceUnchanged:true}));
