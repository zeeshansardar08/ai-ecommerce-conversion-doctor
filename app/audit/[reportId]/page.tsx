"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

type AuditStatus = "queued" | "running" | "done" | "failed";

type ReportResponse = {
  status: AuditStatus;
  error?: string | null;
  report?: AuditReport | null;
  leadCaptured?: boolean;
  url?: string;
  pageType?: string;
};

type AuditReport = {
  overall_score: number;
  category_scores: {
    cro: number;
    trust: number;
    copy: number;
    mobile_ux: number;
    performance_basics: number;
    seo_basics: number;
  };
  top_fixes: {
    title: string;
    why_it_matters: string;
    how_to_fix: string;
    estimated_effort: "S" | "M" | "L";
  }[];
  findings: {
    id: string;
    title: string;
    category: "CRO" | "Trust" | "Copy" | "Mobile UX" | "Performance" | "SEO";
    severity: "High" | "Medium" | "Low";
    impact: "High" | "Medium" | "Low";
    evidence: string;
    recommendation: string;
    estimated_effort: "S" | "M" | "L";
  }[];
};

const categoryFilters = [
  "All",
  "CRO",
  "Trust",
  "Copy",
  "Mobile UX",
  "Performance",
  "SEO",
] as const;

const severityColors: Record<string, string> = {
  High: "bg-red-100 text-red-700",
  Medium: "bg-amber-100 text-amber-700",
  Low: "bg-emerald-100 text-emerald-700",
};

