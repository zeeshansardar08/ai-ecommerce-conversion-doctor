export default function PricingPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 grid-glow" />
      <div className="pointer-events-none absolute inset-0 grain" />
      <main className="relative z-10 mx-auto flex w-full max-w-5xl flex-col gap-10 px-6 pb-20 pt-16">
        <header className="space-y-4 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-accent">
            Pricing
          </p>
          <h1 className="text-4xl font-semibold">Simple, transparent plans</h1>
          <p className="mx-auto max-w-2xl text-lg text-foreground/70">
            The MVP is free while we refine the AI Conversion Doctor. Upgrade plans
            will unlock multi-page audits and team workflows.
          </p>
        </header>

        <section className="grid gap-6 md:grid-cols-2">
          <div className="rounded-[28px] border border-border bg-surface p-8 shadow-[0_20px_60px_-45px_rgba(15,17,21,0.5)]">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-foreground/60">
              Free MVP
            </p>
            <h2 className="mt-3 text-3xl font-semibold">$0</h2>
            <ul className="mt-6 space-y-3 text-sm text-foreground/70">
              <li>Single-page audit with AI CRO report</li>
              <li>Top fixes + 8-12 findings</li>
              <li>Email delivery + dashboard access</li>
            </ul>
            <a
              href="/"
              className="mt-8 inline-flex w-full items-center justify-center rounded-2xl bg-accent px-6 py-3 text-base font-semibold text-white"
            >
              Run a free audit
            </a>
          </div>

          <div className="rounded-[28px] border border-border bg-surface-muted p-8">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-foreground/60">
              Pro / Agency
            </p>
            <h2 className="mt-3 text-3xl font-semibold">Coming soon</h2>
            <ul className="mt-6 space-y-3 text-sm text-foreground/70">
              <li>Multi-page audits and checkout flow scans</li>
              <li>Team dashboards and priority alerts</li>
              <li>Competitive benchmarks and experiments</li>
            </ul>
            <button className="mt-8 w-full rounded-2xl border border-border px-6 py-3 text-base font-semibold text-foreground/60">
              Join the waitlist
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
