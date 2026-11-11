import { readFileSync } from 'node:fs';
import {intakeToolSchema,decodeIntakeToolOutput} from './tool-schema.js';

export const INTAKE_PROMPT_VERSION = 'intake-v1.3';
export const INTAKE_TRANSPORT_VERSION = 'strict-groups-v1';
export const INTAKE_SYSTEM_PROMPT = readFileSync(new URL('../prompts/intake-v1.3.txt', import.meta.url), 'utf8');
export class ClaudeProviderError extends Error {
  constructor(code,diagnosticCode=null) { super(code); this.code = code; this.diagnostic_code=diagnosticCode; }
}

/** Server/CLI only. Fixed Anthropic origin; no browser keys, retries or external tools. */
export function createClaudeProvider({ apiKey = process.env.ANTHROPIC_API_KEY,
  model = process.env.ANTHROPIC_MODEL, fetchImpl = globalThis.fetch } = {}) {
  if (!apiKey?.trim() || apiKey.includes('replace_') || !model?.trim())
    throw new ClaudeProviderError('PROVIDER_NOT_CONFIGURED');
  return {
    id: `anthropic:${model}:${INTAKE_PROMPT_VERSION}:${INTAKE_TRANSPORT_VERSION}`,
    mode: 'live',
    async generate({ context, signal }) {
      signal.throwIfAborted();
      let response;
      try {
        response = await fetchImpl('https://api.anthropic.com/v1/messages', {
          method: 'POST', redirect: 'error', signal,
          headers: { 'content-type':'application/json', 'anthropic-version':'2026-10-21',
            authorization:`Bearer ${apiKey}` },
          body: JSON.stringify({ model, max_tokens:4096, stream:false, system:INTAKE_SYSTEM_PROMPT,
            messages:[{role:'user', content:JSON.stringify({context})}],
            tools:[{name:'submit_intake',strict:true, description:'Return proposed licensing request facts for human review. Does not execute any external action.',input_schema:intakeToolSchema}],
            tool_choice:{type:'tool',name:'submit_intake',disable_parallel_tool_use:true} }),
        });
      } catch { throw new ClaudeProviderError('PROVIDER_FAILED'); }
      if (!response.ok) {
        // Do not read or return provider error bodies, which may echo sensitive input.
        const code = response.status===401||response.status===403?'PROVIDER_AUTH_FAILED':
          response.status===429?(response.headers?.get('x-syncflow-usage-limit')?'PROVIDER_USAGE_LIMIT':'PROVIDER_RATE_LIMITED'):response.status>=500?'PROVIDER_FAILED':'PROVIDER_REQUEST_REJECTED';
        throw new ClaudeProviderError(code);
      }
      let message;
      try { message=await response.json(); }
      catch { throw new ClaudeProviderError('INVALID_OUTPUT','INVALID_RESPONSE_JSON'); }
      const calls=Array.isArray(message?.content) ? message.content.filter(c=>c?.type==='tool_use') : [];
      if(message?.stop_reason!=='tool_use') throw new ClaudeProviderError('INVALID_OUTPUT','UNEXPECTED_STOP_REASON');
      if(calls.length!==1||calls[0].name!=='submit_intake') throw new ClaudeProviderError('INVALID_OUTPUT','INVALID_TOOL_ENVELOPE');
      // Tool calls are data only. Never execute model-specified operations.
      const output=decodeIntakeToolOutput(calls[0].input,context);
      if(!output)throw new ClaudeProviderError('INVALID_OUTPUT','INVALID_TOOL_SCHEMA');
      return output;
    },
  };
}
