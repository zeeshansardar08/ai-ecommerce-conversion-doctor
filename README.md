# CROSignal

AI-powered conversion rate optimization audits for ecommerce stores. Paste a URL, get a scored report with prioritized fixes in ~60 seconds.

**Domain:** [CROSignal.com](https://crosignal.com)

## Features

- URL audit (Shopify, WooCommerce, or any ecommerce page)
- Overall score + category scores (CRO, Trust, Copy, Mobile UX, Performance, SEO)
- Top 3 prioritized fixes with evidence and location
- 8–12 detailed findings with confidence levels
- Lead capture gate before unlocking full results
- Waitlist capture for Pro/Agency plan
- 24h report caching per normalized URL
- Supabase storage for reports, leads, and feature requests
- IP-based rate limiting (50 audits per 24h)
- Admin dashboard for leads and requests

## Tech Stack

- Next.js 16 (App Router)
- TypeScript + Tailwind CSS v4
- OpenAI API (structured JSON with retry + repair)
- Playwright with fetch + cheerio fallback
- Supabase Postgres

## Local Setup

1) Install dependencies

```bash
npm install
```

2) Create a `.env.local` file

```
OPENAI_API_KEY=your_key
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
IP_HASH_SALT=any_random_string
USE_MOCK_AI=false
ADMIN_PASSWORD=your_admin_password
```

Restart the dev server after changing environment variables.

3) Create Supabase tables (SQL)

```sql
create extension if not exists "pgcrypto";

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

create table if not exists public.leads (
	id uuid primary key default gen_random_uuid(),
	created_at timestamptz not null default now(),
	report_id uuid not null references public.reports(id) on delete cascade,
	email text not null,
	consent boolean not null default false
);

create index if not exists idx_leads_created_at on public.leads (created_at desc);
create index if not exists idx_leads_email on public.leads (email);

create table if not exists public.rate_limits (
	id uuid primary key default gen_random_uuid(),
	created_at timestamptz not null default now(),
	key text not null,
	count int not null default 0,
	reset_at timestamptz not null
);

create unique index if not exists uq_rate_limits_key on public.rate_limits (key);

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

4) Run the dev server

```bash
npm run dev
```

Optional: install Playwright browsers once for live scraping:

```bash
npx playwright install
```

Open http://localhost:3000

## How It Works

1. User pastes a store URL and selects page type
2. Scraper crawls the page mobile-first (Playwright → cheerio fallback)
3. OpenAI analyzes 15+ signals and returns a structured JSON report
4. Report is shown after email capture (lead gate)
5. If JSON is invalid, repair prompt is attempted; falls back to mock if needed

## Health Check

`GET /api/health` — Returns Supabase connectivity, table access, and OpenAI key status.

## Mock Mode

If `OPENAI_API_KEY` is missing or `USE_MOCK_AI=true`, the app returns a sample report. Useful for local development and demos.

## Roadmap (Post-MVP)

- Email delivery (Resend)
- User authentication (NextAuth/Clerk)
- Stripe billing for Pro plan
- Multi-page audits
- PDF report export
- Background job queue for audits
- Analytics dashboard
