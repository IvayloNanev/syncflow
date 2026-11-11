import {recordings} from './recordings.js';
const normalize=value=>String(value||'').normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
// Catalogue search is a coverage check only; it never establishes licensing authority.
/** @param {{messages?:{text:string}[],fields?:{field_key:string,value:unknown}[]}} input */
export function assessCatalogue({messages=[],fields=[]}={}){
 const field=key=>{const value=[...fields].reverse().find(f=>f.field_key===key)?.value;return typeof value==='string'?value.trim():'';};
 let artist=field('artist'),title=field('track_title'),catalogueWide=false,sourceIdentified=false;
 const version=field('recording_version');
 for(const message of [...messages].reverse()){
  const text=message.text||'';
  // A catalogue-wide enquiry can omit structured song/artist proposals entirely.
  const match=text.match(/\b(?:use|license|licence|request(?:ing)?|interested in)\s+(?:the\s+)?([^\n.!?]{1,100}?)\s+(?:catalogue|catalog)\b/i);
  if(match){sourceIdentified=true;catalogueWide=!title;if(!artist)artist=match[1].replace(/(?:['’]s)\s*$/,'').trim();break;}
  const by=text.match(/\b(?:music|songs?|tracks?|recordings?)\s+(?:by|from)\s+([^\n,.!?]{1,80}?)(?=\s+(?:for|in|on|to|with)\b|[\n,.!?]|$)/i);
  if(by){sourceIdentified=true;if(!artist)artist=by[1].trim();break;}
 }
 if(!artist&&!title)return {status:'unresolved',artist:null,title:null,catalogueWide,sourceIdentified,message:'Confirm the artist, song and exact recording before checking catalogue coverage.'};
 const byArtist=artist?recordings.filter(r=>normalize(r.artist)===normalize(artist)):recordings;
 const matches=title?byArtist.filter(r=>normalize(r.title)===normalize(title)):byArtist;
 if(!matches.length){
  const requested=[artist,title].filter(Boolean).join(' · ');
  const missing=[!artist&&'artist',!title&&'specific song titles',!version&&'recording version'].filter(Boolean);
  const client_question=missing.length?`Please confirm the ${missing.join(' and ')}. A recording link would help us verify availability.`:null;
  const question=client_question||'Verify the supplied artist, song and recording version against catalogue sources before progressing. Do not ask the client to repeat the supplied identity.';
  return {status:'not_found',artist:artist||null,title:title||null,catalogueWide,sourceIdentified,message:`No match found in SyncFlow’s current catalogue for “${requested}”. Catalogue absence does not establish whether the music can be licensed.`,question,client_question};
 }
 return {status:catalogueWide?'catalogue_enquiry':'candidate',artist:artist||null,title:title||null,catalogueWide,sourceIdentified,message:catalogueWide?'Catalogue-wide enquiry: specify the songs and recording versions before proceeding.':'Catalogue candidates found. Confirm the exact recording and verify rights separately.',question:catalogueWide?'Which specific songs and recording versions would you like to use? Please share recording links.':null};
}
