'use client';
import {useEffect,useState} from 'react';
import {savedCorrespondence} from '../requests/correspondence.js';
type Detail={correspondence:{id:string;kind:string;date:string|null;subject:string|null;text:string;draft:boolean}[];context:{client:string;recording:string;status:string;decision:string};facts:{label:string;value:unknown;source:string}[];messages:{message_id:string;text:string}[]};
function readable(value:unknown):string{if(value==null)return 'Not supplied';if(Array.isArray(value))return value.map(readable).join(', ');if(typeof value==='object')return Object.entries(value).map(([key,item])=>`${key.replaceAll('_',' ')}: ${readable(item)}`).join(' · ');return String(value);}
export default function CaseDetails({requestId}:{requestId:string}){
 const [data,setData]=useState<Detail|null>(null),[error,setError]=useState('');
 useEffect(()=>{const abort=new AbortController();fetch(`/api/review-email?request=${encodeURIComponent(requestId)}`,{cache:'no-store',signal:abort.signal}).then(async res=>{const value=await res.json();if(!res.ok)throw Error(value.error||'Could not load this case.');if(!abort.signal.aborted)setData(value);}).catch(e=>{if(!abort.signal.aborted)setError(e.message);});return()=>abort.abort();},[requestId]);
 if(error)return <p role="alert">{error}</p>;if(!data)return <p role="status">Loading saved case…</p>;
 const correspondence=savedCorrespondence(data);
 return <div><h3>Case details</h3><p><strong>Client:</strong> {data.context.client}</p><p><strong>Recording:</strong> {data.context.recording}</p><p><strong>Status:</strong> {data.context.status}</p><details><summary>Saved facts ({data.facts.length})</summary>{data.facts.length?<dl>{data.facts.map((fact,i)=><div key={i}><dt>{fact.label.replaceAll('_',' ')} · {fact.source}</dt><dd>{readable(fact.value)}</dd></div>)}</dl>:<p>No extracted facts saved.</p>}</details><section><h3>Full correspondence ({correspondence.length})</h3>{correspondence.map((entry:{id:string;kind:string;date?:string|null;subject?:string|null;text:string})=><article key={entry.id}><h4>{entry.kind}</h4>{entry.date?<p><time dateTime={entry.date}>{new Date(entry.date).toLocaleString()}</time></p>:null}{entry.subject?<p><strong>Subject:</strong> {entry.subject}</p>:null}<p style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere',lineHeight:1.8}}>{entry.text}</p></article>)}</section></div>;
}
