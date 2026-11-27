import {reserveDemo} from './demo-policy.js';
import {randomUUID,createHash} from 'node:crypto';
// Charge each provider attempt before sending, including retries and failures.
// PostgreSQL serializes reservations across server instances; unavailable budgets fail closed.
export const AI_USAGE_MESSAGE='Your AI usage limit has been reached. Try again after the limit resets or ask your workspace administrator.';
export function createBudgetedFetch({client,workspaceId,actorId,feature,attemptPrefix=undefined,fetchImpl=globalThis.fetch}){
 let attempt=0;
 return async (url,init)=>{
  if(String(url)!=='https://api.anthropic.com/v1/messages'||init?.method!=='POST')throw Error('AI_REQUEST_REJECTED');
  init.signal?.throwIfAborted();
  const payload=JSON.parse(init.body);
  if(!Number.isInteger(payload.max_tokens)||payload.max_tokens<1||payload.max_tokens>8192)throw Error('AI_REQUEST_REJECTED');
  const inputBytes=Buffer.byteLength(init.body,'utf8');
  if(inputBytes>256000)throw Error('AI_CONTEXT_TOO_LARGE');
  const args={p_workspace:workspaceId,p_actor:actorId,p_feature:feature,p_input_bytes:inputBytes};
  const {data,error}=await client.rpc(attemptPrefix?'syncflow_reserve_durable_ai_attempt':'syncflow_reserve_ai_usage',attemptPrefix?{...args,p_key:attemptPrefix+':'+attempt++,p_digest:createHash('sha256').update(init.body).digest('hex')}:args);
  if(error||!data||typeof data.allowed!=='boolean')throw Error('AI_USAGE_UNAVAILABLE');
  if(data.duplicate)return new Response(null,{status:409,headers:{'x-syncflow-uncertain-attempt':'true'}});
  if(!data.allowed)return new Response(null,{status:429,headers:{'x-syncflow-usage-limit':'reached','retry-after':String(data.retry_after||60)}});
  if(!await reserveDemo(client,workspaceId,actorId,'provider',attemptPrefix?attemptPrefix+':'+(attempt-1):randomUUID(),inputBytes))return new Response(null,{status:429,headers:{'x-syncflow-usage-limit':'reached','retry-after':'86400'}});
  init.signal?.throwIfAborted();
  return fetchImpl(url,init);
 };
}