export default function AuditPage() {
  const params = useParams();
  const reportId = typeof params.reportId === "string" ? params.reportId : "";
  const [status, setStatus] = useState<AuditStatus>("queued");
  const [report, setReport] = useState<AuditReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [leadCaptured, setLeadCaptured] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [pageType, setPageType] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<
    (typeof categoryFilters)[number]
  >("All");
  const [showLeadModal, setShowLeadModal] = useState(false);
  const [leadEmail, setLeadEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [leadError, setLeadError] = useState<string | null>(null);
  const [leadSubmitting, setLeadSubmitting] = useState(false);

  const fetchStatus = useCallback(async () => {
    if (!reportId) {
      return;
    }
    try {
      const response = await fetch(`/api/audit/${reportId}`, {
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error("Unable to fetch report status.");
      }
      const payload = (await response.json()) as ReportResponse;
      setStatus(payload.status);
      setError(payload.error || null);
      setReport(payload.report || null);
      setLeadCaptured(Boolean(payload.leadCaptured));
      setUrl(payload.url || null);
      setPageType(payload.pageType || null);
      if (payload.status === "done" && !payload.leadCaptured) {
        setShowLeadModal(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load report.");
    }
  }, [reportId]);

  useEffect(() => {
    let isMounted = true;
    const poll = async () => {
      if (!isMounted) return;
      await fetchStatus();
    };

    if (reportId) {
      poll();
    }
    const interval = setInterval(() => {
      if (!reportId || status === "done" || status === "failed") {
        return;
      }
      poll();
    }, 2000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [fetchStatus, status, reportId]);

  const filteredFindings = useMemo(() => {
    if (!report?.findings) {
      return [];
    }
    if (selectedCategory === "All") {
      return report.findings;
    }
    return report.findings.filter(
      (finding) => finding.category === selectedCategory
    );
  }, [report, selectedCategory]);

  const submitLead = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLeadError(null);

    if (!reportId) {
      setLeadError("Missing report id.");
      return;
    }

    if (!leadEmail) {
      setLeadError("Please enter your email.");
      return;
    }

    if (!consent) {
      setLeadError("Please agree to receive the report.");
      return;
    }

    setLeadSubmitting(true);
    try {
      const response = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportId,
          email: leadEmail.trim(),
          consent,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || "Unable to save lead.");
      }

      setShowLeadModal(false);
      setLeadCaptured(true);
      await fetchStatus();
    } catch (err) {
      setLeadError(err instanceof Error ? err.message : "Unable to save lead.");
    } finally {
      setLeadSubmitting(false);
    }
  };

  const statusLabel = {
    queued: "Queued",
    running: "Running",
    done: "Complete",
    failed: "Failed",
  }[status];

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 grid-glow" />
      <div className="pointer-events-none absolute inset-0 grain" />

      <main className="relative z-10 mx-auto flex w-full max-w-5xl flex-col gap-10 px-6 pb-20 pt-10">
        <section className="animate-rise rounded-[28px] border border-border bg-surface p-6 shadow-[0_20px_60px_-45px_rgba(15,17,21,0.5)]">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-foreground/60">
                Audit Status
              </p>
              <h1 className="text-2xl font-semibold">{statusLabel}</h1>
              <p className="text-sm text-foreground/60">
                {url ? url : "Preparing report"}
              </p>
            </div>
            <div className="rounded-full border border-border px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em]">
              {pageType ? `${pageType} page` : "Analyzing"}
            </div>
          </div>
          <div className="mt-6 grid gap-3 md:grid-cols-4">
            {["queued", "running", "done"].map((step, index) => (
              <div
                key={step}
                className={`rounded-2xl border px-4 py-3 text-sm font-semibold uppercase tracking-[0.25em] ${
                  status === "failed"
                    ? "border-red-200 bg-red-50 text-red-600"
                    : status === step || (index < 2 && status === "done")
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-border text-foreground/60"
                }`}
              >
                {step}
              </div>
            ))}
            <div
              className={`rounded-2xl border px-4 py-3 text-sm font-semibold uppercase tracking-[0.25em] ${
                status === "failed"
                  ? "border-red-200 bg-red-50 text-red-600"
                  : "border-border text-foreground/60"
              }`}
            >
              {status === "failed" ? "failed" : "report"}
            </div>
          </div>
          {status === "failed" ? (
            <p className="mt-4 text-sm text-red-600">
              {error || "Audit failed. Please try again."}
            </p>
          ) : null}
        </section>

        {status !== "done" ? (
          <section className="rounded-[28px] border border-border bg-surface p-8 text-center">
            <p className="text-lg font-semibold">Generating your CRO report...</p>
            <p className="mt-2 text-sm text-foreground/60">
              We are collecting signals, analyzing copy, and scoring trust.
            </p>
          </section>
        ) : null}

        {status === "done" && report ? (
          <section className="space-y-8">
            <div
              className={`relative rounded-[28px] border border-border bg-surface p-8 ${
                leadCaptured ? "" : "opacity-60"
              }`}
            >
              {!leadCaptured ? (
                <div className="absolute inset-0 z-10 flex items-center justify-center rounded-[28px] bg-background/60 backdrop-blur">
                  <div className="rounded-3xl border border-border bg-surface px-6 py-4 text-center shadow-lg">
                    <p className="text-sm font-semibold uppercase tracking-[0.3em] text-accent">
                      Unlock the report
                    </p>
                    <p className="mt-2 text-sm text-foreground/60">
                      Share your email to see the full findings.
                    </p>
                  </div>
                </div>
              ) : null}

              <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.35em] text-foreground/60">
                    Overall Score
                  </p>
                  <p className="text-4xl font-semibold text-accent">
                    {report.overall_score}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                  {Object.entries(report.category_scores).map(
                    ([key, value]) => (
                      <div
                        key={key}
                        className="rounded-2xl border border-border bg-surface-muted px-4 py-3"
                      >
                        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-foreground/60">
                          {key.replace("_", " ")}
                        </p>
                        <p className="text-lg font-semibold">{value}</p>
                      </div>
                    )
                  )}
                </div>
              </div>
            </div>

            <div
              className={`grid gap-6 lg:grid-cols-[1fr_1.2fr] ${
                leadCaptured ? "" : "opacity-60"
              }`}
            >
              <div className="rounded-[28px] border border-border bg-surface p-6">
                <h2 className="text-lg font-semibold">Top 3 Fixes</h2>
                <div className="mt-4 space-y-4">
                  {report.top_fixes.map((fix) => (
                    <div key={fix.title} className="rounded-2xl bg-surface-muted p-4">
                      <p className="text-sm font-semibold">{fix.title}</p>
                      <p className="mt-2 text-xs text-foreground/60">
                        {fix.why_it_matters}
                      </p>
                      <p className="mt-2 text-xs text-foreground/70">
                        {fix.how_to_fix}
                      </p>
                      <span className="mt-3 inline-flex rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold text-accent">
                        Effort {fix.estimated_effort}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[28px] border border-border bg-surface p-6">
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-lg font-semibold">Findings</h2>
                  <div className="flex flex-wrap gap-2">
                    {categoryFilters.map((category) => (
                      <button
                        key={category}
                        onClick={() => setSelectedCategory(category)}
                        className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] transition ${
                          selectedCategory === category
                            ? "border-accent bg-accent/10 text-accent"
                            : "border-border text-foreground/60 hover:border-accent"
                        }`}
                      >
                        {category}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-4 space-y-4">
                  {filteredFindings.map((finding) => (
                    <div
                      key={finding.id}
                      className="rounded-2xl border border-border bg-surface-muted p-4"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold">{finding.title}</p>
                        <span
                          className={`rounded-full px-2 py-1 text-xs font-semibold ${
                            severityColors[finding.severity]
                          }`}
                        >
                          {finding.severity}
                        </span>
                        <span className="rounded-full bg-foreground/10 px-2 py-1 text-xs font-semibold text-foreground/70">
                          Impact {finding.impact}
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-foreground/60">
                        {finding.evidence}
                      </p>
                      <p className="mt-2 text-xs text-foreground/70">
                        {finding.recommendation}
                      </p>
                      <span className="mt-3 inline-flex rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold text-accent">
                        Effort {finding.estimated_effort}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        ) : null}
      </main>

      {showLeadModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6 backdrop-blur">
          <form
            onSubmit={submitLead}
            className="w-full max-w-md rounded-3xl border border-border bg-surface p-6"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-accent">
              Get the report
            </p>
            <h2 className="mt-3 text-xl font-semibold">
              Enter your email to unlock results
            </h2>
            <label className="mt-4 block text-sm font-semibold">
              Email
              <input
                type="email"
                value={leadEmail}
                onChange={(event) => setLeadEmail(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-border bg-transparent px-4 py-3 text-base outline-none transition focus:border-accent"
                required
              />
            </label>
            <label className="mt-4 flex items-start gap-3 text-sm text-foreground/70">
              <input
                type="checkbox"
                checked={consent}
                onChange={(event) => setConsent(event.target.checked)}
                className="mt-1"
              />
              I agree to receive the audit report and product updates.
            </label>
            {leadError ? (
              <p className="mt-3 text-sm text-red-600">{leadError}</p>
            ) : null}
            <button
              type="submit"
              disabled={leadSubmitting}
              className="mt-6 w-full rounded-2xl bg-accent px-6 py-3 text-base font-semibold text-white transition hover:translate-y-[-1px] hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-70"
            >
              {leadSubmitting ? "Saving..." : "Unlock Report"}
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
