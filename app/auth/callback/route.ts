import {workspaceDestination,loginDestination} from '../../../lib/auth-destination.js';
import {requestOrigin} from '../../../server/request-origin.js';
import {cookies} from 'next/headers';
import {NextResponse} from 'next/server';
import {sessionClient} from '../../../lib/supabase/server';
export async function GET(request:Request){
 const origin=requestOrigin(request);if(!origin)return new Response(null,{status:403});
 const url=new URL(request.url);const code=url.searchParams.get('code');
 const jar=await cookies();
 let intent:{next?:string;recovery?:boolean;provider?:string}={};
 try{intent=JSON.parse(jar.get('syncflow-auth-return')?.value||'{}')||{};}catch{}
 const next=workspaceDestination(intent.next);
 const recovery=intent.recovery===true;
 jar.delete({name:'syncflow-auth-return',path:'/auth/callback'});
 if(code){try{const client=await sessionClient();const {error}=await client.auth.exchangeCodeForSession(code);if(!error)return NextResponse.redirect(new URL(recovery?loginDestination(next,{mode:'reset'}):next,origin));}catch{/* Show the recoverable link error below. */}}
 return NextResponse.redirect(new URL(loginDestination(next,{message:recovery?'reset-link-failed':intent.provider==='google'?'google-failed':'link-failed'}),origin));
}
