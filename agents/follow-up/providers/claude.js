// Static import keeps the versioned prompt available in durable step bundles.
import bundledPrompt from '../prompts/follow-up-v1.json' with {type:'json'};
import shared from '../../../contracts/shared.schema.json' with { type: 'json' };
import outputSchema from '../../../contracts/follow_up.schema.json' with { type: 'json' };

export const FOLLOW_UP_PROMPT_VERSION = 'follow-up-v1.1';
const prompt = bundledPrompt;
// Inline our local shared refs for a self-contained client-tool schema.
function inline(value) {
  if (Array.isArray(value)) return value.map(inline);
  if (!value || typeof value !== 'object') return value;
  if (Object.hasOwn(value, 'const')) {
    return { type: typeof value.const, enum: [value.const] };
  }
  if (value.$ref) {
    const name = value.$ref.split('#/$defs/')[1];
    if (!shared.$defs[name]) throw new Error('Unsupported schema reference');
    return inline(shared.$defs[name]);
  }
  return Object.fromEntries(Object.entries(value).filter(([k]) => !['$schema', '$id', 'title'].includes(k)).map(([k,v])=>[k,inline(v)]));
}
const schema = inline(outputSchema);
export class ClaudeProviderError extends Error {
  constructor(code) { super(code); this.code = code; }
}

/** Server/CLI only. Fixed Anthropic origin; no browser keys, retries or external tools. */
export function createFollowUpClaudeProvider({ apiKey = process.env.ANTHROPIC_API_KEY,
  model = process.env.ANTHROPIC_MODEL, fetchImpl = globalThis.fetch } = {}) {
  if (!apiKey?.trim() || apiKey.includes('replace_') || !model?.trim())
    throw new ClaudeProviderError('PROVIDER_NOT_CONFIGURED');
  return {
    id: `anthropic:${model}`,
    mode: 'live',
    async generate({ context, review, signal }) {
      signal.throwIfAborted();
      let response;
      try {
        response = await fetchImpl('https://api.anthropic.com/v1/messages', {
          method: 'POST', redirect: 'error', signal,
          headers: { 'content-type':'application/json', 'anthropic-version':'2026-10-21',
            authorization:`Bearer ${apiKey}` },
          body: JSON.stringify({ model, max_tokens:4096, stream:false, system:prompt,
            messages:[{role:'user', content:JSON.stringify({context,review:{schema_version:review.schema_version,run_id:review.run_id,base_record_version:review.base_record_version,issues:review.issues}})}],
            tools:[{name:'submit_follow_up', description:'Return a clarification email draft for human review. Does not execute any external action.',input_schema:schema}],
            tool_choice:{type:'tool',name:'submit_follow_up',disable_parallel_tool_use:true} }),
        });
      } catch { throw new ClaudeProviderError('PROVIDER_FAILED'); }
      if (!response.ok) {
        // Do not read or return provider error bodies, which may echo sensitive input.
        const code = response.headers?.get('x-syncflow-uncertain-attempt')?'PROVIDER_ATTEMPT_UNCERTAIN':response.status===401||response.status===403?'PROVIDER_AUTH_FAILED':
          response.status===429?(response.headers?.get('x-syncflow-usage-limit')?'PROVIDER_USAGE_LIMIT':'PROVIDER_RATE_LIMITED'):response.status>=500?'PROVIDER_FAILED':'PROVIDER_REQUEST_REJECTED';
        throw new ClaudeProviderError(code);
      }
      let message;
      try { message=await response.json(); }
      catch { throw new ClaudeProviderError('INVALID_OUTPUT'); }
      const calls=message.content?.filter?.(c=>c.type==='tool_use');
      if (message.stop_reason!=='tool_use'||calls?.length!==1||calls[0].name!=='submit_follow_up')
        throw new ClaudeProviderError('INVALID_OUTPUT');
      // Tool calls are data only. Never execute model-specified operations.
      return calls[0].input;
    },
  };
}
