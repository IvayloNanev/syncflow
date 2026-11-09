// Read-only priority reviewer. Client wording never changes the ranking rules.
// Uses current database summaries; does not infer missing deadlines or take actions.
const DAY=86400000;
function deadlineDay(deadline,now){
 if(!deadline?.date||!/^\d{4}-\d{2}-\d{2}$/.test(deadline.date)||!deadline.timezone)return null;
 const target=Date.parse(`${deadline.date}T00:00:00Z`);
 if(!Number.isFinite(target)||new Date(target).toISOString().slice(0,10)!==deadline.date)return null;
 try{
  const parts=new Intl.DateTimeFormat('en-US',{timeZone:deadline.timezone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
  const part=type=>parts.find(p=>p.type===type)?.value;
  const today=Date.parse(`${part('year')}-${part('month')}-${part('day')}T00:00:00Z`);
  return Math.round((target-today)/DAY);
 }catch{return null;}
}
// Resolve a supplied local deadline in its recorded timezone, never the server timezone.
export function deadlineInstant(deadline){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(deadline?.date||'')||!/^\d{2}:\d{2}(:\d{2})?$/.test(deadline?.time||'')||!deadline.timezone)return null;
 const wall=`${deadline.date}T${deadline.time.length===5?deadline.time+':00':deadline.time}`;
 const target=Date.parse(wall+'Z');if(!Number.isFinite(target))return null;
 try{
  const formatter=new Intl.DateTimeFormat('en-CA',{timeZone:deadline.timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
  let instant=target;
  for(let n=0;n<3;n++){const parts=formatter.formatToParts(instant),part=key=>parts.find(p=>p.type===key)?.value;const local=`${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}:${part('second')}`;if(local===wall)return instant;instant+=target-Date.parse(local+'Z');}
 }catch{}
 return null;
}
export function reviewPriorities(requests,{now=new Date()}={}){
 const open=requests.filter(r=>r.status!=='Internal review complete');
 const ranked=open.map(r=>{
  const days=deadlineDay(r.deadline,now),instant=deadlineInstant(r.deadline);
  let rank=7,reason='This case still has open actions.';
  if(instant!==null&&instant<now.getTime()){rank=0;reason=`The recorded response deadline has passed (${r.deadline.date} ${r.deadline.time} ${r.deadline.timezone}).`;}
  else if(days!==null&&days<0){rank=0;reason=`The recorded response deadline was ${r.deadline.date} (${r.deadline.timezone}) and has passed.`;}
  else if(days===0){rank=1;reason=`The response deadline is today in ${r.deadline.timezone}.`;}
  else if(days!==null&&days<=3){rank=2;reason=`The response deadline is ${r.deadline.date}, within three days (${r.deadline.timezone}).`;}
  else if(r.status==='Needs analysis'){rank=3;reason='The current conversation needs analysis before the request can move forward.';}
  else if(['Changes requested','Declined'].includes(r.status)){rank=4;reason='A reviewer decision needs follow-up.';}
  else if(r.status==='Needs coordinator review'){rank=5;reason='The complete brief is waiting for coordinator sign-off.';}
  else if(['Internal review pending','Ready to complete internal review','Ready for internal review'].includes(r.status)){rank=6;reason='The internal review still needs a handoff, decision or completion.';}
  const internal=['Internal review pending','Ready to complete internal review','Ready for internal review','Changes requested','Declined'].includes(r.status);
  return {request_id:r.id,revision:r.revision,client:r.contact||'Client not identified',project:r.project||r.track||'Untitled case',status:r.status||'Status unavailable',reason,next_action:r.next_action||'Open the case to review the outstanding actions.',responsible:r.responsible||'Coordinator',destination:internal?'internal':'coordinator',urgency:rank<3?'deadline':'action',rank,deadline_days:days,deadline_at:instant,updated_at:r.updated_at||null};
 }).sort((a,b)=>a.rank-b.rank||(a.deadline_days??Infinity)-(b.deadline_days??Infinity)||(a.deadline_at??Infinity)-(b.deadline_at??Infinity)||(a.updated_at||'9999').localeCompare(b.updated_at||'9999')||a.request_id.localeCompare(b.request_id));
 return {items:ranked,policy:'priority-v1',ranked_request_ids:ranked.map(item=>item.request_id),generated_at:now.toISOString(),reviewed_count:requests.length,open_count:open.length,recommendation:ranked[0]||null};
}
