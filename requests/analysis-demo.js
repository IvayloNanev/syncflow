import {mkdtempSync,readFileSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {openRequestStore} from './store.js';import {analyzeSavedRequest} from './analyze-saved.js';import {createFollowUpMockProvider} from '../agents/follow-up/providers/mock.js';
const fixture=JSON.parse(readFileSync(new URL('../fixtures/development/incomplete.json',import.meta.url),'utf8'));
const dir=mkdtempSync(join(tmpdir(),'syncflow-saved-analysis-demo-')),path=join(dir,'demo.sqlite');let store;
try{
 store=openRequestStore(path);const r=store.create({actor_id:'demo',idempotency_key:'create',email:fixture.context.messages[0].text,timezone:'America/New_York'}).request;
 const intakeProvider={id:'mock:fixed-development-replay',mode:'mock',generate:async({context})=>{
   if(context.messages.length!==1||context.messages[0].text!==fixture.context.messages[0].text)throw Error('Unsupported mock input');
   const output=structuredClone(fixture.intake);output.run_id=context.run_id;output.base_record_version=context.base_record_version;
   for(const p of output.proposed_changes)for(const e of p.evidence)e.message_id=context.messages[0].message_id;
   return output;
 }};
 const result=await analyzeSavedRequest(store,{actor_id:'demo',request_id:r.id,expected_revision:0,idempotency_key:'analyze'},{intakeProvider,followUpProvider:createFollowUpMockProvider()});
 store.close();store=openRequestStore(path);const active=store.activeAnalysis('demo',r.id);
 console.log(JSON.stringify({mode:'mock-only',reopened:true,analysis_status:active.status,facts:active.result.stages.intake.output.proposed_changes.length,
   issues:active.result.stages.review.output.issues.length,confirmed_fields:store.get('demo',r.id).confirmed_fields.length,model_calls:0,sent:false},null,2));
 store.appendReply({actor_id:'demo',request_id:r.id,idempotency_key:'reply',expected_revision:0,text:'The campaign runs for two months.'});
 console.log(JSON.stringify({after_reply_revision:store.get('demo',r.id).revision,active_analysis:store.activeAnalysis('demo',r.id),history_runs:store.analyses('demo',r.id).length}));
}finally{store?.close();rmSync(dir,{recursive:true,force:true});}
