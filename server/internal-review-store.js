import {assessmentResult,currentAssessment} from '../agents/internal/lifecycle.js';
export async function reviewRows(client,workspace){
 const results=await Promise.all([client.from('syncflow_internal_queue').select('request_id,admitted_at,active,returned_at').eq('workspace_id',workspace),client.from('syncflow_internal_assessments').select('request_id,fingerprint,result').eq('workspace_id',workspace)]);
 for(const result of results)if(result.error)throw Error('REVIEW_STORAGE_FAILED');
 return {queue:results[0].data||[],assessments:results[1].data||[]};
}
export async function admitReview(client,workspace,actor,id){const {error}=await client.from('syncflow_internal_queue').upsert({workspace_id:workspace,request_id:id,admitted_by:actor,active:true,returned_at:null,returned_by:null},{onConflict:'workspace_id,request_id'});if(error)throw Error('REVIEW_STORAGE_FAILED');}
export async function saveAssessment(client,workspace,actor,c,recommendation){
 const result=assessmentResult(c,recommendation);
 const {error}=await client.rpc('syncflow_save_internal_assessment',{p_workspace:workspace,p_actor:actor,p_request:c.id,p_version:c.storage_version,p_fingerprint:result.fingerprint,p_result:result});
 if(error)throw Error(error.message?.includes('STORAGE_CONFLICT')?'REVIEW_CHANGED':'REVIEW_STORAGE_FAILED');
 return result;
}
// Invoked under the workspace analysis lease. A second caller reuses the saved run.
export async function assessOnce({client,workspace,actor,c,generate}){
 const {assessments}=await reviewRows(client,workspace),cached=currentAssessment(c,assessments);
 if(cached)return {assessment:cached,reused:true};
 const report=await generate(c);
 const recommendation=report.items.find(item=>item.request_id===c.id);
 if(!recommendation)throw Error('AI_INVALID_OUTPUT');
 const assessment=await saveAssessment(client,workspace,actor,c,recommendation);
 return {assessment,reused:false};
}

export async function returnToCoordinator(client,workspace,actor,c){const {error}=await client.rpc('syncflow_return_internal_case',{p_workspace:workspace,p_actor:actor,p_request:c.id,p_version:c.storage_version});if(error)throw Error('REVIEW_CHANGED');}
