import {recordings} from './recordings.js';
const normalize=value=>value.normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
export function recordingMismatches(request) {
 const recording=recordings.find(r=>r.id===request.recording_id);if(!recording)return [];
 const mismatches=[];
 for(const [key,value] of [['artist',recording.artist],['track_title',recording.title],['recording_version',recording.version]]) {
  const field=request.confirmed_fields.find(f=>f.field_key===key&&f.state==='confirmed');
  if(typeof field?.value!=='string')continue;
  const canonical=text=>key==='recording_version'?normalize(text).replace(/\b(recording|version)\b/g,'').replace(/\s+/g,' ').trim():normalize(text);
  if(canonical(field.value)!==canonical(value))mismatches.push(key);
 }
 return mismatches;
}
