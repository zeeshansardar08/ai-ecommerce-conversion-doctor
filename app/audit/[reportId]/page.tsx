"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { trackEvent } from "@/src/lib/analytics";

type AuditStatus = "queued" | "running" | "done" | "failed";

type ReportResponse = {
  status: AuditStatus;
  error?: string | null;
  report?: AuditReport | null;
  leadCaptured?: boolean;
  url?: string;
  pageType?: string;
  previewMode?: boolean;
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
    where_to_fix?: string;
    estimated_effort: "S" | "M" | "L";
  }[];
  findings: {
    id: string;
    title: string;
    category: "CRO" | "Trust" | "Copy" | "Mobile UX" | "Performance" | "SEO";
    severity: "High" | "Medium" | "Low";
    impact: "High" | "Medium" | "Low";
    confidence?: "High" | "Medium" | "Low";
    evidence: string;
    where_to_fix?: string;
    what_to_change?: string;
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

const severityBorders: Record<string, string> = {
  High: "border-l-red-500",
  Medium: "border-l-amber-500",
  Low: "border-l-emerald-500",
};

const categoryIcons: Record<string, React.ReactElement> = {
  cro: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 12h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M12 5v14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  trust: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 4l6 3v5c0 4.5-3 7.5-6 8-3-.5-6-3.5-6-8V7l6-3z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M9.5 12l1.5 1.5 3.5-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  copy: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 7h12M6 12h8M6 17h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  mobile_ux: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="7" y="3" width="10" height="18" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M11 17h2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  performance_basics: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 13a7 7 0 1 1 14 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M12 12l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  seo_basics: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="11" cy="11" r="6" stroke="currentColor" strokeWidth="1.5" />
      <path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
};

function friendlyErrorMessage(error: string | null): string {
  if (!error) return "Something went wrong while analyzing your page. This can happen with temporary network issues or server load.";
  const lower = error.toLowerCase();
  if (lower.includes("ssrf") || lower.includes("blocked") || lower.includes("not allowed"))
    return "We couldn\u2019t reach that URL. Please check that the address is correct and publicly accessible.";
  if (lower.includes("timeout") || lower.includes("timed out"))
    return "The page took too long to respond. This sometimes happens with slow-loading sites \u2014 please try again.";
  if (lower.includes("rate limit") || lower.includes("too many"))
    return "You\u2019ve run several audits recently. Please wait a few minutes before trying again.";
  if (lower.includes("not found") || lower.includes("404"))
    return "We couldn\u2019t find that page. Please double-check the URL and try again.";
  if (lower.includes("openai") || lower.includes("ai") || lower.includes("model"))
    return "Our AI analysis service is temporarily unavailable. Please try again in a minute.";
  return "Something went wrong while analyzing your page. This can happen with temporary network issues or server load.";
}

export default function AuditPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const reportId = typeof params.reportId === "string" ? params.reportId : "";
  const [status, setStatus] = useState<AuditStatus>("queued");
  const [retrying, setRetrying] = useState(false);
  const prevStatusRef = useRef<AuditStatus>("queued");
  const [report, setReport] = useState<AuditReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [leadCaptured, setLeadCaptured] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [pageType, setPageType] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<
    (typeof categoryFilters)[number]
  >("All");
  const [showLeadModal, setShowLeadModal] = useState(false);
  const [leadEmail, setLeadEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [leadError, setLeadError] = useState<string | null>(null);
  const [leadSubmitting, setLeadSubmitting] = useState(false);
  const [scoreProgress, setScoreProgress] = useState(0);
  const [modalType, setModalType] = useState<
    "unlock" | "pdf" | "optimize" | null
  >(null);
  const [modalStatus, setModalStatus] = useState<
    "idle" | "submitting" | "success"
  >("idle");
  const [modalError, setModalError] = useState<string | null>(null);
  const [featureEmail, setFeatureEmail] = useState("");
  const [featureStoreUrl, setFeatureStoreUrl] = useState("");
  const [optName, setOptName] = useState("");
  const [optEmail, setOptEmail] = useState("");
  const [optStoreUrl, setOptStoreUrl] = useState("");
  const [optTraffic, setOptTraffic] = useState<
    "<10k" | "10k-50k" | "50k-100k" | "100k+"
  >("<10k");
  const [optRevenue, setOptRevenue] = useState("");
  const [optChallenge, setOptChallenge] = useState("");

  const handleRetry = async () => {
    if (!url || retrying) return;
    setRetrying(true);
    try {
      const res = await fetch("/api/audit/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, pageType: pageType || "landing", useLiveAudit: true }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Failed to start a new audit.");
      }
      const data = (await res.json()) as { reportId: string };
      trackEvent({ name: "audit_started", props: { url, pageType: pageType || "landing" } });
      router.push(`/audit/${data.reportId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to retry. Please try again.");
      setRetrying(false);
    }
  };

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
      const prevStatus = prevStatusRef.current;
      setStatus(payload.status);
      prevStatusRef.current = payload.status;
      setError(payload.error || null);
      setReport(payload.report || null);
      setLeadCaptured(Boolean(payload.leadCaptured));
      setUrl(payload.url || null);
      setPageType(payload.pageType || null);
      setPreviewMode(Boolean(payload.previewMode));

      // Track status transitions (fire once)
      if (payload.status === "done" && prevStatus !== "done") {
        trackEvent({ name: "audit_completed", props: { reportId, score: (payload.report as AuditReport | null)?.overall_score } });
        trackEvent({ name: "report_viewed", props: { reportId } });
      }
      if (payload.status === "failed" && prevStatus !== "failed") {
        trackEvent({ name: "audit_failed", props: { reportId, error: payload.error ?? undefined } });
      }

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
      trackEvent({ name: "lead_captured", props: { reportId } });
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

  const scoreValue = report?.overall_score ?? 0;
    const liveRequested = searchParams.get("live") === "1";
  const scoreLabel = useMemo(() => {
    if (scoreValue >= 80) return "Excellent";
    if (scoreValue >= 65) return "Good";
    if (scoreValue >= 50) return "Needs Improvement";
    return "Critical";
  }, [scoreValue]);

  const steps: AuditStatus[] = ["queued", "running", "done"];
  const activeIndex = status === "failed" ? 1 : Math.max(0, steps.indexOf(status));
  const radius = 78;
  const circumference = 2 * Math.PI * radius;
  const dashOffset =
    circumference - (scoreProgress / 100) * circumference;

  useEffect(() => {
    if (!report) {
      setScoreProgress(0);
      return;
    }
    const timer = setTimeout(() => {
      setScoreProgress(scoreValue);
    }, 50);
    return () => clearTimeout(timer);
  }, [report, scoreValue]);

  useEffect(() => {
    if (modalType) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
    return;
  }, [modalType]);

  useEffect(() => {
    if (url) {
      setFeatureStoreUrl(url);
      setOptStoreUrl(url);
    }
  }, [url]);

  const closeModal = () => {
    setModalType(null);
    setModalStatus("idle");
    setModalError(null);
  };

  const openFeatureModal = (type: "unlock" | "pdf") => {
    setModalType(type);
    setModalStatus("idle");
    setModalError(null);
  };

  const openOptimizeModal = () => {
    setModalType("optimize");
    setModalStatus("idle");
    setModalError(null);
  };

  const submitFeatureRequest = async (event: React.FormEvent) => {
    event.preventDefault();
    setModalError(null);

    if (!featureEmail) {
      setModalError("Email is required.");
      return;
    }

    setModalStatus("submitting");
    try {
      const response = await fetch("/api/feature-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: modalType === "pdf" ? "pdf_interest" : "unlock_full_audit",
          email: featureEmail,
          reportId: reportId || null,
          storeUrl: featureStoreUrl || null,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || "Unable to save request.");
      }

      setModalStatus("success");
    } catch (err) {
      setModalError(err instanceof Error ? err.message : "Unable to save request.");
      setModalStatus("idle");
    }
  };

  const submitOptimizationRequest = async (event: React.FormEvent) => {
    event.preventDefault();
    setModalError(null);

    if (!optName || !optEmail) {
      setModalError("Name and email are required.");
      return;
    }

    setModalStatus("submitting");
    try {
      const response = await fetch("/api/optimization-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: optName,
          email: optEmail,
          storeUrl: optStoreUrl || null,
          monthlyTraffic: optTraffic,
          revenueRange: optRevenue || null,
          challenge: optChallenge || null,
          reportId: reportId || null,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || "Unable to save request.");
      }

      setModalStatus("success");
    } catch (err) {
      setModalError(
        err instanceof Error ? err.message : "Unable to save request."
      );
      setModalStatus("idle");
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 grid-glow" />
      <div className="pointer-events-none absolute inset-0 grain" />

      <header className="relative z-10 mx-auto flex w-full max-w-5xl items-center justify-between px-6 pt-8">
        <a href="/" className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-accent text-white font-bold text-sm">
            CS
          </div>
          <div>
            <p className="text-base font-bold leading-tight">
              CRO<span className="text-accent">Signal</span>
            </p>
            <p className="text-[10px] uppercase tracking-[0.25em] text-foreground/45 font-medium">
              AI Conversion Audits
            </p>
          </div>
        </a>
        <a
          href="/"
          className="rounded-full border border-border px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-foreground/60 transition hover:border-accent hover:text-accent"
        >
          New Audit
        </a>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-5xl flex-col gap-10 px-6 pb-20 pt-6">
        <section className="animate-rise rounded-[28px] border border-border bg-surface p-6 shadow-[0_20px_60px_-45px_rgba(15,17,21,0.5)]">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-semibold">CRO Audit Report</h1>
              <p className="mt-1 text-xs font-semibold uppercase tracking-[0.35em] text-foreground/60">
                Status: {statusLabel}
              </p>
              <p className="text-sm text-foreground/60">
                {url ? url : "Preparing report"}
              </p>
            </div>
            <a
              href="/"
              className="rounded-full border border-border px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] transition hover:border-accent"
            >
              {pageType ? `${pageType} page` : "Analyzing"}
            </a>
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-4">
            {steps.map((step, index) => {
              const isCompleted = status === "done" ? true : index < activeIndex;
              const isActive =
                status !== "failed" && status !== "done" && index === activeIndex;
              return (
                <div key={step} className="flex items-center gap-3">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-full border text-xs font-semibold uppercase tracking-[0.25em] ${
                      isCompleted
                        ? "border-emerald-500 bg-emerald-500 text-white"
                        : isActive
                        ? "border-accent bg-accent/10 text-accent"
                        : "border-border text-foreground/50"
                    }`}
                  >
                    {isCompleted ? (
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        aria-hidden="true"
                      >
                        <path
                          d="M5 13l4 4 10-10"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    ) : (
                      index + 1
                    )}
                  </div>
                  <p
                    className={`text-xs font-semibold uppercase tracking-[0.3em] ${
                      isCompleted
                        ? "text-emerald-500"
                        : isActive
                        ? "text-accent"
                        : "text-foreground/50"
                    }`}
                  >
                    {step}
                  </p>
                  {index < steps.length - 1 ? (
                    <span
                      className={`h-px w-10 ${
                        isCompleted ? "bg-emerald-500" : "bg-border"
                      }`}
                    />
                  ) : null}
                </div>
              );
            })}
            {status === "failed" ? (
              <div className="flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-red-600">
                Failed
              </div>
            ) : null}
          </div>
        </section>

        {status === "failed" ? (
          <section className="rounded-[28px] border border-red-200/40 bg-red-50/30 p-8">
            <div className="mx-auto max-w-lg text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-100">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" stroke="#dc2626" strokeWidth="1.5" />
                  <path d="M12 8v4" stroke="#dc2626" strokeWidth="1.5" strokeLinecap="round" />
                  <circle cx="12" cy="16" r="1" fill="#dc2626" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-red-700">Audit Failed</h2>
              <p className="mt-2 text-sm leading-relaxed text-red-600/80">
                {friendlyErrorMessage(error)}
              </p>
              <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
                {url ? (
                  <button
                    onClick={handleRetry}
                    disabled={retrying}
                    className="inline-flex items-center gap-2 rounded-full bg-accent px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:brightness-110 disabled:opacity-60"
                  >
                    {retrying ? (
                      <>
                        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" opacity="0.25" />
                          <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                        Retrying&hellip;
                      </>
                    ) : (
                      <>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                          <path d="M1 4v6h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        Retry Audit
                      </>
                    )}
                  </button>
                ) : null}
                <a
                  href="/"
                  className="inline-flex items-center gap-2 rounded-full border border-border px-6 py-2.5 text-sm font-semibold text-foreground/70 transition hover:bg-foreground/5"
                >
                  Start New Audit
                </a>
              </div>
              <p className="mt-5 text-xs text-foreground/40">
                Still having trouble?{" "}
                <a
                  href="mailto:support@crosignal.com?subject=Audit%20Failed%20-%20Report%20{reportId}"
                  className="underline hover:text-foreground/60"
                >
                  Contact support
                </a>
              </p>
            </div>
          </section>
        ) : null}

        {status !== "done" && status !== "failed" ? (
          <section className="rounded-[28px] border border-border bg-surface p-8 text-center">
            <p className="text-lg font-semibold">Generating your CRO report...</p>
            <p className="mt-2 text-sm text-foreground/60">
              We are collecting signals, analyzing copy, and scoring trust.
            </p>
          </section>
        ) : null}

        {status === "done" && report ? (
          <section className="animate-fade space-y-10">
            {previewMode && liveRequested ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700">
                Live audit temporarily unavailable — showing preview report.
              </div>
            ) : null}
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

              <div className="grid gap-8 lg:grid-cols-[1.3fr_1.7fr]">
                <div className="flex flex-col items-center justify-center gap-4 rounded-3xl border border-border bg-surface-muted p-7 text-center">
                  <p className="text-xs font-semibold uppercase tracking-[0.35em] text-foreground/60">
                    Overall Score
                  </p>
                  <div className="relative flex h-52 w-52 items-center justify-center">
                    <div className="absolute inset-0 rounded-full bg-accent/10 blur-2xl" />
                    <svg className="h-full w-full -rotate-90 soft-halo rounded-full" viewBox="0 0 180 180">
                      <circle
                        cx="90"
                        cy="90"
                        r={radius}
                        stroke="currentColor"
                        strokeWidth="10"
                        fill="transparent"
                        className="text-border"
                      />
                      <circle
                        cx="90"
                        cy="90"
                        r={radius}
                        stroke="currentColor"
                        strokeWidth="10"
                        fill="transparent"
                        strokeDasharray={`${circumference} ${circumference}`}
                        strokeDashoffset={dashOffset}
                        strokeLinecap="round"
                        className="text-accent transition-[stroke-dashoffset] duration-700 ease-out"
                      />
                    </svg>
                    <div className="absolute flex flex-col items-center">
                      <span className="text-5xl font-semibold text-foreground">
                        {scoreValue}
                      </span>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.3em] text-accent">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M12 3l9 16H3l9-16z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                      <path d="M12 9v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                      <circle cx="12" cy="17" r="1" fill="currentColor" />
                    </svg>
                    {scoreLabel}
                  </span>
                  <p className="text-sm text-foreground/70">
                    Shipping clarity and trust signals are your biggest quick wins.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                  {Object.entries(report.category_scores).map(
                    ([key, value]) => (
                      <div
                        key={key}
                        className="rounded-2xl border border-border bg-surface-muted px-4 py-4 text-center transition hover:-translate-y-1 hover:shadow-[0_18px_45px_-35px_rgba(15,17,21,0.6)]"
                      >
                        <div className="flex items-center justify-center gap-2 text-[11px] font-semibold uppercase tracking-[0.3em] text-foreground/60">
                          <span className="text-foreground/70">
                            {categoryIcons[key]}
                          </span>
                          <span>{key.replace("_", " ")}</span>
                        </div>
                        <p className="mt-2 text-3xl font-semibold text-foreground">
                          {value}
                        </p>
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
                <div className="mt-5 space-y-6">
                  {report.top_fixes.map((fix, index) => (
                    <div
                      key={fix.title}
                      className={`rounded-2xl border border-border bg-gradient-to-br from-surface-muted via-surface to-surface-muted p-5 shadow-[0_16px_45px_-35px_rgba(15,17,21,0.65)] transition hover:-translate-y-1 ${
                        index === 0 ? "scale-[1.01]" : ""
                      }`}
                    >
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-xs font-semibold text-white">
                          #{index + 1}
                        </div>
                        <p className="text-base font-semibold text-foreground">
                          {fix.title}
                        </p>
                        {index === 0 ? (
                          <span className="rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-700">
                            High Impact
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-3 text-xs text-foreground/60">
                        {fix.why_it_matters}
                      </p>
                      <p className="mt-3 text-sm text-foreground/85">
                        {fix.how_to_fix}
                      </p>
                      <span className="mt-4 inline-flex rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold text-accent">
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
                      className={`rounded-2xl border border-border bg-surface-muted p-4 transition hover:-translate-y-1 hover:shadow-[0_18px_45px_-35px_rgba(15,17,21,0.6)] border-l-[3px] ${
                        severityBorders[finding.severity]
                      }`}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-base font-semibold text-foreground">
                          {finding.title}
                        </p>
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] ${
                            severityColors[finding.severity]
                          }`}
                        >
                          {finding.severity}
                        </span>
                        <span className="rounded-full bg-foreground/10 px-3 py-1 text-xs font-semibold text-foreground/60">
                          Impact {finding.impact}
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-foreground/60">
                        {finding.evidence}
                      </p>
                      <p className="mt-2 text-sm text-foreground/80">
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

            <section className="rounded-[28px] border border-border bg-surface p-8">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.35em] text-foreground/60">
                    Next Steps
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold">
                    Don't let these leaks cost you more sales.
                  </h2>
                  <p className="mt-2 text-sm text-foreground/70">
                    Unlock the full audit, export a PDF, or get expert CRO support.
                  </p>
                  <p className="mt-2 text-sm font-semibold text-foreground/80">
                    Most stores recover 5-15% revenue after fixing top 3 issues.
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={() => openFeatureModal("unlock")}
                    className="rounded-2xl bg-gradient-to-r from-accent to-accent-2 px-6 py-3 text-sm font-semibold text-white shadow-[0_12px_35px_-25px_rgba(240,91,42,0.7)] transition hover:-translate-y-1 hover:shadow-[0_16px_40px_-25px_rgba(240,91,42,0.8)]"
                  >
                    Unlock Full Audit
                  </button>
                  <button
                    onClick={() => openFeatureModal("pdf")}
                    className="rounded-2xl border border-border px-5 py-3 text-sm font-semibold text-foreground/70 transition hover:-translate-y-1 hover:border-accent"
                  >
                    Download PDF
                  </button>
                  <button
                    onClick={openOptimizeModal}
                    className="rounded-2xl border border-border px-5 py-3 text-sm font-semibold text-foreground/70 transition hover:-translate-y-1 hover:border-accent"
                  >
                    Request Optimization Help
                  </button>
                </div>
              </div>
            </section>
          </section>
        ) : null}
      </main>

      {modalType ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur"
          onClick={closeModal}
        >
          <div
            className="relative flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-border bg-surface shadow-[0_30px_80px_-45px_rgba(15,17,21,0.8)] animate-pop"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b border-border px-6 py-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.35em] text-accent">
                  {modalType === "optimize" ? "Consultation" : "Early Access"}
                </p>
                <h2 className="mt-2 text-2xl font-semibold">
                  {modalStatus === "success"
                    ? modalType === "optimize"
                      ? "Request received"
                      : "You're on the early access list."
                    : modalType === "optimize"
                    ? "Want help implementing these fixes?"
                    : "Unlock the Full Conversion Report"}
                </h2>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-full border border-border bg-surface px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-foreground/60 transition hover:border-accent"
                aria-label="Close modal"
              >
                Close
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5">
              {modalStatus === "success" ? (
                <div className="space-y-4 text-center">
                  <p className="text-sm text-foreground/70">
                    {modalType === "optimize"
                      ? "Thanks! We'll review your report and reach out within 24 hours."
                      : "We'll notify you when full access launches."}
                  </p>
                </div>
              ) : modalType === "optimize" ? (
                <form onSubmit={submitOptimizationRequest} className="space-y-4">
                  <div className="grid gap-4">
                    <label className="text-sm font-semibold">
                      Name
                      <input
                        value={optName}
                        onChange={(event) => setOptName(event.target.value)}
                        className="mt-2 w-full rounded-2xl border border-border bg-surface-muted px-4 py-3 text-base outline-none transition focus:border-accent"
                        required
                      />
                    </label>
                    <label className="text-sm font-semibold">
                      Email
                      <input
                        type="email"
                        value={optEmail}
                        onChange={(event) => setOptEmail(event.target.value)}
                        className="mt-2 w-full rounded-2xl border border-border bg-surface-muted px-4 py-3 text-base outline-none transition focus:border-accent"
                        required
                      />
                    </label>
                    <label className="text-sm font-semibold">
                      Store URL (optional)
                      <input
                        value={optStoreUrl}
                        onChange={(event) => setOptStoreUrl(event.target.value)}
                        placeholder="https://yourstore.com"
                        className="mt-2 w-full rounded-2xl border border-border bg-surface-muted px-4 py-3 text-base outline-none transition focus:border-accent"
                      />
                    </label>
                    <label className="text-sm font-semibold">
                      Monthly traffic
                      <select
                        value={optTraffic}
                        onChange={(event) =>
                          setOptTraffic(
                            event.target.value as
                              | "<10k"
                              | "10k-50k"
                              | "50k-100k"
                              | "100k+"
                          )
                        }
                        className="mt-2 w-full rounded-2xl border border-border bg-surface-muted px-4 py-3 text-base outline-none transition focus:border-accent"
                      >
                        <option value="<10k">&lt;10k</option>
                        <option value="10k-50k">10k-50k</option>
                        <option value="50k-100k">50k-100k</option>
                        <option value="100k+">100k+</option>
                      </select>
                    </label>
                    <label className="text-sm font-semibold">
                      Revenue range (optional)
                      <input
                        value={optRevenue}
                        onChange={(event) => setOptRevenue(event.target.value)}
                        placeholder="$10k - $50k"
                        className="mt-2 w-full rounded-2xl border border-border bg-surface-muted px-4 py-3 text-base outline-none transition focus:border-accent"
                      />
                    </label>
                    <label className="text-sm font-semibold">
                      Biggest challenge
                      <textarea
                        value={optChallenge}
                        onChange={(event) => setOptChallenge(event.target.value)}
                        rows={3}
                        className="mt-2 w-full rounded-2xl border border-border bg-surface-muted px-4 py-3 text-base outline-none transition focus:border-accent"
                      />
                    </label>
                  </div>
                  {modalError ? (
                    <p className="text-sm text-red-600">{modalError}</p>
                  ) : null}
                </form>
              ) : (
                <form onSubmit={submitFeatureRequest} className="space-y-4">
                  <div className="rounded-2xl border border-border bg-surface-muted p-4 text-sm text-foreground/70">
                    <p>• Detailed copy rewrites</p>
                    <p>• Multi-page audit</p>
                    <p>• Priority roadmap (Week 1 / Week 2 / Later)</p>
                    <p>• PDF export</p>
                    <p>• Ongoing optimization insights</p>
                  </div>
                  {modalType === "pdf" ? (
                    <p className="text-sm text-foreground/70">
                      PDF export will be available in Pro version. Join early access to get notified.
                    </p>
                  ) : null}
                  <label className="text-sm font-semibold">
                    Email
                    <input
                      type="email"
                      value={featureEmail}
                      onChange={(event) => setFeatureEmail(event.target.value)}
                      className="mt-2 w-full rounded-2xl border border-border bg-surface-muted px-4 py-3 text-base outline-none transition focus:border-accent"
                      required
                    />
                  </label>
                  <label className="text-sm font-semibold">
                    Store URL (optional)
                    <input
                      value={featureStoreUrl}
                      onChange={(event) => setFeatureStoreUrl(event.target.value)}
                      className="mt-2 w-full rounded-2xl border border-border bg-surface-muted px-4 py-3 text-base outline-none transition focus:border-accent"
                    />
                  </label>
                  {modalError ? (
                    <p className="text-sm text-red-600">{modalError}</p>
                  ) : null}
                </form>
              )}
            </div>

            <div className="border-t border-border px-6 py-4">
              {modalStatus === "success" ? (
                <button
                  onClick={closeModal}
                  className="w-full rounded-2xl bg-accent px-6 py-3 text-sm font-semibold text-white"
                >
                  Close
                </button>
              ) : modalType === "optimize" ? (
                <button
                  onClick={submitOptimizationRequest}
                  disabled={modalStatus === "submitting"}
                  className="w-full rounded-2xl bg-accent px-6 py-3 text-sm font-semibold text-white transition hover:-translate-y-1 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {modalStatus === "submitting"
                    ? "Submitting..."
                    : "Request Optimization Help"}
                </button>
              ) : (
                <button
                  onClick={submitFeatureRequest}
                  disabled={modalStatus === "submitting"}
                  className="w-full rounded-2xl bg-accent px-6 py-3 text-sm font-semibold text-white transition hover:-translate-y-1 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {modalStatus === "submitting" ? "Submitting..." : "Get Early Access"}
                </button>
              )}
            </div>
          </div>
        </div>
      ) : null}

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
