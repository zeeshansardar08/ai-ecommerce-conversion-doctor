"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CROSignalLogo } from "@/src/components/CROSignalLogo";

/* ───────────────── types ───────────────── */

type Metrics = {
  totalAudits: number;
  uniqueDomains: number;
  completed: number;
  totalLeads: number;
  conversionRate: number;
  failureRate: number;
  failed: number;
};

type TopDomain = { domain: string; count: number };

type TrendPoint = {
  date?: string;
  week?: string;
  audits: number;
  leads: number;
  failures: number;
};

type FeatureRequest = {
  id: string;
  created_at: string;
  type: string;
  email: string;
  store_url: string | null;
  report_id: string | null;
};

type OptimizationRequest = {
  id: string;
  created_at: string;
  name: string;
  email: string;
  store_url: string | null;
  monthly_traffic: string;
  revenue_range: string | null;
  report_id: string | null;
};

type AnalyticsPayload = {
  metrics: Metrics;
  topDomains: TopDomain[];
  dailyTrend: TrendPoint[];
  weeklyTrend: TrendPoint[];
};

type DataPayload = {
  featureRequests: FeatureRequest[];
  optimizationRequests: OptimizationRequest[];
};

type Tab = "overview" | "leads" | "requests";
type TrendMode = "daily" | "weekly";

/* ───────────────── SVG bar chart ───────────────── */

