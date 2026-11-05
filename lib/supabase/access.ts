import {redirect} from 'next/navigation';
import {sharedConfigured,workspaceSession} from './server';
export async function requireWorkspace(){
 if(!sharedConfigured())return null;
 const session=await workspaceSession();if(!session)redirect('/login');
 if(!session.workspaceId)redirect('/no-access');return session;
}
