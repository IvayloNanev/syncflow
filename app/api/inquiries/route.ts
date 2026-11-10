import {workspaceSession,storageClient} from '../../../lib/supabase/server';
import {requestOrigin} from '../../../server/request-origin.js';
import {saveInquiry} from '../../../forwarding/inquiries.js';
export const runtime='nodejs';
export async function POST(req:Request){
 const json=(status:number,body:unknown)=>Response.json(body,{status,headers:{'cache-control':'private, no-store'}});
 const origin=requestOrigin(req);if(!origin||req.headers.get('origin')!==origin)return json(403,{error:'Use New Inquiries to save a case.'});
 const session=await workspaceSession();if(!session?.workspaceId)return json(401,{error:'Sign in to your workspace.'});
 try{
  const raw=await req.text();if(raw.length>1000)return json(413,{error:'Request too large.'});
  const input=JSON.parse(raw);
  if(!input||Object.keys(input).some(k=>!['email_id','timezone'].includes(k))||typeof input.email_id!=='string'||!/^[a-zA-Z0-9-]{1,100}$/.test(input.email_id)||input.timezone&&typeof input.timezone!=='string')return json(400,{error:'Choose a received email.'});
  const result=await saveInquiry(storageClient(),{workspaceId:session.workspaceId,actorId:session.user.id,emailId:input.email_id,timezone:input.timezone||'UTC'});
  return json(200,result);
 }catch(error){const message=error instanceof Error?error.message:'';return json(message==='INQUIRY_NOT_FOUND'?404:message==='ACCESS_DENIED'?403:503,{error:'Case could not be saved. Your inquiry is retained; try again.'});}
}
