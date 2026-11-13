import {creationId,openSharedStore} from '../requests/shared-store.js';
import {managerDecisionToken} from '../requests/manager-decision.js';
import {admitReview} from './internal-review-store.js';
// Seed only source data and an explicit assignment. All AI results are generated live.
export async function seedDemo(client,workspaceId,actorId,{now=new Date()}={}){
 const date=offset=>new Date(now.getTime()+offset*86400000).toISOString().slice(0,10);
 const specs=[
  {key:'overdue',name:'Jordan Lee',company:'City Studio',project:'City lights campaign',offset:-1,internal:true},
  {key:'today',name:'Sam Rivera',company:'River Films',project:'Autumn film',offset:0},
  {key:'upcoming',name:'Alex Taylor',company:'Harbor Studio',project:'Harbor campaign',offset:4},
 ];
 for(const spec of specs){
  const key=`guest-demo-v1:${spec.key}`,id=creationId(workspaceId,actorId,key);
  const store=await openSharedStore({client,workspaceId,actorId,id});
  try{
   const email=`Subject: ${spec.project}\nFrom: ${spec.name} <${spec.name.toLowerCase().replaceAll(' ','.')}@example.invalid>\n\nFICTIONAL GUEST DEMO — no real client or music permission.\nHello,\nI am ${spec.name} at ${spec.company}. Contact: ${spec.name}, ${spec.name.toLowerCase().replaceAll(' ','.')}@example.invalid.\nProject: ${spec.project}. We would like to license Northern Lights by Maya Rivers, original recording, for a paid advertisement on YouTube and Instagram in Canada. The campaign runs for three months starting ${date(14)}. We need 30 seconds and both master recording and publishing rights.\n${spec.internal?'Our budget is CAD 5,000 for both rights. We need a manager decision on whether to expand our request to worldwide usage before committing to the client.':'Our budget has not been decided yet.'}\nPlease respond by ${date(spec.offset)} at 17:00 America/Toronto.\nThank you,\n${spec.name}`;
   store.create({actor_id:actorId,idempotency_key:key,email,timezone:'America/Toronto',recording_id:'TRACK-0001'});
   if(spec.internal){
    const request=store.get(actorId,id);
    store.assignAgent({actor_id:actorId,request_id:id,expected_revision:0,expected_scope_token:managerDecisionToken({...request,reviewers:store.reviewers(actorId,id)}),expected_assignment_id:null,destination:'internal',idempotency_key:`${key}:assignment`});
   }
   await store.flush();if(spec.internal)await admitReview(client,workspaceId,actorId,id);
  }finally{store.dispose();}
 }
}
