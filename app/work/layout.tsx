import type {ReactNode} from 'react';
import Link from 'next/link';
import {requireWorkspace} from '../../lib/supabase/access';
import WorkNavigation from '../../components/work-navigation';
import AccountMenu from '../../components/account-menu';
import styles from './work.module.css';
export default async function WorkLayout({children}:{children:ReactNode}){
 const session=await requireWorkspace('/work');
 return <div className={`workspace-theme ${styles.shell}`}><header className={styles.header}><Link className={styles.brand} href='/work'>Sync<span>Flow</span></Link><WorkNavigation/><div className={styles.account}><AccountMenu email={session?.user.email}/></div></header><div className={styles.experiment}><span>Case workspace · Preview</span></div>{children}</div>;
}
