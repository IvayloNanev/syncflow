// Charge each provider attempt before sending, including retries and failures.
// PostgreSQL serializes reservations across server instances; unavailable budgets fail closed.
export const AI_USAGE_MESSAGE='Your AI usage limit has been reached. Try again after the limit resets or ask your workspace administrator.';
export function createBudgetedFetch({client,workspaceId,actorId,feature,fetchImpl=globalThis.fetch}){
 return async (url,init)=>{
  if(String(url)!=='https://api.anthropic.com/v1/messages'||init?.method!=='POST')throw Error('AI_REQUEST_REJECTED');
  init.signal?.throwIfAborted();
  const payload=JSON.parse(init.body);
  if(!Number.isInteger(payload.max_tokens)||payload.max_tokens<1||payload.max_tokens>8192)throw Error('AI_REQUEST_REJECTED');
  const inputBytes=Buffer.byteLength(init.body,'utf8');
  if(inputBytes>256000)throw Error('AI_CONTEXT_TOO_LARGE');
  const {data,error}=await client.rpc('syncflow_reserve_ai_usage',{p_workspace:workspaceId,p_actor:actorId,p_feature:feature,p_input_bytes:inputBytes});
  if(error||!data||typeof data.allowed!=='boolean')throw Error('AI_USAGE_UNAVAILABLE');
  if(!data.allowed)return new Response(null,{status:429,headers:{'x-syncflow-usage-limit':'reached','retry-after':String(data.retry_after||60)}});
  init.signal?.throwIfAborted();
  return fetchImpl(url,init);
 };
}
