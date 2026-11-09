import SiteHeader from '../../components/site-header';
import styles from './dashboard.module.css';
import ClientHistoryDashboard from '../../components/client-history-dashboard';
import {storageClient} from '../../lib/supabase/server';
import {requireWorkspace} from '../../lib/supabase/access';
export const dynamic='force-dynamic';
export default async function Dashboard(){
 const session=await requireWorkspace('/dashboard');
 let workspaces:{id:string;name:string}[]=[];
 if(session){const client=storageClient();const {data:members}=await client.from('syncflow_members').select('workspace_id').eq('user_id',session.user.id);if(members?.length){const {data}=await client.from('syncflow_workspaces').select('id,name').in('id',members.map(m=>m.workspace_id)).order('created_at');workspaces=data||[];}}
 return <div className={`workspace-theme ${styles.page}`}><SiteHeader current="dashboard" email={session?.user.email}/>{workspaces.length>1?<form action="/workspace" method="post" className="workspace-picker"><label htmlFor="active-workspace">Workspace</label><select id="active-workspace" name="workspace" defaultValue={session?.workspaceId}>{workspaces.map(workspace=><option value={workspace.id} key={workspace.id}>{workspace.name==='SyncFlow Test · Fictional Clients'?'Archive':workspace.name}</option>)}</select><button className="secondary-button" type="submit">Open workspace</button></form>:null}<ClientHistoryDashboard key={session?.workspaceId} testWorkspace={session?.workspaceId==='b7a8e7df-ef85-4c35-a1ce-88ed575c713b'}/></div>;
}
