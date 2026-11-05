import Link from "next/link";
export default function PageNavigation({ current }: { current: "home" | "coordinator" | "internal" }) {
 return <nav className="page-navigation" aria-label="Main navigation">
 <Link href="/" aria-current={current==="home"?"page":undefined}>Landing</Link>
 <Link href="/coordinator" aria-current={current==="coordinator"?"page":undefined}>Coordinator</Link>
 <Link href="/internal" aria-current={current==="internal"?"page":undefined}>Internal review</Link>
 </nav>;
}
