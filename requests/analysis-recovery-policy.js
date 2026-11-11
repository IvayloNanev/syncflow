// The client request times out at 70s. A 90s grace period avoids replacing an active run.
export function isAbandonedAnalysis(latest,now=Date.now()){
 if(latest?.execution_mode==='durable')return false;
 const started=Date.parse(latest?.created_at);
 return latest?.status==='running'&&Number.isFinite(started)&&now-started>90000;
}
