import Link from 'next/link';
import type {ReactNode} from 'react';
import PageNavigation from './page-navigation';
import AccountMenu from './account-menu';
import styles from './site-header.module.css';

type Props = {current?: 'cases' | 'dashboard' | 'coordinator' | 'internal' | 'inquiries'; email?: string; children?: ReactNode};
export default function SiteHeader({current,email,children}:Props) {
 return <header className={`${styles.header} ${current?styles.signedIn:''}`}>
  <Link className={styles.brand} href="/" aria-label="SyncFlow home">Sync<span>Flow</span></Link>
  <div className={styles.actions}>{current ? <><PageNavigation current={current} email={email}/><AccountMenu email={email}/></> : children}</div>
 </header>;
}
