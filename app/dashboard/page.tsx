import Link from 'next/link';
import AccountMenu from '../../components/account-menu';
import PageNavigation from '../../components/page-navigation';
import ClientHistoryDashboard from '../../components/client-history-dashboard';
import {requireWorkspace} from '../../lib/supabase/access';
export const dynamic='force-dynamic';
export default async function Dashboard(){
 const session=await requireWorkspace('/dashboard');
 return <div className="workspace-theme"><header className="portal-bar"><Link href="/">SyncFlow · Dashboard</Link><PageNavigation current="dashboard"/><AccountMenu email={session?.user.email}/></header><ClientHistoryDashboard/></div>;
}
