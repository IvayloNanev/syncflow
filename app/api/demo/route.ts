import {workspaceSession,storageClient} from '../../../lib/supabase/server';
import {requestOrigin} from '../../../server/request-origin.js';
import {createDemo,advanceDemo,advanceDemoClock,demoView} from '../../../demo/journeys.js';
import {readDemo,writeDemo} from '../../../server/demo-store.js';
export const runtime='nodejs';
export const maxDuration=60;
const json=(status:number,body:unknown)=>Response.json(body,{status,headers:{'cache-control':'private, no-store'}});
export async function GET(){
 try{const session=await workspaceSession();if(!session?.workspaceId)return json(403,{error:'Workspace access required.'});const row=await readDemo(storageClient(),session.workspaceId,session.user.id);return json(200,row?{version:row.version,demo:demoView(row.state)}:{version:0,demo:null});}catch{return json(503,{error:'Demo could not load.'});}
}
export async function POST(req:Request){
 const origin=requestOrigin(req);if(!origin||req.headers.get('origin')!==origin)return json(403,{error:'Use the demo page to run scenarios.'});
 try{
  const session=await workspaceSession();if(!session?.workspaceId)return json(403,{error:'Workspace access required.'});
  if(req.headers.get('content-type')?.split(';')[0]!=='application/json')return json(415,{error:'Send JSON.'});
  const raw=await req.text();if(raw.length>2000)return json(413,{error:'Demo command is too large.'});
  const input=JSON.parse(raw);if(!input||typeof input!=='object'||Object.keys(input).some(key=>!['action','scenario','expected_version'].includes(key))||!['start','reset','advance','clock','briefing'].includes(input.action)||!Number.isSafeInteger(input.expected_version)||input.expected_version<0)return json(400,{error:'Invalid demo command.'});
  const client=storageClient(),row=await readDemo(client,session.workspaceId,session.user.id);
  if((row?.version||0)!==input.expected_version||input.action==='start'&&row)return json(409,{error:'Demo changed in another tab. Reload the demo.'});
  let run;
  if(['start','reset'].includes(input.action))run=await createDemo();
  else{
   if(!row)return json(409,{error:'Start the demo first.'});
   run=structuredClone(row.state);
   if(input.action==='advance')run=await advanceDemo(run,input.scenario);
   if(input.action==='clock')run=advanceDemoClock(run);
   if(input.action==='briefing'){run.baseline={generated_at:run.clock,snapshots:demoView(run).supervision.snapshots};run.events.push({scenario:'briefing',label:'Save scripted demo briefing',at:run.clock});}
  }
  const current=await workspaceSession();if(current?.workspaceId!==session.workspaceId||current?.user.id!==session.user.id)return json(403,{error:'Workspace access changed.'});
  const version=await writeDemo(client,session.workspaceId,session.user.id,input.expected_version,run);
  return json(200,{version,demo:demoView(run)});
 }catch(e){const code=e instanceof Error?e.message:'';return json(code==='DEMO_CONFLICT'?409:['INVALID_SCENARIO','SCENARIO_COMPLETE'].includes(code)||e instanceof SyntaxError?400:503,{error:code==='DEMO_CONFLICT'?'Demo changed in another tab. Reload the demo.':'Demo event could not complete. Your previous saved demo is unchanged.'});}
}
