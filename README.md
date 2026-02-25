# AI Ecommerce Conversion Doctor

MVP Next.js app that audits a single ecommerce page URL and returns a structured CRO report using OpenAI.

## Features

- URL audit (Shopify/WooCommerce or any ecommerce page)
- Overall score + category scores
- Top 3 prioritized fixes
- 8-12 detailed findings
- Lead capture gate before unlocking results
- Supabase storage for reports and leads
- Simple IP and email rate limiting (3 audits per 24h)

## Tech Stack

- Next.js 14+ (App Router)
- TypeScript + Tailwind
- OpenAI API (structured JSON)
- Playwright with fetch + cheerio fallback
- Supabase Postgres

## Local Setup (Windows Friendly)

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
	ip_hash text null
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
	type text not null check (type in ('unlock_full_audit','pdf_interest')),
	email text not null,
	report_id uuid null references public.reports(id) on delete set null,
	store_url text null
);

create index if not exists idx_feature_requests_created_at on public.feature_requests (created_at desc);
create index if not exists idx_feature_requests_email on public.feature_requests (email);
create index if not exists idx_feature_requests_type on public.feature_requests (type);

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
create index if not exists idx_optimization_requests_email on public.optimization_requests (email);
create index if not exists idx_optimization_requests_report_id on public.optimization_requests (report_id);
```

4) Run the dev server

```bash
npm run dev
```

Optional: if you want Playwright to run locally, install its browsers once:

```bash
npx playwright install
```

Open http://localhost:3000

## Test Mode

If `OPENAI_API_KEY` is missing, the app returns a mocked report to keep the MVP usable.

## Notes

- Playwright is used when available. If it fails, the scraper falls back to fetch + cheerio.
- For production, move the audit processor to a background job queue.
