import {createServerClient} from '@supabase/ssr';
import {NextResponse,type NextRequest} from 'next/server';
export async function proxy(request:NextRequest){
 if(!process.env.NEXT_PUBLIC_SUPABASE_URL||!process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)return NextResponse.next();
 let response=NextResponse.next({request});
 const client=createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,{
  cookies:{getAll:()=>request.cookies.getAll(),setAll(values,headers){
   values.forEach(({name,value})=>request.cookies.set(name,value));response=NextResponse.next({request});
   values.forEach(({name,value,options})=>response.cookies.set(name,value,options));
   Object.entries(headers).forEach(([name,value])=>response.headers.set(name,value));
  }}
 });
 await client.auth.getClaims();response.headers.set('Cache-Control','private, no-store');return response;
}
export const config={matcher:['/','/dashboard','/coordinator/:path*','/internal/:path*','/login','/no-access','/team','/invitations','/auth/:path*','/api/:path*']};
