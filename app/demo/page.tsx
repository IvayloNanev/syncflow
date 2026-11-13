import type {Metadata} from 'next';
import Link from 'next/link';
import ProductDemo from '../../components/product-demo';
import styles from './demo.module.css';

export const metadata:Metadata={
 title:'Explore the demo · SyncFlow',
 description:'Explore a fictional licensing request through Daily Brief, Coordinator and Internal Review. No sign-in needed.',
};

export default function DemoPage(){
 return <div className={styles.page}>
  <a className={styles.skip} href="#demo-main">Skip to demo</a>
  <ProductDemo/>
  <footer className={styles.footer}>SyncFlow · Ivaylo Nanev &amp; Mosiah James <Link href="/login?mode=signup">Create an account</Link></footer>
 </div>;
}
