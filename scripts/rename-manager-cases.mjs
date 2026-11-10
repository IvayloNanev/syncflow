// Normalize the names of the three synthetic cases created by seed-manager-cases.
import {config} from 'dotenv';
import {createClient} from '@supabase/supabase-js';
import {creationId} from '../requests/shared-store.js';
import {openRequestStore} from '../requests/store.js';
import {effectiveFields} from '../requests/effective-fields.js';
import {dashboardRequest} from '../requests/dashboard.js';
import {loadBriefing} from '../server/briefing-store.js';
config({path:'.env.local',quiet:true});
if(process.env.SYNCFLOW_RENAME_MANAGER_CASES!=='1')throw Error('Explicit opt-in required.');
const client=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SECRET_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const must=({data,error})=>{if(error)throw Error(error.code||'STORAGE_FAILED');return data;};
const owners=must(await client.from('syncflow_members').select('user_id').eq('workspace_id','09eece27-cee6-4286-94b7-870e3ad8f7a1').eq('role','owner'));
if(owners.length!==1)throw Error('Owner mismatch');
const actor=owners[0].user_id,workspace=creationId('isolated-client-portfolio',actor,'natural-priority-v1');
const replacements=[['DEMO · Reviewer refusal','Summer brand film'],['DEMO · Conflicting decisions','City launch campaign'],['DEMO · Overdue manager follow-up','Winter campaign'],['Demo Studio','Stone Creative'],['Demo Films','Park Films'],['Demo Agency','Cedar Agency'],['demoagency.example','cedaragency.example'],['demostudio.example','stonecreative.example'],['demofilms.example','parkfilms.example'],['Jamie Lee (demo)','Jamie Lee'],['DEMO: ',''],['FICTIONAL DEMO CASE — not a real client request.\n','']];
function rename(value){if(typeof value==='string')return replacements.reduce((s,[from,to])=>s.replaceAll(from,to),value);if(Array.isArray(value))return value.map(rename);if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,rename(v)]));return value;}
const ids=[];
for(const key of ['manager-refusal','manager-conflict','manager-overdue']){
 const id=creationId(workspace,actor,`manager-demo-v1:${key}`);ids.push(id);
 const row=must(await client.from('syncflow_requests').select('state,version').eq('workspace_id',workspace).eq('id',id).single());
 const engine=openRequestStore(':memory:',{ownerId:workspace,createId:id,initialState:rename(row.state)});
 try{
  const request=engine.get(actor,id),analysis=engine.activeAnalysis(actor,id);
  request.agent_fields=effectiveFields(request,analysis,engine.decisions(actor,id)).filter(f=>f.origin==='agent');
  const dashboard={...dashboardRequest(request,engine.workflow(actor,id),engine.reviewers(actor,id)),id,revision:request.revision,created_at:request.created_at,updated_at:request.updated_at,message_count:request.messages.length,preview:request.messages[0].text.slice(0,100),recording_id:request.recording_id??null};
  must(await client.rpc('syncflow_commit_request',{p_workspace:workspace,p_actor:actor,p_id:id,p_expected:row.version,p_state:engine.exportState(),p_dashboard:dashboard}));
 }finally{engine.close();}
}
const {supervision}=await loadBriefing(client,workspace,actor);
const result=supervision.items.filter(c=>ids.includes(c.request_id)).map(c=>({project:c.project,client:c.client,destination:c.handoff.destination}));
if(result.length!==3||result.some(c=>c.destination!=='internal'||/demo/i.test(c.project+c.client)))throw Error('Verification failed');
console.log(JSON.stringify(result));
