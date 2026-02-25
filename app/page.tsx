"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

type PageType = "product" | "home" | "cart" | "other";

const pageTypeOptions: { value: PageType; label: string }[] = [
  { value: "product", label: "Product" },
  { value: "home", label: "Home" },
  { value: "cart", label: "Cart" },
  { value: "other", label: "Other" },
];

export default function Home() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [pageType, setPageType] = useState<PageType>("product");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [useLiveAudit, setUseLiveAudit] = useState(false);
  const [selectOpen, setSelectOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const selectRef = useRef<HTMLDivElement | null>(null);

  const selectedIndex = pageTypeOptions.findIndex(
    (option) => option.value === pageType
  );

  const normalizedUrl = useMemo(() => {
    if (!url) {
      return "";
    }
    if (/^https?:\/\//i.test(url.trim())) {
      return url.trim();
    }
    return `https://${url.trim()}`;
  }, [url]);

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

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/audit/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: normalizedUrl, pageType, useLiveAudit }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || "Unable to start audit.");
      }

      const payload = (await response.json()) as { reportId: string };
      router.push(`/audit/${payload.reportId}?live=${useLiveAudit ? "1" : "0"}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to start audit.");
    } finally {
      setIsSubmitting(false);
    }
  };

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

  const openSelect = () => {
    setHighlightedIndex(selectedIndex >= 0 ? selectedIndex : 0);
    setSelectOpen(true);
  };

  const handleSelectKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!selectOpen) {
        openSelect();
      } else {
        setHighlightedIndex((prev) => (prev + 1) % pageTypeOptions.length);
      }
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (!selectOpen) {
        openSelect();
      } else {
        setHighlightedIndex((prev) =>
          prev === 0 ? pageTypeOptions.length - 1 : prev - 1
        );
      }
    }
    if (event.key === "Enter" && selectOpen) {
      event.preventDefault();
      const selected = pageTypeOptions[highlightedIndex];
      if (selected) {
        setPageType(selected.value);
      }
      setSelectOpen(false);
    }
    if (event.key === " ") {
      event.preventDefault();
      if (!selectOpen) {
        openSelect();
      }
    }
    if (event.key === "Escape") {
      setSelectOpen(false);
    }
  };

  const handleListKeyDown = (event: React.KeyboardEvent<HTMLUListElement>) => {
    if (!selectOpen) return;
    if (event.key === "Escape") {
      setSelectOpen(false);
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlightedIndex((prev) => (prev + 1) % pageTypeOptions.length);
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlightedIndex((prev) =>
        prev === 0 ? pageTypeOptions.length - 1 : prev - 1
      );
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const selected = pageTypeOptions[highlightedIndex];
      if (selected) {
        setPageType(selected.value);
      }
      setSelectOpen(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 grid-glow" />
      <div className="pointer-events-none absolute inset-0 grain" />
      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-8">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-accent text-white">
            A
          </div>
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-accent">AI CRO</p>
            <p className="text-lg font-semibold">Conversion Doctor</p>
          </div>
        </div>
        <a
          href="/pricing"
          className="rounded-full border border-border px-4 py-2 text-sm font-medium transition hover:border-accent"
        >
          Pricing
        </a>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-6xl flex-col gap-16 px-6 pb-24 pt-6">
        <section className="grid animate-rise items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="relative space-y-6">
            <div className="pointer-events-none absolute -top-10 left-0 h-40 w-40 rounded-full bg-accent/20 blur-3xl" />
            <div className="pointer-events-none absolute top-16 left-28 h-32 w-32 rounded-full bg-accent-2/20 blur-3xl" />
            <p className="inline-flex items-center gap-2 rounded-full bg-surface px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-accent">
              Free Audit MVP
            </p>
            <h1 className="text-4xl font-semibold leading-tight text-foreground md:text-6xl">
              Increase conversions without increasing ad spend.
            </h1>
            <p className="max-w-xl text-lg text-foreground/85">
              Run a 60-second AI audit for your product, home, or cart page.
              Get a clear score, prioritized fixes, and a CRO action plan.
            </p>
            <form
              onSubmit={onSubmit}
              className="space-y-4 rounded-3xl border border-border bg-surface p-7 shadow-[0_28px_80px_-45px_rgba(15,17,21,0.55)] transition hover:-translate-y-1 hover:shadow-[0_32px_90px_-45px_rgba(15,17,21,0.65)]"
            >
              <label className="block text-sm font-semibold">
                Store URL
                <input
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                  placeholder="https://yourstore.com/products/hero-item"
                  className="mt-2 w-full rounded-2xl border border-border bg-surface-muted px-4 py-3 text-base outline-none transition focus:border-accent"
                  required
                />
              </label>
              <label className="block text-sm font-semibold">
                Page Type
                <div className="relative mt-2" ref={selectRef}>
                  <button
                    type="button"
                    onClick={() => (selectOpen ? setSelectOpen(false) : openSelect())}
                    onKeyDown={handleSelectKeyDown}
                    aria-haspopup="listbox"
                    aria-expanded={selectOpen}
                    className="flex w-full items-center justify-between rounded-2xl border border-border bg-surface-muted px-4 py-3 text-base font-semibold text-foreground outline-none transition hover:border-accent focus:border-accent"
                  >
                    <span>{pageTypeOptions[selectedIndex]?.label}</span>
                    <span className="text-foreground/60">▾</span>
                  </button>
                  {selectOpen ? (
                    <ul
                      role="listbox"
                      tabIndex={0}
                      onKeyDown={handleListKeyDown}
                      className="absolute z-20 mt-2 w-full overflow-hidden rounded-2xl border border-border bg-surface shadow-[0_20px_50px_-30px_rgba(15,17,21,0.7)]"
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
                            onMouseDown={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              setPageType(option.value);
                              setSelectOpen(false);
                            }}
                            className={`cursor-pointer px-4 py-3 text-sm font-semibold transition ${
                              isHighlighted
                                ? "bg-accent/10 text-accent"
                                : "text-foreground/80"
                            } ${isSelected ? "bg-accent/15" : ""}`}
                          >
                            {option.label}
                          </li>
                        );
                      })}
                    </ul>
                  ) : null}
                </div>
              </label>
              {error ? (
                <p className="text-sm text-red-600">{error}</p>
              ) : null}
              <label className="flex items-center justify-between rounded-2xl border border-border bg-surface-muted px-4 py-3 text-sm font-semibold">
                <span>
                  Live Audit (Beta)
                  <span className="ml-2 text-xs font-semibold uppercase tracking-[0.3em] text-foreground/50">
                    Off by default
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => setUseLiveAudit((prev) => !prev)}
                  className={`flex h-7 w-12 items-center rounded-full border transition ${
                    useLiveAudit
                      ? "border-emerald-500 bg-emerald-500/20"
                      : "border-border bg-background"
                  }`}
                  aria-pressed={useLiveAudit}
                >
                  <span
                    className={`h-5 w-5 rounded-full bg-white shadow transition ${
                      useLiveAudit ? "translate-x-5" : "translate-x-1"
                    }`}
                  />
                </button>
              </label>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex w-full items-center justify-center rounded-2xl bg-accent px-6 py-4 text-base font-semibold text-white transition hover:translate-y-[-1px] hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isSubmitting ? "Running audit..." : "Run Audit"}
              </button>
            </form>
            <div className="flex flex-wrap gap-3 text-xs font-semibold uppercase tracking-[0.3em] text-foreground/60">
              <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M8 12l2.5 2.5L16 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Mobile-first AI analysis
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M4 12h16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  <path d="M12 4v16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                Shopify & WooCommerce compatible
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M12 6v6l4 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
                </svg>
                Actionable CRO roadmap in 60 seconds
              </span>
            </div>
            <div className="rounded-3xl border border-border bg-surface-muted p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-foreground/60">
                Trusted by growth teams
              </p>
              <p className="mt-2 text-sm text-foreground/80">
                "We surfaced 3 checkout leaks in one audit. The fixes paid for
                themselves in a week."
              </p>
              <p className="mt-3 text-xs font-semibold uppercase tracking-[0.3em] text-foreground/60">
                Built for Shopify & WooCommerce stores
              </p>
              <p className="mt-2 text-xs text-foreground/60">
                Designed for founders, agencies, and CRO teams.
              </p>
            </div>
          </div>

          <div className="float-slow rounded-[36px] border border-border bg-surface p-7 shadow-[0_26px_80px_-50px_rgba(15,17,21,0.55)] transition hover:-translate-y-1 hover:shadow-[0_32px_90px_-55px_rgba(15,17,21,0.6)]" style={{ animationDelay: "0.08s" }}>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-foreground/60">
                  Audit Preview
                </p>
                <span className="rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs font-semibold text-accent">
                  92 / 100
                </span>
              </div>
              <h2 className="font-serif text-2xl font-semibold text-foreground">
                Conversion Doctor Report
              </h2>
              <div className="space-y-3 text-sm text-foreground/70">
                <p>Top Fix: Add shipping ETA and returns near the CTA.</p>
                <p>Trust: Surface reviews above the fold for mobile.</p>
                <p>Copy: Clarify the hero headline with a measurable outcome.</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {["CRO", "Trust", "Copy", "Mobile UX"].map((item) => (
                  <div
                    key={item}
                    className="rounded-2xl border border-border bg-surface-muted px-4 py-3 text-xs font-semibold uppercase tracking-[0.3em]"
                  >
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="grid animate-rise gap-8 rounded-[32px] border border-border bg-surface px-8 py-10 md:grid-cols-3" style={{ animationDelay: "0.14s" }}>
          {[
            {
              title: "1. Paste URL",
              desc: "We load your page with a mobile-first crawl and pull signals.",
            },
            {
              title: "2. AI Diagnosis",
              desc: "OpenAI scores CRO, trust, copy, mobile UX, and basics.",
            },
            {
              title: "3. Action Plan",
              desc: "Get the top fixes and 8-12 detailed findings to ship.",
            },
          ].map((item) => (
            <div key={item.title} className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-foreground/60">
                {item.title}
              </p>
              <p className="text-lg font-semibold">{item.desc}</p>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
