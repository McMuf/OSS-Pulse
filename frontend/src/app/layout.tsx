import type { Metadata } from "next";
import { IBM_Plex_Mono, Plus_Jakarta_Sans } from "next/font/google";
import { MarketLinesBackground } from "@/components/MarketLinesBackground";
import { NavBar } from "@/components/NavBar";
import { SearchModalProvider } from "@/components/SearchModal";
import { TickerStrip } from "@/components/TickerStrip";
import type { PriceQuote } from "@/lib/types";
import "./globals.css";

async function getPrices(): Promise<PriceQuote[]> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
  try {
    const res = await fetch(`${apiUrl}/prices`, { cache: "no-store" });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  weight: ["400", "500", "600"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "OSS Pulse",
  description:
    "Open-source developer-activity signal for public companies. A research and engineering demo, not investment advice.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const prices = await getPrices();

  return (
    <html
      lang="en"
      className={`${jakarta.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <MarketLinesBackground />
        <div className="relative z-10 flex flex-col flex-1">
          <SearchModalProvider>
            <div className="border-b border-border bg-surface px-6 py-3 text-sm text-foreground-muted">
              Research/engineering demo, not investment advice. OSS activity
              metrics are noisy and gameable; scores shown here are historical
              context, not predictions.
            </div>
            <NavBar />
            <TickerStrip quotes={prices} />
            {children}
          </SearchModalProvider>
        </div>
      </body>
    </html>
  );
}
