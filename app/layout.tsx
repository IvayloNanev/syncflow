import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SyncFlow · Music licensing requests",
  description:
    "An AI-assisted workspace for sync licensing request intake and review.",
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
