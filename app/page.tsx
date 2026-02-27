"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { trackEvent } from "@/src/lib/analytics";
import { CROSignalLogo } from "@/src/components/CROSignalLogo";

type PageType = "product" | "home" | "cart" | "other";

const pageTypeOptions: { value: PageType; label: string }[] = [
  { value: "product", label: "Product Page" },
  { value: "home", label: "Home Page" },
  { value: "cart", label: "Cart / Checkout" },
  { value: "other", label: "Other" },
];

/* ────────────────────────── icons (inline SVGs) ────────────────────────── */

const CheckCircleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
    <path d="M8 12l2.5 2.5L16 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const ArrowDownIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/* ────────────────────────── feature data ────────────────────────── */

const features = [
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 2L2 7l10 5 10-5-10-5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M2 17l10 5 10-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M2 12l10 5 10-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    title: "Top 3 Fixes",
    desc: "Prioritized, high-impact changes ranked by effort and ROI.",
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M22 12h-4l-3 9L9 3l-3 9H2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    title: "CRO + Trust Score",
    desc: "Numeric scores across five dimensions so you can benchmark progress.",
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 20h9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
    ),
    title: "Copy Suggestions",
    desc: "Headline, CTA, and product description rewrites grounded in evidence.",
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="5" y="2" width="14" height="20" rx="2" stroke="currentColor" strokeWidth="1.5" />
        <path d="M12 18h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
    title: "Mobile UX Issues",
    desc: "Tap target, spacing, and above-the-fold problems on mobile viewports.",
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    title: "Performance Basics",
    desc: "Script count, image weight, and render-blocking resource flags.",
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <rect x="9" y="3" width="6" height="4" rx="1" stroke="currentColor" strokeWidth="1.5" />
        <path d="M9 14l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    title: "Implementation-Ready",
    desc: "Each finding tells you where to fix, what to change, and estimated effort.",
  },
];

/* ────────────────────────── component ────────────────────────── */

