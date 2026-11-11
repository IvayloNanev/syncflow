// Browser transport: disconnecting polling does not cancel durable background work.
export async function runAIRequest(url,init={}, {fetchImpl=globalThis.fetch,wait=abortableDelay}={}){
 const headers=new Headers(init.headers);if(!headers.has('x-syncflow-attempt'))headers.set('x-syncflow-attempt',crypto.randomUUID());
 const initial=await fetchImpl(url,{...init,headers});if(initial.status!==202)return initial;
 const queued=await initial.json();if(typeof queued.run_token!=='string')throw Error('AI run could not be tracked. Check saved results before retrying.');
 for(let count=0;count<300;count++){
  init.signal?.throwIfAborted();
  const response=await fetchImpl('/api/ai-runs',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({run_token:queued.run_token}),signal:init.signal,cache:'no-store'});
  const data=await response.json();if(!response.ok)return Response.json(data,{status:response.status});
  if(data.status==='completed')return Response.json(data.result.body,{status:data.result.status});
  if(['failed','cancelled'].includes(data.status))throw Error('AI could not finish. Saved results are retained; retry explicitly when ready.');
  await wait(2000,init.signal);
 }
 throw Error('AI is still pending. Reopen this case or refresh the workspace to check saved results.');
}
function abortableDelay(ms,signal){return new Promise((resolve,reject)=>{
 signal?.throwIfAborted();const done=()=>{signal?.removeEventListener('abort',abort);resolve();};const timer=setTimeout(done,ms);
 const abort=()=>{clearTimeout(timer);signal.removeEventListener('abort',abort);reject(signal.reason);};signal?.addEventListener('abort',abort,{once:true});
});}
