import type {Metadata} from 'next';
import Link from 'next/link';
import SiteHeader from '../../components/site-header';
import StartLiveDemo from '../../components/start-live-demo';
import styles from './demo.module.css';
export const metadata:Metadata={title:'Live AI demo · SyncFlow',description:'Try the full SyncFlow workspace with live agents and fictional cases. No account required.'};
export default function DemoPage(){return <div className={styles.page}><a className={styles.skip} href="#demo-main">Skip to demo</a><SiteHeader><nav className={styles.headerLinks} aria-label="Demo navigation"><Link href="/">Home</Link><Link className={styles.gold} href="/login">Sign in</Link></nav></SiteHeader><StartLiveDemo/></div>;}
