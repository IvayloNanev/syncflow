import styles from './ai-progress.module.css';
export default function AIProgress({label='AI is preparing your response…'}:{label?:string}){return <div className={styles.wrap} role="status"><span>{label}</span><div className={styles.track} role="progressbar" aria-label={label}><span className={styles.sweep}/></div></div>;}
