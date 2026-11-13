import SiteHeader from '../components/site-header';
import Link from "next/link";
import styles from "./landing.module.css";

export const dynamic='force-dynamic';

export default async function Home() {
  return (
    <div className={styles.page}>
      <a className={styles.skip} href="#main">Skip to content</a>
      <SiteHeader>
        <nav className={styles.menu} aria-label="Landing page navigation"><Link className={styles.demoLink} href="/demo">Explore demo</Link><Link className={styles.entry} href="/login">Login</Link><Link className={styles.entry} href="/login?mode=signup">Sign up</Link></nav>
      </SiteHeader>
      <main id="main" className={styles.hero}>
        <div className={styles.record} aria-hidden="true"><div /></div>
        <div className={styles.copy}>
          <p className={styles.eyebrow}>THE MUSIC LICENSING WORKSPACE</p>
          <h1>Music licensing.<br /><span>In sync.</span></h1>
          <p className={styles.description}>Turn client emails into organized briefs, clear follow-ups, and smoother internal reviews.</p>
          <div className={styles.heroActions}><Link className={styles.entry} href="/demo">Try the interactive demo <span aria-hidden="true">↗</span></Link><p>No sign-in needed. Explore with a fictional case.</p></div>
        </div>
      </main>
      <footer className={styles.footer}><span>Less admin. More momentum.</span><span>SyncFlow · Ivaylo Nanev &amp; Mosiah James</span></footer>
    </div>
  );
}