export default function Home() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [pageType, setPageType] = useState<PageType>("product");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectOpen, setSelectOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const selectRef = useRef<HTMLDivElement | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);

  const selectedIndex = pageTypeOptions.findIndex(
    (option) => option.value === pageType
  );

  const normalizedUrl = useMemo(() => {
    if (!url) return "";
    if (/^https?:\/\//i.test(url.trim())) return url.trim();
    return `https://${url.trim()}`;
  }, [url]);

  /* ── form submit ── */
  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!normalizedUrl) {
      setError("Please enter a valid URL.");
      return;
    }

    try {
      new URL(normalizedUrl);
    } catch {
      setError("Please enter a valid URL.");
      return;
    }

    trackEvent({ name: "url_entered", props: { url: normalizedUrl, pageType } });

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/audit/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: normalizedUrl, pageType, useLiveAudit: true }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || "Unable to start audit.");
      }

      const payload = (await response.json()) as { reportId: string };
      trackEvent({ name: "audit_started", props: { url: normalizedUrl, pageType } });
      router.push(`/audit/${payload.reportId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to start audit.");
    } finally {
      setIsSubmitting(false);
    }
  };

  /* ── outside click ── */
  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (
        selectRef.current &&
        event.target instanceof Node &&
        !selectRef.current.contains(event.target)
      ) {
        setSelectOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  /* ── custom select helpers ── */
  const openSelect = () => {
    setHighlightedIndex(selectedIndex >= 0 ? selectedIndex : 0);
    setSelectOpen(true);
  };

  const handleSelectKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!selectOpen) openSelect();
      else setHighlightedIndex((p) => (p + 1) % pageTypeOptions.length);
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (!selectOpen) openSelect();
      else setHighlightedIndex((p) => (p === 0 ? pageTypeOptions.length - 1 : p - 1));
    }
    if (event.key === "Enter" && selectOpen) {
      event.preventDefault();
      const sel = pageTypeOptions[highlightedIndex];
      if (sel) setPageType(sel.value);
      setSelectOpen(false);
    }
    if (event.key === " ") {
      event.preventDefault();
      if (!selectOpen) openSelect();
    }
    if (event.key === "Escape") setSelectOpen(false);
  };

  const handleListKeyDown = (event: React.KeyboardEvent<HTMLUListElement>) => {
    if (!selectOpen) return;
    if (event.key === "Escape") { setSelectOpen(false); return; }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlightedIndex((p) => (p + 1) % pageTypeOptions.length);
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlightedIndex((p) => (p === 0 ? pageTypeOptions.length - 1 : p - 1));
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const sel = pageTypeOptions[highlightedIndex];
      if (sel) setPageType(sel.value);
      setSelectOpen(false);
    }
  };

  const scrollToForm = () => {
    trackEvent({ name: "cta_clicked", props: { location: "bottom_cta" } });
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    formRef.current?.querySelector("input")?.focus();
  };

  /* ────────────────────── render ────────────────────── */
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "CROSignal",
    url: "https://crosignal.com",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    description:
      "AI-powered conversion rate optimization audits for Shopify and WooCommerce stores. Get a scored report with prioritized fixes in 60 seconds.",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
      description: "Free AI CRO audit for ecommerce stores",
    },
    creator: {
      "@type": "Organization",
      name: "CROSignal",
      url: "https://crosignal.com",
    },
    featureList: [
      "AI conversion audit",
      "Top 3 prioritized fixes",
      "CRO, Trust, Copy, Mobile UX, Performance, SEO scoring",
      "Shopify and WooCommerce support",
      "Mobile-first analysis",
      "Implementation-ready recommendations",
    ],
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {/* background effects */}
      <div className="pointer-events-none absolute inset-0 grid-glow" />
      <div className="pointer-events-none absolute inset-0 grain" />

      {/* ── header ── */}
      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-8">
        <CROSignalLogo />
        <a
          href="/pricing"
          className="rounded-full border border-border px-4 py-2 text-sm font-medium transition hover:border-accent hover:text-accent"
        >
          Pricing
        </a>
      </header>

      {/* ── main ── */}
      <main className="relative z-10 mx-auto flex w-full max-w-6xl flex-col gap-24 px-6 pb-32 pt-4">
        {/* ████████  HERO  ████████ */}
        <section className="grid animate-rise items-start gap-12 lg:grid-cols-[1.1fr_0.9fr]">
          {/* left – copy + form */}
          <div className="relative space-y-8">
            {/* decorative blurs */}
            <div className="pointer-events-none absolute -top-14 left-0 h-44 w-44 rounded-full bg-accent/20 blur-3xl" />
            <div className="pointer-events-none absolute top-20 left-32 h-36 w-36 rounded-full bg-accent-2/15 blur-3xl" />

            {/* badge */}
            <p className="relative inline-flex items-center gap-2 rounded-full bg-surface/80 backdrop-blur-sm border border-border px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.25em] text-accent">
              <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
              Free AI Audit — No signup required
            </p>

            {/* headline */}
            <h1 className="relative text-4xl font-bold leading-[1.12] tracking-tight text-foreground md:text-[3.5rem]">
              Your store is leaking
              <br className="hidden sm:block" />
              <span className="text-accent"> conversions.</span>
              <br className="hidden sm:block" />
              CROSignal finds them.
            </h1>

            {/* subheadline */}
            <p className="max-w-lg text-lg leading-relaxed text-foreground/75">
              AI-powered conversion audit for Shopify &amp; WooCommerce.
              Paste a URL, get a prioritized fix list in ~60&nbsp;seconds.
            </p>

            {/* trust line */}
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-semibold uppercase tracking-[0.2em] text-foreground/50">
              <span className="inline-flex items-center gap-1.5">
                <CheckCircleIcon /> Mobile-first
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CheckCircleIcon /> Actionable
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CheckCircleIcon /> Built for ecommerce
              </span>
            </div>

            {/* ── form card ── */}
            <form
              ref={formRef}
              onSubmit={onSubmit}
              className="form-card space-y-5 rounded-3xl border border-border/80 bg-surface/90 backdrop-blur-md p-8 shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_0_80px_-20px_rgba(240,91,42,0.12),0_30px_80px_-40px_rgba(15,17,21,0.6)] transition hover:-translate-y-0.5 hover:shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_0_90px_-16px_rgba(240,91,42,0.18),0_36px_90px_-44px_rgba(15,17,21,0.65)]"
            >
              {/* URL input */}
              <label className="block text-sm font-semibold">
                Store URL
                <input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://yourstore.com/products/hero-item"
                  className="mt-2 w-full rounded-2xl border border-border bg-surface-muted px-5 py-3.5 text-base text-foreground placeholder:text-foreground/40 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
                  required
                />
                <span className="mt-1.5 block text-xs font-normal text-foreground/45">
                  Paste any product, home, or cart page — e.g.{" "}
                  <span className="text-foreground/60">
                    https://allbirds.com/products/wool-runners
                  </span>
                </span>
              </label>

              {/* page type dropdown */}
              <label className="block text-sm font-semibold">
                Page Type
                <div className="relative mt-2" ref={selectRef}>
                  <button
                    type="button"
                    onClick={() =>
                      selectOpen ? setSelectOpen(false) : openSelect()
                    }
                    onKeyDown={handleSelectKeyDown}
                    aria-haspopup="listbox"
                    aria-expanded={selectOpen}
                    className="flex w-full items-center justify-between rounded-2xl border border-border bg-surface-muted px-5 py-3.5 text-base font-semibold text-foreground outline-none transition hover:border-accent focus:border-accent focus:ring-2 focus:ring-accent/20"
                  >
                    <span>{pageTypeOptions[selectedIndex]?.label}</span>
                    <span className="text-foreground/50">
                      <ArrowDownIcon />
                    </span>
                  </button>
                  {selectOpen && (
                    <ul
                      role="listbox"
                      tabIndex={0}
                      onKeyDown={handleListKeyDown}
                      className="absolute z-30 mt-2 w-full overflow-hidden rounded-2xl border border-border bg-surface shadow-[0_20px_60px_-20px_rgba(15,17,21,0.8)] animate-pop"
                    >
                      {pageTypeOptions.map((option, index) => {
                        const isSelected = option.value === pageType;
                        const isHighlighted = index === highlightedIndex;
                        return (
                          <li
                            key={option.value}
                            role="option"
                            aria-selected={isSelected}
                            onMouseEnter={() => setHighlightedIndex(index)}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setPageType(option.value);
                              setSelectOpen(false);
                            }}
                            className={`cursor-pointer px-5 py-3 text-sm font-semibold transition ${
                              isHighlighted
                                ? "bg-accent/10 text-accent"
                                : "text-foreground/80 hover:bg-surface-muted"
                            } ${isSelected ? "bg-accent/5" : ""}`}
                          >
                            {option.label}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </label>

              {/* error */}
              {error && (
                <p className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-2.5 text-sm text-red-400 font-medium">
                  {error}
                </p>
              )}

              {/* submit */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="group flex w-full items-center justify-center gap-2 rounded-2xl bg-accent px-6 py-4 text-[15px] font-bold text-white transition hover:-translate-y-0.5 hover:shadow-[0_8px_30px_-6px_rgba(240,91,42,0.5)] active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? (
                  <>
                    <svg
                      className="h-5 w-5 animate-spin"
                      viewBox="0 0 24 24"
                      fill="none"
                      aria-hidden="true"
                    >
                      <circle
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="3"
                        className="opacity-25"
                      />
                      <path
                        d="M4 12a8 8 0 018-8"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                        className="opacity-75"
                      />
                    </svg>
                    Running audit…
                  </>
                ) : (
                  "Run Free Audit →"
                )}
              </button>
              <p className="text-center text-xs text-foreground/40 font-medium">
                Takes ~60 seconds · No signup · 100% free
              </p>
            </form>
          </div>

          {/* right – preview card */}
          <div
            className="float-slow rounded-[32px] border border-border bg-surface/80 backdrop-blur-sm p-8 shadow-[0_26px_80px_-50px_rgba(15,17,21,0.55)] transition hover:-translate-y-1 hover:shadow-[0_32px_90px_-55px_rgba(15,17,21,0.6)] hidden lg:block"
            style={{ animationDelay: "0.08s" }}
          >
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-foreground/50">
                  Sample Report
                </p>
                <span className="rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs font-bold text-accent tabular-nums">
                  92 / 100
                </span>
              </div>
              <h2 className="font-serif text-2xl font-semibold text-foreground">
                CROSignal Report
              </h2>
              <div className="space-y-3 text-sm leading-relaxed text-foreground/65">
                <p>
                  <span className="font-semibold text-foreground/80">
                    Top Fix:
                  </span>{" "}
                  Add shipping ETA and returns near the CTA.
                </p>
                <p>
                  <span className="font-semibold text-foreground/80">
                    Trust:
                  </span>{" "}
                  Surface reviews above the fold for mobile users.
                </p>
                <p>
                  <span className="font-semibold text-foreground/80">
                    Copy:
                  </span>{" "}
                  Rewrite hero headline with a measurable outcome.
                </p>
              </div>
              <div className="grid gap-2.5 grid-cols-2">
                {["CRO", "Trust", "Copy", "Mobile UX"].map((item) => (
                  <div
                    key={item}
                    className="rounded-2xl border border-border bg-surface-muted px-4 py-3 text-[11px] font-bold uppercase tracking-[0.25em] text-foreground/60"
                  >
                    {item}
                  </div>
                ))}
              </div>
              <div className="mt-2 rounded-2xl border border-border bg-surface-muted p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-foreground/40">
                  Trusted by growth teams
                </p>
                <p className="mt-2 text-sm italic text-foreground/70">
                  &ldquo;We surfaced 3 checkout leaks in one audit. The fixes
                  paid for themselves in a week.&rdquo;
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ████████  HOW IT WORKS  ████████ */}
        <section className="animate-rise" style={{ animationDelay: "0.12s" }}>
          <div className="text-center mb-10">
            <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-accent">
              How it works
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">
              Three steps. Sixty seconds.
            </h2>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {[
              {
                step: "01",
                title: "Paste your URL",
                desc: "Drop any product, home, or cart page link. We support Shopify, WooCommerce, and custom stores.",
              },
              {
                step: "02",
                title: "AI analyzes your page",
                desc: "We crawl mobile-first and score UX, trust signals, copy quality, and performance basics.",
              },
              {
                step: "03",
                title: "Get a prioritized fix list",
                desc: "Receive your top 3 fixes, 8–12 detailed findings, and an overall conversion score.",
              },
            ].map((item) => (
              <div
                key={item.step}
                className="group rounded-3xl border border-border bg-surface/70 backdrop-blur-sm p-7 transition hover:border-accent/30 hover:shadow-[0_0_40px_-12px_rgba(240,91,42,0.1)]"
              >
                <span className="text-3xl font-bold text-accent/30">
                  {item.step}
                </span>
                <h3 className="mt-3 text-lg font-bold">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-foreground/60">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ████████  WHAT YOU GET  ████████ */}
        <section className="animate-rise" style={{ animationDelay: "0.18s" }}>
          <div className="text-center mb-10">
            <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-accent">
              What you get
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">
              Everything you need to ship&nbsp;fixes&nbsp;today
            </h2>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div
                key={f.title}
                className="group rounded-3xl border border-border bg-surface/70 backdrop-blur-sm p-7 transition hover:border-accent/30 hover:shadow-[0_0_40px_-12px_rgba(240,91,42,0.1)]"
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-border bg-surface-muted text-accent transition group-hover:bg-accent/10">
                  {f.icon}
                </div>
                <h3 className="text-base font-bold">{f.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-foreground/60">
                  {f.desc}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ████████  BOTTOM CTA  ████████ */}
        <section
          className="animate-rise text-center"
          style={{ animationDelay: "0.22s" }}
        >
          <div className="mx-auto max-w-2xl rounded-[32px] border border-border bg-surface/80 backdrop-blur-sm p-10 md:p-14 shadow-[0_30px_80px_-40px_rgba(15,17,21,0.5)]">
            <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
              Ready to find your conversion&nbsp;leaks?
            </h2>
            <p className="mx-auto mt-4 max-w-md text-base text-foreground/65 leading-relaxed">
              Paste your store URL above and get a full AI audit in about 60
              seconds — free, no&nbsp;signup.
            </p>
            <button
              type="button"
              onClick={scrollToForm}
              className="mt-8 inline-flex items-center gap-2 rounded-2xl bg-accent px-8 py-4 text-[15px] font-bold text-white transition hover:-translate-y-0.5 hover:shadow-[0_8px_30px_-6px_rgba(240,91,42,0.5)] active:translate-y-0"
            >
              Run Free Audit →
            </button>
            <p className="mt-3 text-xs text-foreground/40 font-medium">
              Takes ~60 seconds · Works on Shopify, WooCommerce &amp; custom
              stores
            </p>
          </div>
        </section>
      </main>

      {/* ── footer ── */}
      <footer className="relative z-10 border-t border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-8 text-xs text-foreground/40">
          <div className="flex items-center gap-2">
            <CROSignalLogo size="sm" linkHome />
            <span className="ml-2">© {new Date().getFullYear()}</span>
          </div>
          <div className="flex gap-4">
            <a
              href="/pricing"
              className="transition hover:text-foreground/70"
            >
              Pricing
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
