# CROSignal

**AI-powered conversion rate optimization audits for ecommerce stores.**
Paste a URL, get a scored report with prioritized fixes in ~60 seconds.

[![Next.js](https://img.shields.io/badge/Next.js-16.1.6-black)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue)](https://typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-38bdf8)](https://tailwindcss.com)
[![License](https://img.shields.io/badge/license-proprietary-red)](#license)

**Live:** [crosignal.com](https://crosignal.com)

---

## What It Does

CROSignal audits any ecommerce page (Shopify, WooCommerce, or custom) and produces an evidence-based CRO report:

- **Overall score** (0–100) across 6 categories: CRO, Trust & Social Proof, Copywriting, Mobile UX, Page Speed, SEO
- **Top 3 prioritized fixes** with expected impact
- **8–12 detailed findings** with severity, confidence, evidence, and specific recommendations
- **Lead capture gate** — partial score visible free, full report unlocked after email
- **Admin dashboard** — analytics, lead management, CSV exports

## Core Flow

```
URL submitted → SSRF check → rate limit → queue insert
       ↓
Playwright scrape (30+ signals) → Cheerio fallback
       ↓
OpenAI gpt-4o-mini analysis → structured JSON → validate → repair → mock fallback
       ↓
Report stored → polling → lead gate → full results
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16.1.6 (App Router) |
| Language | TypeScript (strict mode) |
| Styling | Tailwind CSS v4 + CSS variables |
| Database | Supabase Postgres (5 tables) |
| AI | OpenAI gpt-4o-mini (structured JSON output) |
| Scraping | Playwright 1.54 + Cheerio fallback |
| Analytics | Plausible (GDPR-friendly, env-gated) |
| Queue | Supabase-as-queue + Vercel Cron |
| Hosting | Vercel (serverless) |

## Project Structure

```
app/
├── page.tsx                    # Landing page
├── pricing/page.tsx            # Pricing tiers + waitlist
├── admin/page.tsx              # Analytics dashboard
├── audit/[reportId]/page.tsx   # Report viewer
└── api/
    ├── audit/start/            # Queue-only entry point
    ├── audit/process/          # Queue worker
    ├── audit/[reportId]/       # Report data (lead-gated)
    ├── lead/                   # Email capture
    ├── health/                 # System health check
    ├── admin/{analytics,data,export,login}/
    ├── feature-request/        # Feature interest tracking
    └── optimization-request/   # Consultation requests
src/lib/
├── scraper.ts                  # Playwright + Cheerio (30+ signals)
├── openai.ts                   # AI pipeline + repair + mock fallback
├── validators.ts               # URL/email validation, SSRF protection
├── rateLimit.ts                # IP-based rate limiting (50/day)
├── analytics.ts                # Provider-agnostic event tracking
├── supabase.ts                 # Singleton client
├── types.ts                    # Core TypeScript types
└── database.types.ts           # Supabase schema types
```

> Full folder breakdown: [docs/PROJECT_CONTEXT.md](docs/PROJECT_CONTEXT.md)

## Getting Started

### Prerequisites

- Node.js 18+
- npm
- Supabase project ([supabase.com](https://supabase.com))
- OpenAI API key ([platform.openai.com](https://platform.openai.com))

### 1. Install dependencies

```bash
npm install
```

### 2. Install Playwright browsers

```bash
npx playwright install
```

> Required for live page scraping. Without it, the scraper falls back to Cheerio (HTTP fetch only, no JS-rendered content).

### 3. Configure environment

Create `.env.local`:

```bash
# Required
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
OPENAI_API_KEY=sk-your-openai-key
IP_HASH_SALT=any_random_string_for_hashing
ADMIN_PASSWORD=your_admin_password

# Optional
USE_MOCK_AI=false                          # true = skip OpenAI, return sample report
NEXT_PUBLIC_BASE_URL=http://localhost:3000  # Base URL for internal API calls
NEXT_PUBLIC_PLAUSIBLE_DOMAIN=              # Plausible domain to enable analytics
CRON_SECRET=                               # Vercel Cron authentication token
```

### 4. Set up Supabase tables

Run this SQL in the Supabase SQL Editor:

```sql
create extension if not exists "pgcrypto";

-- Reports (also serves as the audit queue)
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  url text not null,
  page_type text not null check (page_type in ('product','home','cart','other')),
  status text not null default 'queued' check (status in ('queued','running','done','failed')),
  error text null,
  detected_platform text null check (detected_platform in ('shopify','woocommerce','unknown')),
  scraped_json jsonb null,
  result_json jsonb null,
  lead_captured boolean not null default false,
  ip_hash text null,
  used_mock boolean not null default false
);
create index if not exists idx_reports_created_at on public.reports (created_at desc);
create index if not exists idx_reports_status on public.reports (status);
create index if not exists idx_reports_ip_hash on public.reports (ip_hash);

-- Leads
create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  report_id uuid not null references public.reports(id) on delete cascade,
  email text not null,
  consent boolean not null default false
);
create index if not exists idx_leads_created_at on public.leads (created_at desc);
create index if not exists idx_leads_email on public.leads (email);

-- Rate limits
create table if not exists public.rate_limits (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  key text not null,
  count int not null default 0,
  reset_at timestamptz not null
);
create unique index if not exists uq_rate_limits_key on public.rate_limits (key);

-- Feature requests
create table if not exists public.feature_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  type text not null check (type in ('unlock_full_audit','pdf_interest','waitlist')),
  email text not null,
  report_id uuid null references public.reports(id) on delete set null,
  store_url text null
);
create index if not exists idx_feature_requests_created_at on public.feature_requests (created_at desc);
create index if not exists idx_feature_requests_email on public.feature_requests (email);

-- Optimization requests
create table if not exists public.optimization_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null,
  email text not null,
  store_url text null,
  monthly_traffic text not null check (monthly_traffic in ('<10k','10k-50k','50k-100k','100k+','unknown')),
  revenue_range text null,
  challenge text null,
  report_id uuid null references public.reports(id) on delete set null
);
create index if not exists idx_optimization_requests_created_at on public.optimization_requests (created_at desc);
```

### 5. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Mock Mode

Set `USE_MOCK_AI=true` or omit `OPENAI_API_KEY` to use mock reports. The app generates a realistic sample report with 8 findings across all 6 categories — no API costs.

## Health Check

```
GET /api/health
```

Returns Supabase connectivity, table existence, and OpenAI key status. Use this to verify deployment.

## Deployment (Vercel)

1. Connect your GitHub repo to Vercel
2. Set all environment variables in Vercel dashboard
3. Playwright browsers are installed automatically on Vercel (serverless)
4. Vercel Cron is configured in `vercel.json` — processes the audit queue every minute

> **Important:** Set `CRON_SECRET` in Vercel and configure it in Vercel's Cron settings to secure the queue endpoint.

## Security

- **SSRF protection** — blocks private IPs, localhost, .local, .internal; resolves DNS before scraping
- **IP hashing** — SHA-256 with salt; raw IPs never stored
- **Rate limiting** — 50 audits/day per IP via Supabase
- **Input validation** — URL normalization, email format check
- **No client-side secrets** — Supabase service key is server-only
- **Admin auth** — httpOnly cookie, 6h TTL

## Documentation

| Document | Description |
|----------|-------------|
| [docs/PROJECT_CONTEXT.md](docs/PROJECT_CONTEXT.md) | Architecture, schema, features, patterns — the complete knowledge base |
| [docs/DEVELOPER_GUIDE.md](docs/DEVELOPER_GUIDE.md) | How to extend, modify, and debug the codebase |

## Roadmap

- [ ] Email delivery (Resend) for report notifications
- [ ] PDF report export
- [ ] Stripe billing for Pro tier
- [ ] Multi-page audits
- [ ] User authentication (NextAuth/Clerk)
- [ ] Historical score tracking
- [ ] Test suite (API + E2E)

## License

Proprietary. All rights reserved.
