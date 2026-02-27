import Script from "next/script";

/**
 * Plausible Analytics script tag.
 *
 * - Loads async, non-blocking (afterInteractive strategy)
 * - Only active when NEXT_PUBLIC_PLAUSIBLE_DOMAIN env var is set
 * - GDPR-friendly: no cookies, no personal data collection
 * - Uses the custom events extension for trackEvent() support
 *
 * Set in .env.local:
 *   NEXT_PUBLIC_PLAUSIBLE_DOMAIN=crosignal.com
 *
 * Optional self-hosted proxy:
 *   NEXT_PUBLIC_PLAUSIBLE_HOST=https://plausible.io
 */
export function PlausibleScript() {
  const domain = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN;

  if (!domain) return null;

  const host =
    process.env.NEXT_PUBLIC_PLAUSIBLE_HOST || "https://plausible.io";

  return (
    <>
      <Script
        strategy="afterInteractive"
        data-domain={domain}
        src={`${host}/js/script.js`}
      />
      {/* Define the plausible queue function before the script loads */}
      <Script
        id="plausible-init"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `window.plausible = window.plausible || function() { (window.plausible.q = window.plausible.q || []).push(arguments) }`,
        }}
      />
    </>
  );
}
