import EmailForwarding from '../../../components/email-forwarding';
import Link from 'next/link';
import styles from '../work.module.css';
export default function Inbox(){return <main className={styles.main}><div className={styles.title}><div><p className={styles.eyebrow}>NEW CONVERSATIONS</p><h1>Inbox</h1><p>Incoming emails become cases. Open one to continue the conversation.</p></div><Link className='primary-button' href='/work/new'>Paste an email</Link></div><EmailForwarding caseWorkspace/></main>;}
