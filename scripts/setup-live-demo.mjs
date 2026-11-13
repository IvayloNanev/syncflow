// Server-only setup after db/live-demo.sql. Never reuse a team member as guest actor.
import {config} from 'dotenv';
import {randomBytes} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
config({path:process.env.SYNCFLOW_DEMO_ENV||'.env.local',quiet:true});
config({path:'.env',quiet:true});
if(process.env.SYNCFLOW_SETUP_LIVE_DEMO!=='1')throw Error('Explicit live-demo setup opt-in required.');
const client=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SECRET_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const {data:settings,error}=await client.from('syncflow_demo_settings').select('actor_id').eq('id',true).single();
if(error)throw Error('Apply db/live-demo.sql first.');
let actor=settings.actor_id;
if(!actor){
 const {data,error}=await client.auth.admin.createUser({email:`syncflow-demo-${randomBytes(12).toString('hex')}@example.invalid`,email_confirm:false,app_metadata:{syncflow_demo_service:true}});
 if(error||!data.user)throw Error('Could not create isolated demo service identity.');
 actor=data.user.id;
 const {error:banError}=await client.auth.admin.updateUserById(actor,{ban_duration:'876000h'});
 if(banError)throw Error('Could not disable interactive sign-in for the service identity.');
}
const {data:user,error:userError}=await client.auth.admin.getUserById(actor);
if(userError||!user.user?.app_metadata?.syncflow_demo_service)throw Error('Expected an isolated demo service identity.');
const {data:members,error:memberError}=await client.from('syncflow_members').select('workspace_id').eq('user_id',actor);
if(memberError||members.some(m=>!m.workspace_id.startsWith('de000000-')))throw Error('Demo identity must not belong to a team workspace.');
const {error:saveError}=await client.from('syncflow_demo_settings').update({actor_id:actor,enabled:true}).eq('id',true);
if(saveError)throw Error('Could not enable guest-demo settings.');
console.log(JSON.stringify({liveDemoConfigured:true,identityHasNoTeamMemberships:true,dailyProviderCalls:60,sessionProviderCalls:12}));
