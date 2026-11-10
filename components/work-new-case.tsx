'use client';
import {useCallback} from 'react';
import {useRouter} from 'next/navigation';
import AnalysisWorkspace from './analysis-workspace';
import styles from '../app/work/work.module.css';
export default function WorkNewCase(){const router=useRouter();const saved=useCallback((id:string)=>router.replace(`/work/cases/${encodeURIComponent(id)}`),[router]);return <div className={styles.main}><div className={styles.title}><div><p className={styles.eyebrow}>NEW CASE</p><h1>Start a conversation</h1><p>Paste the client’s email. The case keeps the analysis and response together.</p></div></div><div className={styles.embedded}><AnalysisWorkspace shared mode='coordinator' onCaseSaved={saved}/></div></div>;}
