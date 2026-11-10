import {effectiveFields} from '../requests/effective-fields.js';
import {dashboardRequest} from '../requests/dashboard.js';
import {reviewRecording} from '../catalog/review.js';
import {caseHandoff} from '../agents/priority/supervisor.js';
export function storedRoutingCase(store,actor,id){
 const request=store.get(actor,id),analysis=store.activeAnalysis(actor,id),reviewers=store.reviewers(actor,id),workflow=store.workflow(actor,id);
 request.agent_fields=effectiveFields(request,analysis,store.decisions(actor,id)).filter(f=>f.origin==='agent');
 return {id,revision:request.revision,manager_resolution:request.manager_resolution,agent_assignment:request.agent_assignment,internal_review_request:request.internal_review_request,recording_id:request.recording_id,messages:request.messages,confirmed_fields:request.confirmed_fields,analysis,reviewers,workflow,summary:dashboardRequest(request,workflow,reviewers),catalogue_assessment:analysis?.result?.catalogue_assessment||analysis?.result?.stages?.review?.output?.catalogue_assessment||reviewRecording(request.recording_id)};
}
export function canRunCoordinator(c){const handoff=caseHandoff(c);return handoff.state!=='finished'&&handoff.destination==='coordinator';}
