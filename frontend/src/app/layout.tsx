import type { Metadata } from "next";
import { IBM_Plex_Mono, Plus_Jakarta_Sans } from "next/font/google";
import { Suspense } from "react";
import { MarketLinesBackground } from "@/components/MarketLinesBackground";
import { NavBar } from "@/components/NavBar";
import { SearchModalProvider } from "@/components/SearchModal";
import { TickerStripLoader, TickerStripSkeleton } from "@/components/TickerStripLoader";
import "./globals.css";

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

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${jakarta.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <MarketLinesBackground />
        <div className="relative z-10 flex flex-col flex-1">
          <SearchModalProvider>
            <NavBar />
            <Suspense fallback={<TickerStripSkeleton />}>
              <TickerStripLoader />
            </Suspense>
            {children}
          </SearchModalProvider>
        </div>
      </body>
    </html>
  );
}
