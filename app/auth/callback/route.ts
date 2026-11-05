import {requestOrigin} from '../../../server/request-origin.js';
import {NextResponse} from 'next/server';
import {sessionClient} from '../../../lib/supabase/server';
export async function GET(request:Request){
 const origin=requestOrigin(request);if(!origin)return new Response(null,{status:403});
 const url=new URL(request.url);const code=url.searchParams.get('code');
 if(code){const client=await sessionClient();const {error}=await client.auth.exchangeCodeForSession(code);if(!error)return NextResponse.redirect(new URL('/coordinator',origin));}
 return NextResponse.redirect(new URL('/login?message=invalid',origin));
}
