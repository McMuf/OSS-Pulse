"use client";

import { useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { getApiBaseClient } from "@/lib/apiUrl";
import { tickerHue } from "@/lib/color";
import type { CompanySummary } from "@/lib/types";

type FilterKey = "all" | "tier1" | "tier2" | "delisted";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "tier1", label: "Tier 1" },
  { key: "tier2", label: "Tier 2" },
  { key: "delisted", label: "Delisted" },
];

function matchesFilter(c: CompanySummary, filter: FilterKey): boolean {
  if (filter === "all") return true;
  if (filter === "delisted") return c.delisted;
  if (filter === "tier1") return c.tier === 1;
  return c.tier === 2;
}

const SearchModalContext = createContext<{ open: () => void } | null>(null);

export function useSearchModal() {
  const ctx = useContext(SearchModalContext);
  if (!ctx) throw new Error("useSearchModal must be used within SearchModalProvider");
  return ctx;
}

export function SearchModalProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [companies, setCompanies] = useState<CompanySummary[] | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const open = () => setIsOpen(true);

  useEffect(() => {
    if (!isOpen || companies !== null) return;
    fetch(`${getApiBaseClient()}/companies`, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setCompanies(data))
      .catch(() => setCompanies([]));
  }, [isOpen, companies]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 0);
    } else {
      setQuery("");
      setFilter("all");
      setActiveIndex(0);
    }
  }, [isOpen]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      } else if (e.key === "Escape") {
        setIsOpen(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const results = useMemo(() => {
    if (!companies) return [];
    const q = query.trim().toLowerCase();
    return companies
      .filter((c) => matchesFilter(c, filter))
      .filter((c) => !q || c.name.toLowerCase().includes(q) || c.ticker.toLowerCase().includes(q))
      .sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
  }, [companies, query, filter]);

  function select(c: CompanySummary) {
    setIsOpen(false);
    router.push(`/companies/${c.ticker}`);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && results[activeIndex]) {
      select(results[activeIndex]);
    }
  }

  return (
    <SearchModalContext.Provider value={{ open }}>
      {children}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-start justify-center pt-24 px-4"
          onClick={() => setIsOpen(false)}
        >
          <div
            className="w-full max-w-xl rounded-sm border border-border bg-surface shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 border-b border-border px-4 py-3">
              <span className="text-foreground-muted">⌕</span>
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActiveIndex(0);
                }}
                onKeyDown={onKeyDown}
                placeholder="Search companies or tickers…"
                className="flex-1 bg-transparent text-foreground placeholder:text-foreground-muted focus:outline-none"
              />
              <kbd className="text-[10px] text-foreground-muted border border-border rounded px-1.5 py-0.5">
                Esc
              </kbd>
            </div>

            <div className="flex gap-2 px-4 py-2 border-b border-border">
              {FILTERS.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className={`text-xs rounded-full px-3 py-1 border transition-colors ${
                    filter === f.key
                      ? "border-accent text-accent"
                      : "border-border text-foreground-muted hover:text-foreground"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className="max-h-96 overflow-y-auto">
              {companies === null && (
                <div className="px-4 py-6 text-sm text-foreground-muted">Loading…</div>
              )}
              {companies !== null && results.length === 0 && (
                <div className="px-4 py-6 text-sm text-foreground-muted">No matches.</div>
              )}
              {results.map((c, i) => (
                <button
                  key={c.ticker}
                  onClick={() => select(c)}
                  onMouseEnter={() => setActiveIndex(i)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                    i === activeIndex ? "bg-surface-raised" : ""
                  }`}
                >
                  <div
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-medium text-white"
                    style={{ backgroundColor: `hsl(${tickerHue(c.ticker)}, 45%, 32%)` }}
                  >
                    {c.name.charAt(0)}
                  </div>
                  <span className="font-mono text-sm text-accent w-14 shrink-0">{c.ticker}</span>
                  <span className="text-sm text-foreground flex-1 truncate">{c.name}</span>
                  <span className="text-xs rounded-full border border-border px-2 py-0.5 text-foreground-muted shrink-0">
                    {c.delisted ? "Delisted" : `Tier ${c.tier}`}
                  </span>
                  <span className="font-mono text-sm text-foreground-muted w-12 text-right shrink-0">
                    {c.score?.toFixed(1) ?? "—"}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </SearchModalContext.Provider>
  );
}
