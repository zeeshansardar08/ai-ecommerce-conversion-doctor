/**
 * Analytics abstraction layer.
 *
 * Provides a provider-agnostic `trackEvent()` function so the analytics
 * backend (Plausible, PostHog, etc.) can be swapped without touching
 * any page code.
 *
 * Events are fire-and-forget, never block rendering, and silently
 * no-op when the provider script hasn't loaded or in SSR context.
 */

/* ───────────────── event types ───────────────── */

export type AnalyticsEvent =
  | { name: "url_entered"; props?: { url?: string; pageType?: string } }
  | { name: "audit_started"; props?: { url?: string; pageType?: string } }
  | { name: "audit_completed"; props?: { reportId?: string; score?: number } }
  | { name: "audit_failed"; props?: { reportId?: string; error?: string } }
  | { name: "lead_captured"; props?: { reportId?: string } }
  | { name: "report_viewed"; props?: { reportId?: string } }
  | { name: "resend_clicked"; props?: { reportId?: string } }
  | { name: "waitlist_joined"; props?: { plan?: string } }
  | { name: "cta_clicked"; props?: { location?: string } };

/* ───────────────── provider interface ───────────────── */

type ProviderFn = (eventName: string, props?: Record<string, string | number | undefined>) => void;

/**
 * Plausible provider.
 * Relies on the global `plausible()` function injected by the Plausible script.
 */
function plausibleProvider(): ProviderFn {
  return (name, props) => {
    if (typeof window === "undefined") return;
    const plausible = (window as unknown as Record<string, unknown>).plausible as
      | ((name: string, opts?: { props?: Record<string, string | number | undefined> }) => void)
      | undefined;
    if (typeof plausible === "function") {
      plausible(name, props ? { props } : undefined);
    }
  };
}

/**
 * Console provider for development — logs events to console.
 */
function consoleProvider(): ProviderFn {
  return (name, props) => {
    if (typeof window === "undefined") return;
    // eslint-disable-next-line no-console
    console.log(`[analytics] ${name}`, props ?? "");
  };
}

/* ───────────────── singleton ───────────────── */

let provider: ProviderFn | null = null;

function getProvider(): ProviderFn {
  if (provider) return provider;

  // In production, use Plausible. In dev, log to console.
  if (typeof window !== "undefined" && process.env.NODE_ENV === "production") {
    provider = plausibleProvider();
  } else {
    provider = consoleProvider();
  }

  return provider;
}

/* ───────────────── public API ───────────────── */

/**
 * Track a typed analytics event.
 * Safe to call anywhere (SSR, client). Never throws.
 */
export function trackEvent(event: AnalyticsEvent): void {
  try {
    const send = getProvider();
    send(event.name, event.props as Record<string, string | number | undefined>);
  } catch {
    // Analytics must never break the app
  }
}

/**
 * Swap the analytics provider at runtime (useful for testing or migration).
 */
export function setAnalyticsProvider(fn: ProviderFn): void {
  provider = fn;
}
