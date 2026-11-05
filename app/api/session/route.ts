import {sharedConfigured,workspaceSession} from '../../../lib/supabase/server';
export async function GET(){
 if(!sharedConfigured())return Response.json({scope:'local'},{headers:{'cache-control':'no-store'}});
 const session=await workspaceSession();
 return Response.json(session?{scope:`${session.user.id}:${session.workspaceId??'unassigned'}`,email:session.user.email}: {scope:'signed-out'},{status:session?200:401,headers:{'cache-control':'private, no-store'}});
}
