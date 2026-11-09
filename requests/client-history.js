// Group display labels only. This is not a verified client/customer identity registry.
export function clientGroups(requests){
 const groups=new Map();
 for(const request of requests){
  const label=typeof request.contact==='string'?request.contact.trim():'';
  const key=label?`client:${label.toLocaleLowerCase('en')}`:`unidentified:${request.id}`;
  const group=groups.get(key)||{key,name:label||'Client not identified',identified:!!label,requests:[],message_count:0,updated_at:''};
  group.requests.push(request);group.message_count+=request.message_count||0;
  if((request.updated_at||'')>group.updated_at)group.updated_at=request.updated_at;
  groups.set(key,group);
 }
 return [...groups.values()].map(group=>({...group,requests:group.requests.toSorted((a,b)=>(b.updated_at||'').localeCompare(a.updated_at||''))})).sort((a,b)=>b.updated_at.localeCompare(a.updated_at));
}

// A selected file always contains the client's entire history, independent of list filters.
export function clientFile(requests,key){return clientGroups(requests).find(group=>group.key===key)||null;}

// Keep briefing cards in report order; directory recency must not override urgency.
export function priorityClientGroups(requests,items){
 const order=new Map(items.map((item,index)=>[item.request_id,index]));
 const groups=clientGroups(requests.filter(request=>order.has(request.id)));
 for(const group of groups)group.requests.sort((a,b)=>order.get(a.id)-order.get(b.id));
 return groups.sort((a,b)=>order.get(a.requests[0].id)-order.get(b.requests[0].id));
}
export function priorityActionState(summary){
 return summary?.status==='Internal review pending'?'waiting':'action';
}
