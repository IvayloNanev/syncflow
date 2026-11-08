import Link from "next/link";
import {sessionClient,sharedConfigured} from "../lib/supabase/server";
import styles from "./landing.module.css";

export const dynamic='force-dynamic';

export default async function Home() {
  const user=sharedConfigured()?(await (await sessionClient()).auth.getUser()).data.user:null;
  return (
    <div className={styles.page}>
      <a className={styles.skip} href="#main">Skip to content</a>
      <header className={styles.header}>
        <Link className={styles.brand} href="/" aria-label="SyncFlow home">Sync<span>Flow</span></Link>
        <Link className={styles.entry} href={user?"/coordinator":"/login"}>{user?"Open workspace":"Sign in"}</Link>
      </header>
      <main id="main" className={styles.hero}>
        <div className={styles.record} aria-hidden="true"><div /></div>
        <div className={styles.copy}>
          <p className={styles.eyebrow}>THE MUSIC LICENSING WORKSPACE</p>
          <h1>Music licensing.<br /><span>In sync.</span></h1>
          <p className={styles.description}>Turn client emails into organized briefs, clear follow-ups, and smoother internal reviews.</p>
        </div>
      </main>
      <footer className={styles.footer}><span>Less admin. More momentum.</span><span>SyncFlow · Ivaylo Nanev &amp; Mosiah James</span></footer>
    </div>
  );
}
