"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

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
        body: JSON.stringify({ url: normalizedUrl, pageType }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || "Unable to start audit.");
      }

      const payload = (await response.json()) as { reportId: string };
      router.push(`/audit/${payload.reportId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to start audit.");
    } finally {
      setIsSubmitting(false);
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
          <div className="space-y-6">
            <p className="inline-flex items-center gap-2 rounded-full bg-surface px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-accent">
              Free Audit MVP
            </p>
            <h1 className="text-4xl font-semibold leading-tight md:text-5xl">
              Find hidden conversion leaks in your store.
            </h1>
            <p className="max-w-xl text-lg text-foreground/70">
              Run a 60-second AI audit for your product, home, or cart page.
              Get a clear score, prioritized fixes, and a CRO action plan.
            </p>
            <form
              onSubmit={onSubmit}
              className="space-y-4 rounded-3xl border border-border bg-surface p-6 shadow-[0_24px_70px_-45px_rgba(15,17,21,0.45)]"
            >
              <label className="block text-sm font-semibold">
                Store URL
                <input
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                  placeholder="https://yourstore.com/products/hero-item"
                  className="mt-2 w-full rounded-2xl border border-border bg-transparent px-4 py-3 text-base outline-none transition focus:border-accent"
                  required
                />
              </label>
              <label className="block text-sm font-semibold">
                Page Type
                <select
                  value={pageType}
                  onChange={(event) =>
                    setPageType(event.target.value as PageType)
                  }
                  className="mt-2 w-full rounded-2xl border border-border bg-transparent px-4 py-3 text-base outline-none transition focus:border-accent"
                >
                  {pageTypeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              {error ? (
                <p className="text-sm text-red-600">{error}</p>
              ) : null}
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex w-full items-center justify-center rounded-2xl bg-accent px-6 py-3 text-base font-semibold text-white transition hover:translate-y-[-1px] hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isSubmitting ? "Running audit..." : "Run Audit"}
              </button>
            </form>
          </div>

          <div className="rounded-[32px] border border-border bg-surface p-6 shadow-[0_22px_70px_-50px_rgba(15,17,21,0.5)]" style={{ animationDelay: "0.08s" }}>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-foreground/60">
                  Audit Preview
                </p>
                <span className="rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold text-accent">
                  92 / 100
                </span>
              </div>
              <h2 className="font-serif text-2xl font-semibold">
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
