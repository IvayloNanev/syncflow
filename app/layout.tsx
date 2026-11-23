import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://syncflow-one.vercel.app"),
  title: "SyncFlow · Music licensing requests",
  description:
    "An AI-assisted workspace for sync licensing request intake and review.",
  openGraph: {
    type: "website",
    url: "https://syncflow-one.vercel.app",
    siteName: "SyncFlow",
    title: "SyncFlow · Music licensing, in sync",
    description:
      "Turn client emails into organized cases, clear follow-ups, and smoother internal reviews.",
    images: [{
      url: "/syncflow-preview.png",
      width: 2940,
      height: 1700,
      alt: "SyncFlow Coordinator reviewing correspondence and missing licensing details in a synthetic test case",
    }],
  },
  twitter: {
    card: "summary_large_image",
    title: "SyncFlow · Music licensing, in sync",
    description:
      "Turn client emails into organized cases, clear follow-ups, and smoother internal reviews.",
    images: ["/syncflow-preview.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
