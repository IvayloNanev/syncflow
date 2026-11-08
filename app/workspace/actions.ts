'use server';
import {cookies} from 'next/headers';
import {redirect} from 'next/navigation';
import {sessionClient} from '../../lib/supabase/server';
export async function switchWorkspace(form:FormData){
 const id=String(form.get('workspace_id')||'');
 const client=await sessionClient();
 const {data:{user},error}=await client.auth.getUser();
 if(error||!user)redirect('/login');
 const {data,error:membershipError}=await client.from('syncflow_members').select('workspace_id').eq('user_id',user.id).eq('workspace_id',id).maybeSingle();
 if(membershipError||!data)throw new Error('This workspace is not available to your account.');
 (await cookies()).set('syncflow-workspace',id,{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',path:'/',maxAge:60*60*24*30});
 redirect('/coordinator');
}
