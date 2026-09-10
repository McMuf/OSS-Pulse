import { DashboardSidebar } from "@/components/DashboardSidebar";
import { Leaderboard } from "@/components/Leaderboard";
import { getApiBase } from "@/lib/apiUrl";
import { fetchWithTimeout } from "@/lib/fetchWithTimeout";
import type { CompanySummary } from "@/lib/types";

async function getCompanies(): Promise<CompanySummary[] | null> {
  try {
    const res = await fetchWithTimeout(`${getApiBase()}/companies`, { cache: "no-store" });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export default async function Home() {
  const companies = await getCompanies();

  return (
    <div className="flex flex-col flex-1">
      <main className="flex-1 w-full max-w-6xl mx-auto px-6 py-10">
        <h1 className="text-2xl font-semibold text-foreground tracking-tight">
          OSS Pulse
        </h1>
        <p className="mt-2 text-foreground-muted max-w-2xl">
          Open-source developer-activity health, tracked per company and
          checked against forward stock returns.
        </p>

        {companies === null && (
          <div className="mt-10 rounded-sm border border-border bg-surface px-5 py-6 text-foreground-muted text-sm">
            Couldn&apos;t reach the backend at{" "}
            <code className="font-mono">{getApiBase()}</code>
            . Start it with{" "}
            <code className="font-mono">uvicorn oss_pulse.api.main:app</code>{" "}
            from <code className="font-mono">backend/</code>.
          </div>
        )}

        {companies && (
          <div className="mt-8 grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6 items-start">
            <div>
              <Leaderboard companies={companies} />
            </div>
            <DashboardSidebar companies={companies} />
          </div>
        )}
      </main>
    </div>
  );
}
