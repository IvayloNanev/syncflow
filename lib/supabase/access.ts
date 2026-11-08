import {workspaceDestination,loginDestination} from '../auth-destination.js';
import {redirect} from 'next/navigation';
import {sharedConfigured,workspaceSession} from './server';
export async function requireWorkspace(destination='/coordinator'){
 if(!sharedConfigured())return null;
 const session=await workspaceSession();if(!session)redirect(loginDestination(destination));
 if(!session.workspaceId)redirect(`/no-access?${new URLSearchParams({next:workspaceDestination(destination)})}`);return session;
}
