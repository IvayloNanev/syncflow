// A handoff must persist before navigation, regardless of its UI entry point.
/** @param {string} requestId @param {{fingerprint?:string,fetchImpl?:typeof fetch}} options */
export async function transferToCoordinator(requestId,{fingerprint,fetchImpl=globalThis.fetch}={}){
 const response=await fetchImpl(`/api/review-email?request=${encodeURIComponent(requestId)}`,{cache:'no-store'});
 const current=await response.json();
 if(!response.ok)throw Error(current.error||'Could not verify this case.');
 if(fingerprint&&current.fingerprint!==fingerprint)throw Error('This case changed. Refresh before routing it.');
 const saved=await fetchImpl('/api/internal-triage',{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({request_id:requestId,fingerprint:current.fingerprint})});
 const result=await saved.json();
 if(!saved.ok)throw Error(result.error||'Could not save this handoff.');
 return `/coordinator?request=${encodeURIComponent(requestId)}`;
}

/** @param {string} requestId @param {'coordinator'|'internal'} destination @param {{fingerprint?:string,fetchImpl?:typeof fetch}} options */
export async function selectCaseAgent(requestId,destination,{fingerprint,fetchImpl=globalThis.fetch}={}){
 const response=await fetchImpl(`/api/review-email?request=${encodeURIComponent(requestId)}`,{cache:'no-store'});
 const current=await response.json();
 if(!response.ok)throw Error(current.error||'Could not verify this case.');
 if(fingerprint&&current.fingerprint!==fingerprint)throw Error('This case changed. Refresh before choosing an agent.');
 const saved=await fetchImpl('/api/requests',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'assign_agent',request_id:requestId,expected_revision:current.revision,expected_scope_token:current.manager_decision_token,expected_assignment_id:current.agent_assignment_id??null,destination,idempotency_key:crypto.randomUUID()})});
 const result=await saved.json();if(!saved.ok)throw Error(result.error?.message||result.error||'Could not save the chosen agent.');
 return `/${destination}?request=${encodeURIComponent(requestId)}`;
}
