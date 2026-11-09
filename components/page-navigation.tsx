"use client";
import Link from "next/link";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

type Page = "cases" | "dashboard" | "home" | "coordinator" | "internal";
function Links({current,requestId}:{current:Page;requestId?:string|null}) {
 const suffix=requestId?`?request=${encodeURIComponent(requestId)}`:"";
 return <nav className="page-navigation" aria-label="Main navigation">
 <Link href="/dashboard" aria-current={current==="dashboard"?"page":undefined}>Daily briefing</Link>
 <Link href="/cases" aria-current={current==="cases"?"page":undefined}>Cases</Link>
 <Link href={`/coordinator${suffix}`} aria-current={current==="coordinator"?"page":undefined}>Coordinator</Link>
 <Link href="/internal" aria-current={current==="internal"?"page":undefined}>Internal review</Link>
 </nav>;
}
function RequestLinks({current}:{current:Page}){const query=useSearchParams();return <Links current={current} requestId={current==="home"?null:query.get("request")}/>;}
export default function PageNavigation({current}:{current:Page}){return <Suspense fallback={<Links current={current}/>}><RequestLinks current={current}/></Suspense>;}
