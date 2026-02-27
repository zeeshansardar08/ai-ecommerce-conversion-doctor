"use client";

import { useState } from "react";
import { trackEvent } from "@/src/lib/analytics";

export default function PricingPage() {
  const [email, setEmail] = useState("");
  const [waitlistStatus, setWaitlistStatus] = useState<
    "idle" | "submitting" | "success" | "error"
  >("idle");
  const [waitlistError, setWaitlistError] = useState("");

  const handleWaitlist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setWaitlistStatus("submitting");
    setWaitlistError("");

    try {
      const res = await fetch("/api/feature-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "waitlist", email: email.trim() }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Something went wrong.");
      }

      setWaitlistStatus("success");
      trackEvent({ name: "waitlist_joined", props: { plan: "pro" } });
      setEmail("");
    } catch (err) {
      setWaitlistError(
        err instanceof Error ? err.message : "Something went wrong."
      );
      setWaitlistStatus("error");
    }
  };

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "CROSignal",
    url: "https://crosignal.com",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    offers: [
      {
        "@type": "Offer",
        name: "Free MVP",
        price: "0",
        priceCurrency: "USD",
        description:
          "Single-page AI CRO audit with top fixes and 8–12 findings",
      },
      {
        "@type": "Offer",
        name: "Pro / Agency",
        price: "0",
        priceCurrency: "USD",
        description:
          "Multi-page audits, team dashboards, and competitive benchmarks — coming soon",
        availability: "https://schema.org/PreOrder",
      },
    ],
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="pointer-events-none absolute inset-0 grid-glow" />
      <div className="pointer-events-none absolute inset-0 grain" />

      {/* header */}
      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-8">
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
          className="rounded-full border border-border px-4 py-2 text-sm font-medium transition hover:border-accent hover:text-accent"
        >
          Home
        </a>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-5xl flex-col gap-10 px-6 pb-20 pt-8">
        <div className="space-y-4 text-center">
          <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-accent">
            Pricing
          </p>
          <h1 className="text-4xl font-bold tracking-tight">
            Simple, transparent plans
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-foreground/65 leading-relaxed">
            The MVP is free while we refine CROSignal. Upgrade
            plans will unlock multi-page audits and team workflows.
          </p>
        </div>

        <section className="grid gap-6 md:grid-cols-2">
          {/* Free plan */}
          <div className="rounded-[28px] border border-border bg-surface p-8 shadow-[0_20px_60px_-45px_rgba(15,17,21,0.5)]">
            <h2 className="text-[11px] font-bold uppercase tracking-[0.25em] text-foreground/50">
              Free MVP
            </h2>
            <p className="mt-3 text-3xl font-bold">$0</p>
            <ul className="mt-6 space-y-3 text-sm text-foreground/65">
              <li className="flex items-start gap-2">
                <span className="mt-0.5 text-accent">✓</span>
                Single-page audit with AI CRO report
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 text-accent">✓</span>
                Top fixes + 8–12 findings
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 text-accent">✓</span>
                Email delivery + dashboard access
              </li>
            </ul>
            <a
              href="/"
              className="mt-8 inline-flex w-full items-center justify-center rounded-2xl bg-accent px-6 py-3.5 text-base font-bold text-white transition hover:-translate-y-0.5 hover:shadow-[0_8px_30px_-6px_rgba(240,91,42,0.5)]"
            >
              Run a free audit
            </a>
          </div>

          {/* Pro plan */}
          <div className="rounded-[28px] border border-border bg-surface-muted p-8">
            <h2 className="text-[11px] font-bold uppercase tracking-[0.25em] text-foreground/50">
              Pro / Agency
            </h2>
            <p className="mt-3 text-3xl font-bold">Coming soon</p>
            <ul className="mt-6 space-y-3 text-sm text-foreground/65">
              <li className="flex items-start gap-2">
                <span className="mt-0.5 text-foreground/30">○</span>
                Multi-page audits and checkout flow scans
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 text-foreground/30">○</span>
                Team dashboards and priority alerts
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 text-foreground/30">○</span>
                Competitive benchmarks and experiments
              </li>
            </ul>

            {waitlistStatus === "success" ? (
              <div className="mt-8 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-5 py-3.5 text-center text-sm font-semibold text-emerald-400">
                You&apos;re on the list! We&apos;ll notify you when Pro launches.
              </div>
            ) : (
              <form onSubmit={handleWaitlist} className="mt-8 space-y-3">
                <div className="flex gap-2">
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    className="flex-1 rounded-2xl border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-foreground/35 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
                  />
                  <button
                    type="submit"
                    disabled={waitlistStatus === "submitting"}
                    className="shrink-0 rounded-2xl border border-border px-5 py-3 text-sm font-bold text-foreground transition hover:border-accent hover:text-accent disabled:opacity-50"
                  >
                    {waitlistStatus === "submitting"
                      ? "Joining…"
                      : "Join waitlist"}
                  </button>
                </div>
                {waitlistStatus === "error" && waitlistError && (
                  <p className="text-xs text-red-400">{waitlistError}</p>
                )}
              </form>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
