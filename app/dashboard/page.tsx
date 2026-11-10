import SiteHeader from '../../components/site-header';
import styles from './dashboard.module.css';
import ClientHistoryDashboard from '../../components/client-history-dashboard';
import {requireWorkspace} from '../../lib/supabase/access';
export const dynamic='force-dynamic';
export default async function Dashboard(){
 const session=await requireWorkspace('/dashboard');
 const metadata=session?.user.user_metadata;
 const displayName=[metadata?.username,metadata?.full_name,metadata?.name,session?.user.email?.split('@')[0]].find(value=>typeof value==='string'&&value.trim())?.trim()||'there';
 return <div className={`workspace-theme ${styles.page}`}><SiteHeader current="dashboard" email={session?.user.email}/><ClientHistoryDashboard displayName={displayName} key={session?.workspaceId} testWorkspace={session?.workspaceId==='b7a8e7df-ef85-4c35-a1ce-88ed575c713b'}/></div>;
}
