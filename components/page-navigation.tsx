"use client";
import Link from "next/link";
type Page = "cases" | "dashboard" | "home" | "coordinator" | "internal";
export default function PageNavigation({current}:{current:Page}){
 return <nav className="page-navigation" aria-label="Main navigation">
 <Link href="/dashboard" aria-current={current==="dashboard"?"page":undefined}>Daily briefing</Link>
 <Link href="/cases" aria-current={["cases","coordinator","internal"].includes(current)?"page":undefined}>Cases</Link>
 </nav>;
}
