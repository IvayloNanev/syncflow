import {readFileSync,writeFileSync} from 'node:fs';
import {runIntake} from '../../agents/intake/run-intake.js';
import {createClaudeProvider} from '../../agents/intake/providers/claude.js';
import {validateContract} from '../../contracts/validate.js';
import {validationCodes} from '../../agents/intake/validation-codes.js';
process.loadEnvFile('.env');
const target=process.argv[2];if(!target)throw Error('Provide report output. Three development calls; not an acceptance rerun.');
const context=JSON.parse(readFileSync(new URL('../held-out/E11-online-without-named-platforms.json',import.meta.url),'utf8')).context;
const provider=createClaudeProvider();const cases=[];
for(let i=0;i<3;i++){
 let diagnostics=[];let fields=[];
 const result=await runIntake({...context,run_id:`development-e11-${i}`},{provider:{...provider,generate:async args=>{
   const output=await provider.generate(args);
   try{validateContract('intake',output,args.context);}catch(error){diagnostics=validationCodes(error);}
   fields=(output?.proposed_changes||[]).filter(p=>['client_contact','project','artist','track_title','recording_version','intended_use','platforms','territories','campaign_term','music_length','budget','response_deadline'].includes(p.field_key))
     .filter(p=>(p.evidence||[]).some(e=>!args.context.messages.some(m=>m.message_id===e.message_id&&m.text.includes(e.exact_quote)))).map(p=>p.field_key);
   return output;
 }}});
 cases.push({attempt:i+1,ok:result.ok,error:result.error||null,validation_codes:diagnostics,evidence_mismatch_fields:fields});
 writeFileSync(target,JSON.stringify({kind:'development-reproduction-not-acceptance',model:process.env.ANTHROPIC_MODEL,cases},null,2)+'\n');
 console.log(JSON.stringify(cases.at(-1)));
}
