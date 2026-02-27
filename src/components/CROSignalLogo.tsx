/**
 * CROSignal brand logo — reusable across all pages.
 *
 * Renders a signal-wave logomark + wordmark.
 * The logomark is a pure SVG pulse icon inside a rounded square.
 */

type LogoSize = "sm" | "md" | "lg";

interface CROSignalLogoProps {
  /** Visual size preset. Default: "md" */
  size?: LogoSize;
  /** Wrap in an <a> pointing home. Default: false */
  linkHome?: boolean;
}

const sizeMap: Record<LogoSize, { icon: number; text: string; sub: string; gap: string }> = {
  sm: { icon: 32, text: "text-sm", sub: "text-[9px]", gap: "gap-2" },
  md: { icon: 40, text: "text-base", sub: "text-[10px]", gap: "gap-3" },
  lg: { icon: 48, text: "text-lg", sub: "text-[11px]", gap: "gap-3" },
};

function LogoContent({ size = "md" }: { size: LogoSize }) {
  const s = sizeMap[size];

  return (
    <>
      {/* Logomark — signal pulse inside rounded square */}
      <div
        className="flex items-center justify-center rounded-2xl bg-accent text-white shadow-[0_4px_20px_-6px_rgba(240,91,42,0.5)]"
        style={{ width: s.icon, height: s.icon }}
      >
        <svg
          width={s.icon * 0.55}
          height={s.icon * 0.55}
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          {/* Center dot */}
          <circle cx="12" cy="12" r="2.5" fill="currentColor" />
          {/* Inner ring */}
          <path
            d="M8.5 15.5a5 5 0 0 1 0-7"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <path
            d="M15.5 8.5a5 5 0 0 1 0 7"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          {/* Outer ring */}
          <path
            d="M5.5 18.5a10 10 0 0 1 0-13"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <path
            d="M18.5 5.5a10 10 0 0 1 0 13"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      </div>

      {/* Wordmark */}
      <div>
        <p className={`${s.text} font-bold leading-tight`}>
          CRO<span className="text-accent">Signal</span>
        </p>
        <p
          className={`${s.sub} uppercase tracking-[0.25em] text-foreground/45 font-medium`}
        >
          AI Conversion Audits
        </p>
      </div>
    </>
  );
}

export function CROSignalLogo({ size = "md", linkHome = false }: CROSignalLogoProps) {
  const s = sizeMap[size];
  const className = `flex items-center ${s.gap}`;

  if (linkHome) {
    return (
      <a href="/" className={className}>
        <LogoContent size={size} />
      </a>
    );
  }

  return (
    <div className={className}>
      <LogoContent size={size} />
    </div>
  );
}
