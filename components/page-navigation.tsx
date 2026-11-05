import Link from "next/link";

export default function PageNavigation({ current }: { current: "home" | "customer" | "internal" }) {
  return <nav className="page-navigation" aria-label="Main navigation">
    <Link href="/" aria-current={current === "home" ? "page" : undefined}>Home</Link>
    <Link href="/customer" aria-current={current === "customer" ? "page" : undefined}>Customer</Link>
    <Link href="/internal" aria-current={current === "internal" ? "page" : undefined}>Internal</Link>
  </nav>;
}
