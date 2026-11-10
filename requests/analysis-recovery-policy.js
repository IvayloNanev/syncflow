// The client request times out at 70s. A 90s grace period avoids replacing an active run.
export function isAbandonedAnalysis(latest,now=Date.now()){
 const started=Date.parse(latest?.created_at);
 return latest?.status==='running'&&Number.isFinite(started)&&now-started>90000;
}
