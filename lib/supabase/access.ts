import {workspaceDestination,loginDestination} from '../auth-destination.js';
import {cookies} from 'next/headers';
import {DEMO_COOKIE} from '../../server/demo-policy.js';
import {redirect} from 'next/navigation';
import {sharedConfigured,workspaceSession} from './server';
export async function requireWorkspace(destination='/coordinator'){
 if(!sharedConfigured())return null;
 const session=await workspaceSession();if(!session){if((await cookies()).has(DEMO_COOKIE))redirect('/demo?expired=1');redirect(loginDestination(destination));}
 if(!session.workspaceId)redirect(`/no-access?${new URLSearchParams({next:workspaceDestination(destination)})}`);return session;
}
