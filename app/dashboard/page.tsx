import Link from 'next/link';
import AccountMenu from '../../components/account-menu';
import styles from './dashboard.module.css';
import ClientHistoryDashboard from '../../components/client-history-dashboard';
import {requireWorkspace} from '../../lib/supabase/access';
export const dynamic='force-dynamic';
export default async function Dashboard(){
 const session=await requireWorkspace('/dashboard');
 return <div className={`workspace-theme ${styles.page}`}><header className={styles.header}><Link href="/" className={styles.brand} aria-label="SyncFlow home">Sync<span>Flow</span></Link><nav className={styles.navigation} aria-label="Workspace"><Link href="/coordinator">Coordinator</Link><Link href="/dashboard" aria-current="page">Clients</Link><Link href="/internal">Internal review</Link><Link href="/team">Team</Link></nav><AccountMenu email={session?.user.email}/></header><ClientHistoryDashboard key={session?.workspaceId} testWorkspace={session?.workspaceId==='b7a8e7df-ef85-4c35-a1ce-88ed575c713b'}/></div>;
}
