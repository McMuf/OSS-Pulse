"use client";

import Link from "next/link";
import { useSearchModal } from "@/components/SearchModal";

export function NavBar() {
  const { open } = useSearchModal();

  return (
    <nav className="border-b border-border px-6 py-3 flex items-center gap-6">
      <Link href="/" className="text-sm font-semibold text-accent shrink-0">
        OSS Pulse
      </Link>

      <button
        onClick={open}
        className="flex-1 max-w-md flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-1.5 text-sm text-foreground-muted hover:border-accent/50 transition-colors"
      >
        <span>⌕</span>
        <span className="flex-1 text-left">Search companies or tickers…</span>
        <kbd className="text-[10px] border border-border rounded px-1.5 py-0.5">⌘K</kbd>
      </button>

      <div className="flex gap-4 text-sm text-foreground-muted ml-auto">
        <Link href="/methodology" className="hover:text-foreground transition-colors">
          Methodology
        </Link>
        <Link href="/about" className="hover:text-foreground transition-colors">
          About
        </Link>
      </div>
    </nav>
  );
}