function MiniBarChart({
  data,
  labelKey,
  bars,
  height = 200,
}: {
  data: TrendPoint[];
  labelKey: "date" | "week";
  bars: { key: "audits" | "leads" | "failures"; color: string; label: string }[];
  height?: number;
}) {
  if (data.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-foreground/40">
        No data for this range.
      </p>
    );
  }

  const maxVal = Math.max(1, ...data.flatMap((d) => bars.map((b) => d[b.key])));
  const chartW = Math.max(data.length * 50, 400);
  const chartH = height - 30;
  const groupW = chartW / data.length;
  const barW = (groupW * 0.7) / bars.length;
  const pad = groupW * 0.15;

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${chartW} ${height}`}
        className="w-full"
        style={{ minWidth: data.length > 8 ? data.length * 50 : 400 }}
      >
        {/* grid */}
        {[0, 0.25, 0.5, 0.75, 1].map((f) => (
          <line
            key={f}
            x1={0}
            y1={chartH * (1 - f)}
            x2={chartW}
            y2={chartH * (1 - f)}
            stroke="var(--color-border)"
            strokeWidth="0.5"
            strokeDasharray={f > 0 && f < 1 ? "4 4" : undefined}
          />
        ))}

        {data.map((pt, i) =>
          bars.map((bar, bi) => {
            const v = pt[bar.key];
            const h = (v / maxVal) * chartH;
            const x = i * groupW + pad + bi * barW;
            return (
              <rect
                key={`${i}-${bi}`}
                x={x}
                y={chartH - h}
                width={barW}
                height={h}
                rx={2}
                fill={bar.color}
                opacity={0.85}
              >
                <title>
                  {bar.label}: {v} ({pt[labelKey]})
                </title>
              </rect>
            );
          })
        )}

        {/* x labels */}
        {data.map((pt, i) => {
          const label = pt[labelKey] ?? "";
          const short = labelKey === "date" ? label.slice(5) : label;
          return (
            <text
              key={i}
              x={i * groupW + groupW / 2}
              y={height - 4}
              textAnchor="middle"
              className="fill-foreground/40"
              style={{ fontSize: 9 }}
            >
              {short}
            </text>
          );
        })}
      </svg>

      {/* legend */}
      <div className="mt-3 flex flex-wrap gap-4">
        {bars.map((b) => (
          <span key={b.key} className="flex items-center gap-1.5 text-xs text-foreground/60">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: b.color }} />
            {b.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ───────────────── metric card ───────────────── */

function MetricCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-foreground/45">{label}</p>
      <p className="mt-2 text-3xl font-bold tabular-nums">{value}</p>
      {sub && <p className="mt-1 text-xs text-foreground/50">{sub}</p>}
    </div>
  );
}

/* ───────────────── main page ───────────────── */

export default function AdminPage() {
  const [password, setPassword] = useState("");
  const [authed, setAuthed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [analytics, setAnalytics] = useState<AnalyticsPayload | null>(null);
  const [featureRequests, setFeatureRequests] = useState<FeatureRequest[]>([]);
  const [optimizationRequests, setOptimizationRequests] = useState<
    OptimizationRequest[]
  >([]);

  const [tab, setTab] = useState<Tab>("overview");
  const [trendMode, setTrendMode] = useState<TrendMode>("daily");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  /* ── data fetching ── */

  const loadAnalytics = useCallback(async (from?: string, to?: string) => {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    const res = await fetch(`/api/admin/analytics?${params}`);
    if (!res.ok) throw new Error("Unauthorized");
    return (await res.json()) as AnalyticsPayload;
  }, []);

  const loadData = useCallback(async () => {
    const res = await fetch("/api/admin/data");
    if (!res.ok) throw new Error("Unauthorized");
    return (await res.json()) as DataPayload;
  }, []);

  const loadAll = useCallback(
    async (from?: string, to?: string) => {
      const [a, d] = await Promise.all([loadAnalytics(from, to), loadData()]);
      setAnalytics(a);
      setFeatureRequests(d.featureRequests || []);
      setOptimizationRequests(d.optimizationRequests || []);
    },
    [loadAnalytics, loadData]
  );

  useEffect(() => {
    loadAll()
      .then(() => setAuthed(true))
      .catch(() => setAuthed(false));
  }, [loadAll]);

  const applyDateFilter = async () => {
    try {
      const a = await loadAnalytics(dateFrom || undefined, dateTo || undefined);
      setAnalytics(a);
    } catch { /* ignore */ }
  };

  const clearDateFilter = async () => {
    setDateFrom("");
    setDateTo("");
    try {
      const a = await loadAnalytics();
      setAnalytics(a);
    } catch { /* ignore */ }
  };

  /* ── login ── */

  const submitPassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const p = await res.json().catch(() => null);
        throw new Error(p?.error || "Invalid password");
      }
      await loadAll();
      setAuthed(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const metrics = analytics?.metrics;
  const trendData = useMemo(
    () => (trendMode === "daily" ? analytics?.dailyTrend ?? [] : analytics?.weeklyTrend ?? []),
    [analytics, trendMode]
  );

  /* ────────────────────── login screen ────────────────────── */

  if (!authed) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <main className="mx-auto flex w-full max-w-md flex-col gap-6 px-6 py-16">
          <h1 className="text-2xl font-semibold">Admin Access</h1>
          <p className="text-sm text-foreground/60">Enter the admin password to view the dashboard.</p>
          <form onSubmit={submitPassword} className="space-y-4">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-2xl border border-border bg-surface-muted px-4 py-3 text-base outline-none transition focus:border-accent"
              required
            />
            {error ? <p className="text-sm text-red-400">{error}</p> : null}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl bg-accent px-6 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loading ? "Checking…" : "Unlock"}
            </button>
          </form>
        </main>
      </div>
    );
  }

  /* ────────────────────── dashboard ────────────────────── */

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-6 py-10">
        {/* header */}
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <CROSignalLogo size="sm" linkHome />
            <div className="h-8 w-px bg-border" />
            <div>
              <h1 className="text-2xl font-bold">Admin</h1>
              <p className="text-sm text-foreground/50">Founder analytics dashboard</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <a
              href="/api/admin/export?type=reports"
              className="rounded-xl border border-border px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-foreground/60 transition hover:border-accent hover:text-accent"
            >
              Export Reports CSV
            </a>
            <a
              href="/api/admin/export?type=leads"
              className="rounded-xl border border-border px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-foreground/60 transition hover:border-accent hover:text-accent"
            >
              Export Leads CSV
            </a>
          </div>
        </header>

        {/* tabs */}
        <nav className="flex gap-1 rounded-2xl border border-border bg-surface p-1">
          {([["overview", "Overview"], ["leads", "Leads & Requests"], ["requests", "Top Domains"]] as [Tab, string][]).map(
            ([key, label]) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`rounded-xl px-5 py-2.5 text-sm font-semibold transition ${
                  tab === key ? "bg-accent text-white" : "text-foreground/60 hover:text-foreground"
                }`}
              >
                {label}
              </button>
            )
          )}
        </nav>

        {/* ═══════════ OVERVIEW ═══════════ */}
        {tab === "overview" && (
          <>
            {/* date filter */}
            <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-surface p-4">
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.25em] text-foreground/45">From</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="rounded-xl border border-border bg-surface-muted px-3 py-2 text-sm outline-none transition focus:border-accent"
                />
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.25em] text-foreground/45">To</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="rounded-xl border border-border bg-surface-muted px-3 py-2 text-sm outline-none transition focus:border-accent"
                />
              </div>
              <button onClick={applyDateFilter} className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90">
                Apply
              </button>
              {(dateFrom || dateTo) && (
                <button onClick={clearDateFilter} className="rounded-xl border border-border px-4 py-2 text-sm font-semibold text-foreground/60 transition hover:text-foreground">
                  Clear
                </button>
              )}
            </div>

            {/* metric cards */}
            {metrics && (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <MetricCard label="Total Audits" value={metrics.totalAudits} />
                <MetricCard label="Unique Domains" value={metrics.uniqueDomains} />
                <MetricCard label="Reports Completed" value={metrics.completed} sub={`${metrics.failed} failed`} />
                <MetricCard label="Leads Captured" value={metrics.totalLeads} />
                <MetricCard label="Conversion Rate" value={`${metrics.conversionRate}%`} sub="Audit → Lead" />
                <MetricCard label="Failure Rate" value={`${metrics.failureRate}%`} sub={`${metrics.failed} of ${metrics.totalAudits}`} />
              </div>
            )}

            {/* trend chart */}
            <section className="rounded-2xl border border-border bg-surface p-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold">Trend</h2>
                <div className="flex gap-1 rounded-xl border border-border p-0.5">
                  {(["daily", "weekly"] as TrendMode[]).map((m) => (
                    <button
                      key={m}
                      onClick={() => setTrendMode(m)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition ${
                        trendMode === m ? "bg-accent text-white" : "text-foreground/50 hover:text-foreground"
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
              <MiniBarChart
                data={trendData}
                labelKey={trendMode === "daily" ? "date" : "week"}
                bars={[
                  { key: "audits", color: "var(--color-accent)", label: "Audits" },
                  { key: "leads", color: "#22c55e", label: "Leads" },
                  { key: "failures", color: "#ef4444", label: "Failures" },
                ]}
              />
            </section>
          </>
        )}

        {/* ═══════════ LEADS & REQUESTS ═══════════ */}
        {tab === "leads" && (
          <>
            <section className="rounded-2xl border border-border bg-surface p-6">
              <h2 className="text-lg font-semibold">
                Optimization Requests{" "}
                <span className="text-sm font-normal text-foreground/40">({optimizationRequests.length})</span>
              </h2>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-foreground/50">
                    <tr>
                      <th className="whitespace-nowrap py-2 pr-4">Name</th>
                      <th className="whitespace-nowrap py-2 pr-4">Email</th>
                      <th className="whitespace-nowrap py-2 pr-4">Store URL</th>
                      <th className="whitespace-nowrap py-2 pr-4">Traffic</th>
                      <th className="whitespace-nowrap py-2 pr-4">Revenue</th>
                      <th className="whitespace-nowrap py-2 pr-4">Created</th>
                      <th className="whitespace-nowrap py-2">Report</th>
                    </tr>
                  </thead>
                  <tbody>
                    {optimizationRequests.length === 0 && (
                      <tr><td colSpan={7} className="py-8 text-center text-foreground/40">No optimization requests yet.</td></tr>
                    )}
                    {optimizationRequests.map((row) => (
                      <tr key={row.id} className="border-t border-border">
                        <td className="whitespace-nowrap py-3 pr-4 font-semibold">{row.name}</td>
                        <td className="whitespace-nowrap py-3 pr-4">{row.email}</td>
                        <td className="whitespace-nowrap py-3 pr-4 max-w-[200px] truncate">{row.store_url || "—"}</td>
                        <td className="whitespace-nowrap py-3 pr-4">{row.monthly_traffic}</td>
                        <td className="whitespace-nowrap py-3 pr-4">{row.revenue_range || "—"}</td>
                        <td className="whitespace-nowrap py-3 pr-4 tabular-nums">{new Date(row.created_at).toLocaleDateString()}</td>
                        <td className="whitespace-nowrap py-3">
                          {row.report_id ? <a href={`/audit/${row.report_id}`} className="text-accent hover:underline">View</a> : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="rounded-2xl border border-border bg-surface p-6">
              <h2 className="text-lg font-semibold">
                Feature Requests{" "}
                <span className="text-sm font-normal text-foreground/40">({featureRequests.length})</span>
              </h2>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-foreground/50">
                    <tr>
                      <th className="whitespace-nowrap py-2 pr-4">Type</th>
                      <th className="whitespace-nowrap py-2 pr-4">Email</th>
                      <th className="whitespace-nowrap py-2 pr-4">Store URL</th>
                      <th className="whitespace-nowrap py-2 pr-4">Created</th>
                      <th className="whitespace-nowrap py-2">Report</th>
                    </tr>
                  </thead>
                  <tbody>
                    {featureRequests.length === 0 && (
                      <tr><td colSpan={5} className="py-8 text-center text-foreground/40">No feature requests yet.</td></tr>
                    )}
                    {featureRequests.map((row) => (
                      <tr key={row.id} className="border-t border-border">
                        <td className="whitespace-nowrap py-3 pr-4">
                          <span className="rounded-lg bg-accent/10 px-2.5 py-1 text-xs font-semibold text-accent">{row.type}</span>
                        </td>
                        <td className="whitespace-nowrap py-3 pr-4">{row.email}</td>
                        <td className="whitespace-nowrap py-3 pr-4 max-w-[200px] truncate">{row.store_url || "—"}</td>
                        <td className="whitespace-nowrap py-3 pr-4 tabular-nums">{new Date(row.created_at).toLocaleDateString()}</td>
                        <td className="whitespace-nowrap py-3">
                          {row.report_id ? <a href={`/audit/${row.report_id}`} className="text-accent hover:underline">View</a> : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}

        {/* ═══════════ TOP DOMAINS ═══════════ */}
        {tab === "requests" && (
          <section className="rounded-2xl border border-border bg-surface p-6">
            <h2 className="text-lg font-semibold">Top Requested Domains</h2>
            <div className="mt-4 space-y-2">
              {analytics?.topDomains.length === 0 && (
                <p className="py-8 text-center text-sm text-foreground/40">No audits yet.</p>
              )}
              {analytics?.topDomains.map((d, i) => {
                const maxCount = analytics.topDomains[0]?.count ?? 1;
                const pct = Math.round((d.count / maxCount) * 100);
                return (
                  <div key={d.domain} className="flex items-center gap-3">
                    <span className="w-6 text-right text-xs font-bold text-foreground/40 tabular-nums">{i + 1}</span>
                    <div className="flex-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{d.domain}</span>
                        <span className="text-foreground/50 tabular-nums">{d.count} audit{d.count !== 1 ? "s" : ""}</span>
                      </div>
                      <div className="mt-1 h-1.5 w-full rounded-full bg-border">
                        <div className="h-1.5 rounded-full bg-accent transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
