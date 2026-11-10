"use client";
import Link from "next/link";
import {useEffect,useRef} from 'react';
import AccountMenu from './account-menu';
import styles from "../app/landing.module.css";
type Page = "cases" | "dashboard" | "home" | "coordinator" | "internal" | "inquiries";
const pages=[{id:'dashboard',href:'/dashboard',label:'Workspace'},{id:'inquiries',href:'/inquiries',label:'New Inquiries'},{id:'cases',href:'/cases',label:'Cases'}];
export default function PageNavigation({current,email}:{current:Page;email?:string}){
 const menu=useRef<HTMLDetailsElement>(null);
 useEffect(()=>{const close=(event:PointerEvent)=>{if(menu.current&&!menu.current.contains(event.target as Node))menu.current.open=false;};const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'&&menu.current?.open){menu.current.open=false;menu.current.querySelector('summary')?.focus();}};document.addEventListener('pointerdown',close);document.addEventListener('keydown',escape);return()=>{document.removeEventListener('pointerdown',close);document.removeEventListener('keydown',escape);};},[]);
 const links=pages.map(page=><Link key={page.id} className={styles.entry} href={page.href} aria-current={current===page.id?'page':undefined}>{page.label}</Link>);
 return <div className="navigation-shell"><nav className="page-navigation desktop-navigation" aria-label="Main navigation">{links}</nav><details className="mobile-navigation" ref={menu}><summary>Menu <span aria-hidden="true">▾</span></summary><div className="mobile-menu-panel"><p>{pages.find(page=>page.id===current)?.label||(current==='internal'?'Internal Review':'Coordinator')}</p><nav className="page-navigation" aria-label="Mobile navigation" onClick={event=>{if(event.target instanceof Element&&event.target.closest('a')&&!event.defaultPrevented&&menu.current)menu.current.open=false;}}>{links}</nav><AccountMenu email={email}/></div></details></div>;
}
