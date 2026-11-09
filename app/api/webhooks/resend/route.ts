import {Resend} from 'resend';
import {storageClient} from '../../../../lib/supabase/server';
import {receiveEmail} from '../../../../forwarding/receive.js';
export const runtime='nodejs';
export async function POST(req:Request){
 const secret=process.env.RESEND_INBOUND_WEBHOOK_SECRET,key=process.env.RESEND_INBOUND_API_KEY,domain=process.env.SYNCFLOW_INBOUND_DOMAIN;
 if(!secret||!key||!domain)return new Response('Receiving unavailable',{status:503});
 if(Number(req.headers.get('content-length'))>65536)return new Response('Too large',{status:413});
 const raw=await req.text();if(Buffer.byteLength(raw)>65536)return new Response('Too large',{status:413});
 const resend=new Resend(key);let event;
 try{event=resend.webhooks.verify({payload:raw,headers:{id:req.headers.get('svix-id')||'',timestamp:req.headers.get('svix-timestamp')||'',signature:req.headers.get('svix-signature')||''},webhookSecret:secret});}catch{return new Response('Invalid signature',{status:400});}
 if(event.type!=='email.received')return new Response('Ignored');
 try{
  const {data,error}=await resend.emails.receiving.get(event.data.email_id);
  if(error||!data)return new Response('Retry delivery',{status:503});
  await receiveEmail(storageClient(),data,domain);
  return new Response('Received');
 }catch(error){
  const code=error instanceof Error?error.message:'';
  // Invalid recipients/content are permanent; retry only temporary storage failures.
  if(['FORWARDING_DENIED','INVALID_EMAIL','UNSUPPORTED_EMAIL'].includes(code))return new Response('Not imported',{status:200});
  return new Response('Retry delivery',{status:503});
 }
}
