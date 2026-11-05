"use client";
import {useState} from 'react';
import type {AnalysisSummary} from './saved-requests';
export default function AnalysisRecovery({latest,busy,hasCurrentResult,onCheck,onRetry}:{latest:AnalysisSummary|undefined;busy:boolean;hasCurrentResult:boolean;onCheck:()=>Promise<boolean>;onRetry:()=>void}) {
 const [checked,setChecked]=useState<{runId:string;oldEnough:boolean}|null>(null);
 if(!latest || !['failed','running','stale','superseded'].includes(latest.status)) return null;
 const pending=latest.status==='running';
 const oldEnough=checked?.oldEnough===true;
 return <section className="analysis-recovery" aria-labelledby="recovery-heading"><h2 id="recovery-heading">{pending?'Analysis has not finished':latest.status==='failed'?'The last analysis did not complete':'A newer request or attempt replaced this analysis'}</h2>
   <p>{pending?'Check its saved status before starting more work. The previous attempt may still finish.':latest.failure?.error.message || 'Saved history is retained. Check the request before starting a new attempt.'}</p>
   <p>{hasCurrentResult?'An earlier validated result for this revision is still shown. The failed attempt did not replace it.':'No result from this attempt is being used as current.'} Your emails, confirmed facts and saved handoff versions are retained.</p>
   <button type="button" className="secondary-button" disabled={busy} onClick={async()=>{if(await onCheck())setChecked({runId:latest.run_id,oldEnough:!!latest.created_at && Date.now()-Date.parse(latest.created_at)>90000});}}>Check saved analysis status</button>
   {!pending || (oldEnough && checked?.runId===latest.run_id) ? <button type="button" className="primary-button" disabled={busy} onClick={onRetry}>Start a new analysis attempt</button> : null}
   <p className="panel-note">A new attempt uses API credits. There are no automatic retries. Unvalidated output is never accepted.</p>
   <details><summary>Technical reference for support</summary><p>Run {latest.run_id} · revision {latest.base_revision} · {latest.status}</p>{latest.failure ? <p>{latest.failure.failed_stage} · {latest.failure.error.code}{latest.failure.error.validation_codes?.length ? ` · ${latest.failure.error.validation_codes.join(', ')}` : ''}</p>:null}</details>
 </section>;
}
