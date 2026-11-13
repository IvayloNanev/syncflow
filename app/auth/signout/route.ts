import {cookies} from 'next/headers';
import {DEMO_COOKIE} from '../../../server/demo-policy.js';
import {requestOrigin} from '../../../server/request-origin.js';
import {NextResponse} from 'next/server';
import {sessionClient} from '../../../lib/supabase/server';
export async function POST(request:Request){
 const origin=requestOrigin(request);if(!origin||request.headers.get('origin')!==origin)return new Response(null,{status:403});
 if((await cookies()).has(DEMO_COOKIE))return Response.json({error:'Use Exit demo to leave this guest workspace.'},{status:409});
 const client=await sessionClient();const {error}=await client.auth.signOut();
 if(error)return Response.json({error:'Sign out failed. Please retry.'},{status:500});
 return NextResponse.redirect(new URL('/login',origin),303);
}
