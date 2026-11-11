import {createHmac,timingSafeEqual} from 'node:crypto';
const secret=()=>{if(!process.env.SUPABASE_SECRET_KEY)throw Error('RUN_ACCESS_UNAVAILABLE');return process.env.SUPABASE_SECRET_KEY;};
export function signRunAccess({runId,workspaceId},key=secret(),now=Date.now()){
 const body=Buffer.from(JSON.stringify({runId,workspaceId,expires:now+86400000})).toString('base64url');
 const mac=createHmac('sha256',key).update('syncflow-ai-run-v1:'+body).digest('base64url');return body+'.'+mac;
}
export function verifyRunAccess(token,workspaceId,key=secret(),now=Date.now()){
 if(typeof token!=='string'||token.length>2000)return null;
 const [body,mac,...rest]=token.split('.');if(rest.length||!body||!mac)return null;
 const expected=createHmac('sha256',key).update('syncflow-ai-run-v1:'+body).digest();let received;
 try{received=Buffer.from(mac,'base64url');}catch{return null;}
 if(received.length!==expected.length||!timingSafeEqual(received,expected))return null;
 try{const input=JSON.parse(Buffer.from(body,'base64url').toString());return input.workspaceId===workspaceId&&typeof input.runId==='string'&&input.runId.length<200&&Number.isFinite(input.expires)&&input.expires>now?input.runId:null;}catch{return null;}
}
