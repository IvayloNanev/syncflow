"use client";
import Link from "next/link";
import styles from "../app/landing.module.css";
type Page = "cases" | "dashboard" | "home" | "coordinator" | "internal" | "inquiries";
export default function PageNavigation({current}:{current:Page}){
 return <nav className="page-navigation" aria-label="Main navigation">
 <Link className={styles.entry} style={{background:"var(--sf-control-gold)",color:"#171a13",border:"1px solid #f3dfaa90",boxShadow:"inset 0 1px 0 #fff8"}} href="/dashboard" aria-current={current==="dashboard"?"page":undefined}>Workspace</Link>
 <Link className={styles.entry} style={{background:"var(--sf-control-gold)",color:"#171a13",border:"1px solid #f3dfaa90",boxShadow:"inset 0 1px 0 #fff8"}} href="/inquiries" aria-current={current==="inquiries"?"page":undefined}>New Inquiries</Link>
 <Link className={styles.entry} style={{background:"var(--sf-control-gold)",color:"#171a13",border:"1px solid #f3dfaa90",boxShadow:"inset 0 1px 0 #fff8"}} href="/cases" aria-current={current==="cases"?"page":undefined}>Cases</Link>
 </nav>;
}
