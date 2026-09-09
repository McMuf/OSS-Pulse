import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "OSS Pulse",
  description:
    "Open-source developer-activity signal for public companies — a research/engineering demo, not investment advice.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
    >
      <body className="min-h-full flex flex-col">
        <div className="border-b border-border bg-surface px-6 py-3 text-sm text-foreground-muted">
          Research/engineering demo, not investment advice. OSS activity
          metrics are noisy and gameable; scores shown here are historical
          context, not predictions.
        </div>
        <nav className="border-b border-border px-6 py-3 flex items-center gap-6">
          <Link href="/" className="text-sm font-medium text-foreground">
            OSS Pulse
          </Link>
          <div className="flex gap-4 text-sm text-foreground-muted">
            <Link href="/methodology" className="hover:text-foreground transition-colors">
              Methodology
            </Link>
            <Link href="/about" className="hover:text-foreground transition-colors">
              About
            </Link>
          </div>
        </nav>
        {children}
      </body>
    </html>
  );
}
