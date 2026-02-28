# CROSignal — Project Context

> **Permanent knowledge base for AI agents, new developers, and future sessions.**
> Last updated: 2025-07-14 · MVP v0.1.0 · Branch: `main`

---

## 1. What Is CROSignal?

CROSignal is an **AI-powered conversion rate optimization (CRO) audit tool** for ecommerce stores. A user pastes a store URL, selects the page type, and receives a scored, evidence-based report with prioritized fixes — in roughly 60 seconds.

**Domain:** [crosignal.com](https://crosignal.com)

### Business Goal

Build a free audit tool that generates **qualified leads** (store owners / ecommerce managers) by delivering immediate, high-value insight. The free report acts as the top-of-funnel; premium tiers (Pro / Enterprise) will add deeper audits, PDF exports, multi-page crawls, ongoing monitoring, and managed optimization services.

### Revenue Model (planned)

| Tier | Price | Includes |
|------|-------|----------|
| Free MVP | $0 | Single-page audit, 6 categories, 8–12 findings |
| Pro | ~$49/mo | Multi-page, PDF, historical comparison, priority queue |
| Enterprise | Custom | White-label, dedicated strategist, API access |

Currently only the Free MVP tier is live; Pro and Enterprise are **waitlist-only** and captured via the `/pricing` page.

---

## 2. Architecture Overview

### Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js (App Router) | 16.1.6 |
| Language | TypeScript (strict) | ^5 |
| UI | React + Tailwind CSS v4 | 19.2.3 / ^4 |
| Database | Supabase Postgres | @supabase/supabase-js 2.57.0 |
| AI | OpenAI (gpt-4o-mini) | openai 4.104.0 |
| Scraper | Playwright + Cheerio fallback | 1.54.0 / 1.1.2 |
| Analytics | Plausible (env-gated, GDPR-friendly) | Script tag |
| Queue | Supabase-as-queue + Vercel Cron | vercel.json |
| Fonts | Sora (sans) + Spectral (serif) | next/font/google |
| Hosting | Vercel | — |

### High-Level Data Flow

```
User (browser)
  │
  ▼
Landing Page (app/page.tsx)
  │  POST /api/audit/start
  ▼
Start Route ─── validates URL, SSRF check, rate limit, 24h cache check
  │  INSERT row status="queued"
  │  fire-and-forget POST /api/audit/process
  ▼
Process Route (queue worker)
  │  Atomic claim: UPDATE status="running" WHERE status="queued"
  │  [Also triggered by Vercel Cron every minute as safety net]
  ▼
Scraper (Playwright → Cheerio fallback)
  │  Extracts 30+ signals from page HTML
  ▼
OpenAI (gpt-4o-mini, structured JSON output)
  │  Returns AuditReport JSON (score, categories, findings)
  │  If invalid → repair prompt → if still invalid → mock fallback
  ▼
Supabase ─── saves scraped_json + result_json, status="done"
  │
  ▼
Audit Page (app/audit/[reportId]/page.tsx)
  │  Polls GET /api/audit/{reportId} until done/failed
  │  Shows progress → lead gate → full report
  ▼
Lead Capture (POST /api/lead)
  │  Saves email, marks report.lead_captured=true
  ▼
Full Report Unlocked ─── score ring, category radar, top 3 fixes, findings
```

### Frontend / Backend Split

- **Frontend:** All pages are React Server Components or client components in `app/`. No separate SPA — everything is Next.js App Router.
- **Backend:** All API routes live under `app/api/`. No Express, no separate server. Vercel serverless functions.
- **Database:** Supabase Postgres accessed via `@supabase/supabase-js` service role key (server-side only). No client-side Supabase access.
- **Queue:** No external queue service. The `reports` table itself is the queue (status column: `queued` → `running` → `done`/`failed`). Vercel Cron calls `/api/audit/process` every minute as a heartbeat.

---

## 3. Folder Structure

```
crosignal/
├── app/                          # Next.js App Router (pages + API)
│   ├── globals.css               # Tailwind v4 + CSS variables + animations
│   ├── layout.tsx                # Root layout: fonts, SEO metadata, Plausible
│   ├── page.tsx                  # Landing page (URL input, feature grid)
│   ├── robots.ts                 # robots.txt (allow /, disallow /api, /admin)
│   ├── sitemap.ts                # Sitemap (/ and /pricing)
│   ├── admin/
│   │   └── page.tsx              # Admin dashboard (analytics, leads, exports)
│   ├── audit/
│   │   └── [reportId]/
│   │       ├── layout.tsx        # Dynamic OG metadata per report
│   │       └── page.tsx          # Report viewer (polling, lead gate, results)
│   ├── pricing/
│   │   └── page.tsx              # Pricing tiers + waitlist capture
│   └── api/
│       ├── admin/
│       │   ├── analytics/route.ts  # Metrics, trends, top domains
│       │   ├── data/route.ts       # Feature + optimization requests
│       │   ├── export/route.ts     # CSV export (reports or leads)
│       │   └── login/route.ts      # Admin password auth → cookie
│       ├── audit/
│       │   ├── start/route.ts      # Queue-only: validate → insert → trigger
│       │   ├── process/route.ts    # Worker: claim → scrape → AI → save
│       │   └── [reportId]/route.ts # Report status + data (lead-gated)
│       ├── feature-request/route.ts    # Store unlock/pdf/waitlist interest
│       ├── health/route.ts             # Supabase + OpenAI health check
│       ├── lead/route.ts               # Lead capture (email + consent)
│       └── optimization-request/route.ts # Consultation request storage
├── src/
│   ├── components/
│   │   ├── CROSignalLogo.tsx     # SVG signal-wave logo (sm/md/lg)
│   │   └── PlausibleScript.tsx   # Env-gated Plausible analytics script
│   └── lib/
│       ├── analytics.ts          # Provider-agnostic event tracking (9 events)
│       ├── database.types.ts     # Full Supabase typed schema (5 tables)
│       ├── openai.ts             # AI pipeline: prompt, schema, validate, repair
│       ├── rateLimit.ts          # IP-based rate limiting (50/day, SHA-256)
│       ├── scraper.ts            # Playwright-first + Cheerio fallback
│       ├── supabase.ts           # Singleton Supabase client
│       ├── types.ts              # Core types: PageType, AuditStatus, etc.
│       └── validators.ts         # URL/email validation, SSRF protection
├── public/                       # Static assets
├── docs/                         # Project documentation (this folder)
├── vercel.json                   # Cron: /api/audit/process every minute
├── next.config.ts                # serverExternalPackages: ["playwright"]
├── tsconfig.json                 # Strict TS, bundler resolution, @/* alias
├── eslint.config.mjs             # ESLint 9 flat config
├── postcss.config.mjs            # PostCSS with Tailwind v4
└── package.json                  # 7 prod deps, 8 dev deps
```

---

## 4. Database Schema (Supabase Postgres)

### 4.1 `reports`

The central table. Each audit creates one row. Also serves as the queue.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` (PK) | Auto-generated |
| `created_at` | `timestamptz` | Default `now()` |
| `url` | `text` | Normalized URL |
| `page_type` | `text` | `product` / `home` / `cart` / `other` |
| `status` | `text` | `queued` → `running` → `done` / `failed` |
| `error` | `text` | Error message if failed |
| `detected_platform` | `text` | `shopify` / `woocommerce` / `unknown` |
| `scraped_json` | `jsonb` | Full `ScrapedPage` object |
| `result_json` | `jsonb` | Full `AuditReport` object |
| `lead_captured` | `boolean` | `true` after email submitted |
| `ip_hash` | `text` | SHA-256 hash for rate limiting |
| `used_mock` | `boolean` | `true` if mock report was used |

**Indexes:** `created_at DESC`, `status`, `ip_hash`

### 4.2 `leads`

Email captures tied to reports.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` (PK) | Auto-generated |
| `created_at` | `timestamptz` | Default `now()` |
| `report_id` | `uuid` (FK) | References `reports.id` (cascade delete) |
| `email` | `text` | Validated email |
| `consent` | `boolean` | Marketing consent |

**Indexes:** `created_at DESC`, `email`

### 4.3 `rate_limits`

IP-based sliding window rate limits.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` (PK) | Auto-generated |
| `created_at` | `timestamptz` | Default `now()` |
| `key` | `text` | SHA-256 of IP address (unique index) |
| `count` | `int` | Request count in window |
| `reset_at` | `timestamptz` | Window expiry time |

**Indexes:** Unique on `key`

### 4.4 `feature_requests`

Tracks interest in future features.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` (PK) | Auto-generated |
| `created_at` | `timestamptz` | Default `now()` |
| `type` | `text` | `unlock_full_audit` / `pdf_interest` / `waitlist` |
| `email` | `text` | User email |
| `report_id` | `uuid` (FK) | Optional, references `reports.id` (set null on delete) |
| `store_url` | `text` | Optional store URL |

**Indexes:** `created_at DESC`, `email`

### 4.5 `optimization_requests`

Consultation / managed optimization requests.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` (PK) | Auto-generated |
| `created_at` | `timestamptz` | Default `now()` |
| `name` | `text` | Contact name |
| `email` | `text` | Contact email |
| `store_url` | `text` | Optional |
| `monthly_traffic` | `text` | `<10k` / `10k-50k` / `50k-100k` / `100k+` / `unknown` |
| `revenue_range` | `text` | Optional |
| `challenge` | `text` | Optional description |
| `report_id` | `uuid` (FK) | Optional, references `reports.id` (set null on delete) |

**Indexes:** `created_at DESC`

---

## 5. Feature Breakdown

### 5.1 URL Scraping (`src/lib/scraper.ts`)

Two-strategy scraper that extracts 30+ conversion-relevant signals from any ecommerce page.

**Strategy 1 — Playwright (primary):**
- Mobile User-Agent simulation (iPhone 14)
- `networkidle` wait for full page render
- Full DOM access for dynamic content

**Strategy 2 — Cheerio (fallback):**
- Raw HTTP fetch + HTML parse
- Handles Playwright failures gracefully
- Faster but misses JS-rendered content

**Signals extracted:**
- Title, meta description, OG tags, canonical URL, viewport meta
- H1/H2 headings, CTA buttons (regex-matched), price elements
- Shipping/returns mentions, trust signals (guarantee, secure, etc.)
- Image count + alt-text stats, word count, above-fold text sample
- Internal/external link counts, platform detection (Shopify/WooCommerce)
- Boilerplate stripping (removes nav, footer, header, script, style)

### 5.2 AI Analysis (`src/lib/openai.ts`)

OpenAI gpt-4o-mini with **structured JSON output** enforced via JSON Schema.

**System prompt** instructs the model to act as a "senior CRO strategist" with rules:
- Evidence-only findings (no fabrication)
- Platform-specific tips (Shopify, WooCommerce)
- Confidence levels: `high` / `medium` / `low`
- Must score 6 categories: CRO, Trust & Social Proof, Copywriting, Mobile UX, Page Speed, SEO

**Output structure (`AuditReport`):**
- `overall_score` (0–100)
- `category_scores` (6 categories, each 0–100 with summary)
- `top_fixes` (3 highest-impact recommendations)
- `findings` (8–12 items, each with severity, evidence, where_to_fix, what_to_change, recommendation, estimated_effort)

**Resilience chain:**
1. Attempt structured output → validate shape
2. If invalid → repair prompt (asks model to fix its own JSON)
3. If repair fails → mock report fallback (8 findings across all categories)
4. 429/quota errors → immediate mock fallback

### 5.3 Queue System (`app/api/audit/start` + `app/api/audit/process`)

No external queue service. Uses **Supabase-as-queue** pattern:

**Start route (`/api/audit/start`):**
1. Validate URL + page type
2. SSRF check (private IPs, blocked hostnames, DNS resolution)
3. Rate limit (50/day per IP, SHA-256 hashed)
4. 24h cache check (reuse existing report for same normalized URL)
5. INSERT row with `status = "queued"`
6. Fire-and-forget `POST /api/audit/process` (non-blocking)
7. Return `{ reportId }` immediately

**Process route (`/api/audit/process`):**
1. **Recover stuck reports** — any report `running` for >5 minutes → re-queue
2. **Atomic claim** — `UPDATE status = "running" WHERE status = "queued" LIMIT 1`
3. Scrape → AI → save result → `status = "done"`
4. On error → `status = "failed"` with error message

**Safety net:** Vercel Cron calls `/api/audit/process` every minute. Even if the fire-and-forget fails (e.g., cold start timeout), the cron picks up queued items.

### 5.4 Lead Capture Gate

Reports are **partially visible** (score + category scores) until the user submits their email. Full findings, top fixes, and recommendations are gated.

- `POST /api/lead` — validates email, rate-limits, inserts lead, marks `report.lead_captured = true`
- `GET /api/audit/{reportId}` — returns partial data if `lead_captured = false`, full data if `true`

### 5.5 Admin Dashboard (`app/admin/page.tsx`)

Password-protected analytics dashboard with 3 tabs:

1. **Overview** — 6 metric cards (total audits, unique domains, completed, leads, conversion rate, failure rate) + SVG bar chart for daily/weekly trends
2. **Leads & Requests** — Tables for leads, feature requests, optimization requests
3. **Top Domains** — Ranked horizontal bar visualization

Additional features:
- Date range filtering (from/to)
- CSV export (reports or leads)
- Authentication via `ADMIN_PASSWORD` env var → `admin_ok` cookie (6h TTL, httpOnly)

### 5.6 Analytics (`src/lib/analytics.ts`)

Provider-agnostic event tracking abstraction with 9 typed events:

| Event | Trigger |
|-------|---------|
| `url_entered` | User types a URL |
| `audit_started` | Audit is submitted |
| `audit_completed` | Report finishes successfully |
| `audit_failed` | Report fails |
| `lead_captured` | Email submitted |
| `report_viewed` | Report page loaded |
| `resend_clicked` | Share panel used |
| `waitlist_joined` | Pricing waitlist signup |
| `cta_clicked` | Any CTA button clicked |

**Providers:**
- **Production:** Plausible (loaded via `PlausibleScript` component, gated on `NEXT_PUBLIC_PLAUSIBLE_DOMAIN`)
- **Development:** Console logging

### 5.7 SEO (`app/layout.tsx`, `app/sitemap.ts`, `app/robots.ts`)

- Root layout: Full `<head>` metadata — title template, description, OG, Twitter card, canonical, keywords, robots
- Dynamic audit metadata: `app/audit/[reportId]/layout.tsx` generates per-report OG tags (domain + score)
- Sitemap: Static for `/` and `/pricing`
- Robots: Allow indexing of public pages, block `/api/` and `/admin/`
- JSON-LD structured data on landing page

### 5.8 Error Recovery UX

Failed audits show a friendly error panel with:
- Human-readable error message (not raw stack traces)
- Retry button (re-submits the same URL)
- Contact support email link
- Clear visual state (red tone, distinct from loading)

### 5.9 Share & Report Distribution

- **Copy Link** — copies report URL to clipboard with feedback toast
- **Web Share API** — native OS share sheet on supported browsers/devices
- No email sending (removed — was initially a fake placeholder)

---

## 6. Security & Performance

### 6.1 Input Validation (`src/lib/validators.ts`)

- **URL normalization** — auto-prepends `https://` if missing, strips trailing slashes
- **SSRF protection** — blocks private IPv4 ranges (10.x, 172.16–31.x, 192.168.x, 127.x), private IPv6 (::1, fc00::, fe80::), blocked hostnames (localhost, .local, .internal), DNS resolution check (resolves hostname and verifies IP is public)
- **Email validation** — regex-based format check

### 6.2 Rate Limiting (`src/lib/rateLimit.ts`)

- IP-based, 50 requests per 24h sliding window
- IP addresses are **SHA-256 hashed** with configurable salt (`IP_HASH_SALT`) before storage
- Stored in Supabase `rate_limits` table
- Applied on `/api/audit/start` and `/api/lead`

### 6.3 Authentication

- Admin dashboard: simple password auth via `ADMIN_PASSWORD` env var
- Login sets `admin_ok` httpOnly cookie, 6-hour TTL, sameSite: lax
- All admin API routes verify cookie before responding

### 6.4 Caching

- 24h URL deduplication: before creating a new audit, checks if a `done` report exists for the same normalized URL within 24 hours
- If found, returns the existing `reportId` instantly (no re-scraping or AI cost)

### 6.5 Data Privacy

- No client-side Supabase access (service role key server-side only)
- IP hashing with salt (raw IPs never stored)
- Plausible analytics is GDPR-friendly (no cookies, no personal data)
- Report pages are `noindex` (only landing + pricing are indexed)

---

## 7. Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SUPABASE_URL` | Yes | Supabase project URL (format: `https://<id>.supabase.co`) |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role key (server-side only) |
| `OPENAI_API_KEY` | Yes* | OpenAI API key. If missing, mock mode activates |
| `IP_HASH_SALT` | Yes | Random string for hashing IP addresses |
| `ADMIN_PASSWORD` | Yes | Password for admin dashboard login |
| `USE_MOCK_AI` | No | Set `true` to force mock reports (useful for dev) |
| `NEXT_PUBLIC_BASE_URL` | No | Base URL for internal API calls (defaults to relative) |
| `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` | No | Plausible domain to enable analytics |
| `CRON_SECRET` | No | Vercel Cron auth token for `/api/audit/process` |

---

## 8. Current MVP Limitations

These are known constraints of the v0.1.0 MVP. They are **intentional scope boundaries**, not bugs.

| Limitation | Context |
|------------|---------|
| Single-page audits only | Multi-page crawl planned for Pro tier |
| No user accounts | All audits are anonymous; lead capture is the auth substitute |
| No email delivery | Reports are shared via link/web-share only |
| No PDF export | Planned for Pro tier (waitlist captures interest) |
| No Stripe billing | Pricing page is waitlist-only |
| Simple admin auth | Cookie-based password; no RBAC or multi-user |
| No background workers | Queue uses Supabase + cron, not a dedicated worker service |
| No test suite | No unit/integration/e2e tests yet |
| Cold start latency | First Playwright run on serverless can be slow (~5-8s) |
| 50 audits/day rate limit | Per-IP, may be too restrictive for shared IPs |

---

## 9. Design System

### Color Palette

| Token | Light | Dark |
|-------|-------|------|
| `--background` | `#f7f4ef` (warm cream) | `#0f1115` |
| `--foreground` | `#14120f` | `#f5f2ec` |
| `--surface` | `#ffffff` | `#151922` |
| `--surface-muted` | `#f2ede4` | `#1a1f2a` |
| `--accent` | `#f05b2a` (signal orange) | `#ff7a45` |
| `--accent-2` | `#1d4ed8` (blue) | `#60a5fa` |
| `--border` | `#e4ddd1` | `#2a3140` |

### Typography

- **Sans:** Sora — UI, headings, buttons
- **Serif:** Spectral — report body text, findings

### Animation Classes

- `.animate-rise` — Slide up + fade in (0.7s)
- `.animate-fade` — Fade in (0.5s)
- `.animate-pop` — Pop in with slight scale (0.25s)
- `.float-slow` — Gentle float (6s infinite)
- `.grid-glow` — Radial gradient background decorations
- `.grain::before` — SVG noise texture overlay
- `.soft-halo` — Glowing box shadow

### Logo

`CROSignalLogo` component — SVG signal-wave logomark (center dot + concentric arcs) inside an accent-colored rounded square. Available in sm (32px), md (40px), lg (48px). Optional `linkHome` prop wraps in anchor tag.

---

## 10. API Route Summary

| Method | Route | Auth | Purpose |
|--------|-------|------|---------|
| `POST` | `/api/audit/start` | — | Start new audit (queue-only) |
| `GET/POST` | `/api/audit/process` | CRON_SECRET (optional) | Queue worker (claim + process) |
| `GET` | `/api/audit/[reportId]` | — | Report status + data (lead-gated) |
| `POST` | `/api/lead` | — | Email capture |
| `POST` | `/api/feature-request` | — | Store feature interest |
| `POST` | `/api/optimization-request` | — | Consultation request |
| `GET` | `/api/health` | — | System health check |
| `POST` | `/api/admin/login` | — | Admin authentication |
| `GET` | `/api/admin/analytics` | `admin_ok` cookie | Metrics + trends |
| `GET` | `/api/admin/data` | `admin_ok` cookie | Feature + optimization requests |
| `GET` | `/api/admin/export` | `admin_ok` cookie | CSV export |

---

## 11. Future Roadmap

### Short-Term (Next Sprint)

- Email delivery via Resend for report notifications
- PDF report export (client-side or server-side generation)
- Stripe integration for Pro tier billing
- Basic test suite (API routes + critical flows)

### Premium Evolution

- Multi-page crawl (homepage + product + cart in one audit)
- Historical comparison (track score changes over time)
- Competitor benchmarking
- Custom AI prompts per industry vertical
- White-label reports for agencies
- Priority queue for paid users

### Scaling Considerations

- Move from Supabase-as-queue to dedicated queue (QStash, Inngest, or BullMQ) when volume exceeds ~1000 audits/day
- Playwright browser pooling or managed browser service (Browserbase, Browserless)
- Edge caching for report pages
- Move admin to proper RBAC with NextAuth/Clerk
- Add OpenTelemetry for observability

### Monetization Path

1. **Free MVP** → lead generation engine (current)
2. **Pro tier** ($49/mo) → multi-page, PDF, history, priority
3. **Enterprise** (custom) → white-label, API, managed CRO
4. **Managed optimization** → done-for-you service (captured via optimization requests)

---

## 12. Key Code Patterns

### Singleton Supabase Client

```typescript
// src/lib/supabase.ts
let cached: SupabaseClient | null = null;
export function getSupabaseAdmin() { /* returns cached or creates new */ }
```

### Atomic Queue Claim

```typescript
// Prevents double-processing: only one worker can claim a row
const { data } = await supabase
  .from("reports")
  .update({ status: "running" })
  .eq("status", "queued")
  .order("created_at", { ascending: true })
  .limit(1)
  .select()
  .single();
```

### AI Output Validation & Repair

```typescript
// 1. Parse structured JSON → 2. Validate shape → 3. Repair prompt → 4. Mock fallback
const result = await analyzeWithAI(scrapedData, pageType);
// analyzeWithAI internally handles: attempt → repair → mock chain
```

### Provider-Agnostic Analytics

```typescript
// src/lib/analytics.ts
trackEvent("audit_started", { url, pageType });
// Resolves to Plausible in prod, console.log in dev
```

### Fire-and-Forget Pattern

```typescript
// /api/audit/start — triggers worker without waiting
void fetch(`${baseUrl}/api/audit/process`, { method: "POST" }).catch(() => {});
// Cron safety net picks up anything the fire-and-forget misses
```

---

*This document is the single source of truth for the CROSignal project. Update it when architecture, schema, or key patterns change.*
