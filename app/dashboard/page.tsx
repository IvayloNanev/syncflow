import WorkspacePicker from '../../components/workspace-picker';
import Link from 'next/link';
import AccountMenu from '../../components/account-menu';
import styles from './dashboard.module.css';
import ClientHistoryDashboard from '../../components/client-history-dashboard';
import {requireWorkspace} from '../../lib/supabase/access';
export const dynamic='force-dynamic';
export default async function Dashboard(){
 const session=await requireWorkspace('/dashboard');
 return <div className={`workspace-theme ${styles.page}`}><header className={styles.header}><Link href="/" className={styles.brand} aria-label="SyncFlow home">Sync<span>Flow</span></Link><nav className={styles.navigation} aria-label="Workspace"><Link href="/dashboard" aria-current="page">Dashboard</Link><Link href="/coordinator">Coordinator</Link><Link href="/internal">Internal review</Link><Link href="/team">Team</Link></nav><AccountMenu email={session?.user.email}/></header><WorkspacePicker selected={session?.workspaceId}/><ClientHistoryDashboard key={session?.workspaceId}/></div>;
}
