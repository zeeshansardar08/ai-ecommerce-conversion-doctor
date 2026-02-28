# CROSignal — Developer Guide

> How to extend, modify, and debug the CROSignal codebase.
> Read [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md) first for architecture and schema context.

---

## Table of Contents

1. [How Audits Work Internally](#1-how-audits-work-internally)
2. [Scraper Architecture & Fallback](#2-scraper-architecture--fallback)
3. [AI Prompt Structure](#3-ai-prompt-structure)
4. [Adding New Scraper Signals](#4-adding-new-scraper-signals)
5. [Modifying the AI Report Schema](#5-modifying-the-ai-report-schema)
6. [Queue System Internals](#6-queue-system-internals)
7. [Admin Dashboard & Metrics](#7-admin-dashboard--metrics)
8. [Analytics Events](#8-analytics-events)
9. [Adding New API Routes](#9-adding-new-api-routes)
10. [Adding Premium Feature Gating](#10-adding-premium-feature-gating)
11. [Environment & Configuration](#11-environment--configuration)
12. [Common Debugging Scenarios](#12-common-debugging-scenarios)
13. [Code Conventions](#13-code-conventions)

---

## 1. How Audits Work Internally

An audit flows through 4 phases, spanning 2 API routes and 3 status transitions:

### Phase 1: Submission (`POST /api/audit/start`)

**File:** `app/api/audit/start/route.ts`

```
Client POST { url, pageType }
  → Validate URL format + page type
  → SSRF check (validators.ts: isPrivateUrl + DNS resolution)
  → Rate limit check (rateLimit.ts: 50/day per hashed IP)
  → Cache check: SELECT from reports WHERE url = normalized AND status = "done" AND age < 24h
    → If cache hit: return existing reportId (no re-processing)
  → INSERT into reports (status: "queued", ip_hash, url, page_type)
  → Fire-and-forget: POST /api/audit/process (void, non-blocking)
  → Return { reportId } to client immediately
```

The client is redirected to `/audit/{reportId}` and begins polling.

### Phase 2: Processing (`POST|GET /api/audit/process`)

**File:** `app/api/audit/process/route.ts`

```
Recover stuck: UPDATE reports SET status = "queued" WHERE status = "running" AND created_at < 5min ago
  → Atomic claim: UPDATE reports SET status = "running" WHERE status = "queued" ORDER BY created_at LIMIT 1
    → If no rows: exit (nothing queued)
  → Scrape URL (scraper.ts)
  → Save scraped_json
  → Analyze with AI (openai.ts)
  → Save result_json, detected_platform, status = "done"
  → On error: status = "failed", error = message
```

The **atomic claim** is critical — it prevents two concurrent workers (fire-and-forget + cron) from processing the same report. Only one `UPDATE ... WHERE status = "queued"` can succeed per row.

### Phase 3: Polling (`GET /api/audit/{reportId}`)

**File:** `app/api/audit/[reportId]/route.ts`

The audit page polls this endpoint every 2 seconds. It returns:
- `status`: `queued` / `running` / `done` / `failed`
- **If `done` and `lead_captured = false`:** partial data (overall_score + category_scores only)
- **If `done` and `lead_captured = true`:** full report (all findings, top fixes, recommendations)
- **If `failed`:** error message for display

### Phase 4: Lead Gate (`POST /api/lead`)

**File:** `app/api/lead/route.ts`

After the user submits their email:
1. Validate email format
2. Rate limit check
3. Insert into `leads` table
4. `UPDATE reports SET lead_captured = true WHERE id = reportId`
5. Client re-fetches — now gets full report data

---

## 2. Scraper Architecture & Fallback

**File:** `src/lib/scraper.ts` (~287 lines)

### Two-Strategy Design

```
scrapePage(url)
  → Try scrapeWithPlaywright(url)
    → Success? Return ScrapedPage
    → Failed? Log error, try scrapeWithCheerio(url)
      → Success? Return ScrapedPage
      → Failed? Throw error (audit fails)
```

### Playwright Strategy (Primary)

- Launches headless Chromium with **mobile User-Agent** (iPhone 14)
- Navigates with `networkidle` wait (waits for network to be idle)
- Extracts content from fully-rendered DOM (handles JS-rendered pages)
- **Pros:** Handles SPAs, dynamic content, JS-rendered prices
- **Cons:** Slower (~3-8s), resource-heavy on serverless

### Cheerio Strategy (Fallback)

- Simple HTTP fetch of the URL
- Parses raw HTML with Cheerio (jQuery-like API)
- **Pros:** Fast (~1-2s), lightweight
- **Cons:** Misses JS-rendered content (most modern Shopify/Next.js stores)

### Signal Extraction (shared between strategies)

Both strategies extract the same 30+ signals into the `ScrapedPage` type:

| Signal Group | Fields |
|--------------|--------|
| Meta | title, metaDescription, ogTitle, ogDescription, ogImage, canonical, viewport |
| Headings | h1 (array), h2 (array) |
| Content | wordCount, aboveFoldText, bodyTextSample |
| CTA | ctaButtons (text of button-like elements, regex-matched) |
| Commerce | prices (array), hasShippingInfo, hasReturnPolicy |
| Trust | trustSignals (guarantee, secure, reviews, etc.) |
| Images | imageCount, imagesWithoutAlt |
| Links | internalLinkCount, externalLinkCount |
| Platform | detectedPlatform (shopify / woocommerce / unknown) |

### Boilerplate Stripping

Before extracting body text, both strategies strip these elements:
- `<nav>`, `<footer>`, `<header>` (navigation chrome)
- `<script>`, `<style>`, `<noscript>` (code/styling)

This ensures the AI analyzes only the meaningful content of the page.

---

## 3. AI Prompt Structure

**File:** `src/lib/openai.ts` (~450 lines)

### System Prompt

The system prompt establishes the AI as a "senior CRO strategist" with strict rules:

```
You are a senior conversion rate optimization strategist. Given scraped data
from an ecommerce page, produce a JSON audit report. Rules:
- Only cite evidence found in the scraped data (no fabrication)
- Provide platform-specific tips when platform is detected
- Assign confidence: high (clear evidence), medium (likely), low (inferred)
- Score 6 categories: CRO, Trust & Social Proof, Copywriting, Mobile UX, Page Speed, SEO
- Each finding must include where_to_fix and what_to_change
- Generate 8-12 findings across multiple categories
```

### User Prompt

The user prompt is built dynamically from `ScrapedPage` data:

```
Analyze this {pageType} page:
URL: {url}
Platform: {detectedPlatform}
Title: {title}
... (all scraped signals, trimmed to control token count)
```

Large fields (bodyTextSample, aboveFoldText) are **truncated** to prevent exceeding token limits.

### JSON Schema Enforcement

The OpenAI API is called with `response_format: { type: "json_schema", json_schema: { ... } }`. This forces the model to output JSON matching the exact `AuditReport` structure. The schema includes:

- `overall_score`: integer 0–100
- `category_scores`: array of 6 objects (name, score, summary)
- `top_fixes`: array of 3 objects (title, impact, recommendation)
- `findings`: array of 8–12 objects (id, title, category, severity, impact, confidence, evidence, where_to_fix, what_to_change, recommendation, estimated_effort)

### Resilience Chain

```
Attempt 1: Structured output
  → Parse JSON
  → Validate shape (check required fields exist)
  → If valid: return AuditReport ✓
  → If invalid shape:
    Attempt 2: Repair prompt
      → Send broken JSON + "Fix this JSON to match the schema"
      → Parse + validate
      → If valid: return AuditReport ✓
      → If still invalid:
        Attempt 3: Mock fallback
          → createMockReport() — 8 findings, realistic scores
          → Report is flagged: used_mock = true
  → On 429 / quota error: immediate mock fallback
```

### Modifying the System Prompt

To change how the AI evaluates pages:

1. Edit the `SYSTEM_PROMPT` constant in `src/lib/openai.ts`
2. Keep the rules about evidence-based findings — the AI tends to hallucinate without them
3. If you add new categories, update the `JSON_SCHEMA` constant and the `AuditReport` type in `src/lib/types.ts`

---

## 4. Adding New Scraper Signals

To add a new piece of data extraction from pages:

### Step 1: Add to the type

In `src/lib/types.ts`, add the field to `ScrapedPage`:

```typescript
export interface ScrapedPage {
  // ... existing fields
  myNewSignal: string | null;    // Add your field
}
```

### Step 2: Extract in the scraper

In `src/lib/scraper.ts`, add extraction logic to **both** strategies:

```typescript
// In scrapeWithPlaywright — uses page.evaluate()
const myNewSignal = await page.evaluate(() => {
  const el = document.querySelector('.my-selector');
  return el?.textContent?.trim() || null;
});

// In scrapeWithCheerio — uses $ (Cheerio API)
const myNewSignal = $('.my-selector').text().trim() || null;
```

Add the field to the returned `ScrapedPage` object in both functions.

### Step 3: Include in the AI prompt

In `src/lib/openai.ts`, add the signal to `buildUserPrompt()`:

```typescript
function buildUserPrompt(scraped: ScrapedPage, pageType: PageType): string {
  // ... existing prompt parts
  if (scraped.myNewSignal) {
    parts.push(`My New Signal: ${scraped.myNewSignal}`);
  }
  return parts.join('\n');
}
```

### Step 4: Update the system prompt (optional)

If you want the AI to specifically comment on the new signal, add instructions to `SYSTEM_PROMPT`.

### Step 5: Update database types (optional)

If the signal is stored in `scraped_json`, the existing `jsonb` column handles it automatically. No migration needed.

---

## 5. Modifying the AI Report Schema

To change the structure of what the AI outputs:

### Step 1: Update the TypeScript type

In `src/lib/types.ts`, modify `AuditReport`:

```typescript
export interface AuditReport {
  overall_score: number;
  category_scores: CategoryScore[];
  top_fixes: TopFix[];
  findings: Finding[];
  // Add new fields here
  my_new_section: MyNewSection;
}
```

### Step 2: Update the JSON Schema

In `src/lib/openai.ts`, modify `JSON_SCHEMA` to match:

```typescript
const JSON_SCHEMA = {
  // ... existing schema
  properties: {
    // ... existing properties
    my_new_section: {
      type: "object",
      properties: { /* ... */ },
      required: [ /* ... */ ],
    },
  },
  required: [...existingRequired, "my_new_section"],
};
```

### Step 3: Update the mock report

In `src/lib/openai.ts`, update `createMockReport()` to include the new section, so mock mode doesn't break.

### Step 4: Update the report UI

In `app/audit/[reportId]/page.tsx`, add rendering for the new section.

### Step 5: Update validation

In `src/lib/openai.ts`, update the shape validation that checks parsed AI output.

> **Important:** The `result_json` column is `jsonb` — no migration needed for schema changes. However, old reports in the database won't have new fields. Handle `undefined` gracefully in the UI.

---

## 6. Queue System Internals

**Files:** `app/api/audit/start/route.ts`, `app/api/audit/process/route.ts`, `vercel.json`

### Why Supabase-as-Queue?

- Zero new dependencies
- Free (uses existing Supabase instance)
- Simple: the `reports.status` column IS the queue state
- Works on Vercel serverless (no persistent connections needed)

### Queue State Machine

```
queued ──(claim)──→ running ──(success)──→ done
                        │
                        └──(error)──→ failed
                        │
                        └──(stuck >5min)──→ queued (re-queue)
```

### Atomic Claims

The `process` route uses an atomic `UPDATE ... WHERE status = "queued"` to claim work:

```typescript
const { data: report } = await supabase
  .from("reports")
  .update({ status: "running" })
  .eq("status", "queued")
  .order("created_at", { ascending: true })
  .limit(1)
  .select()
  .single();
```

If two workers race, only one will get a row — Postgres guarantees the `UPDATE` is atomic.

### Stuck Recovery

If a worker crashes mid-processing, the report stays `running` forever. The `process` route starts by recovering stuck reports:

```typescript
await supabase
  .from("reports")
  .update({ status: "queued" })
  .eq("status", "running")
  .lt("created_at", fiveMinutesAgo);
```

### Dual Trigger

1. **Fire-and-forget**: `/api/audit/start` sends a non-blocking `POST /api/audit/process` after inserting the queued row. This gives near-instant processing.
2. **Cron safety net**: `vercel.json` configures `* * * * *` (every minute). If the fire-and-forget fails (cold start, timeout, error), the cron picks it up within 60 seconds.

### Adding a Dedicated Queue (Future)

When volume exceeds ~1000 audits/day, consider:
- **QStash** (Upstash) — HTTP-based, free tier, Vercel-native
- **Inngest** — event-driven, built for Next.js
- **BullMQ** — Redis-backed, needs persistent connection

Migration path: replace the `INSERT + fire-and-forget` in `/start` with a queue publish, and replace `/process` with a queue consumer.

---

## 7. Admin Dashboard & Metrics

**Files:** `app/admin/page.tsx`, `app/api/admin/analytics/route.ts`, `app/api/admin/data/route.ts`, `app/api/admin/export/route.ts`

### Authentication Flow

1. User enters password on `/admin`
2. `POST /api/admin/login` — compares against `ADMIN_PASSWORD` env var
3. On success: sets `admin_ok` cookie (httpOnly, sameSite: lax, 6h TTL)
4. All admin API routes check this cookie

### Computed Metrics

The `/api/admin/analytics` route computes from raw data:

| Metric | Computation |
|--------|-------------|
| Total Audits | `COUNT(reports)` |
| Unique Domains | `COUNT(DISTINCT hostname)` (computed in JS) |
| Completed | `COUNT(reports WHERE status = "done")` |
| Total Leads | `COUNT(leads)` |
| Conversion Rate | `leads / completed * 100` |
| Failure Rate | `failed / total * 100` |

### Adding New Metrics

1. Add computation in `app/api/admin/analytics/route.ts` — all reports and leads are already fetched
2. Add the metric to the JSON response
3. Add a new metric card in `app/admin/page.tsx`

### Charts

Charts are **pure SVG** — no charting library. The admin page renders SVG `<rect>` bars manually, computing widths/heights from data. To change chart style, edit the SVG rendering in the admin page component.

### CSV Export

`GET /api/admin/export?type=reports` or `?type=leads` returns a CSV file with `Content-Disposition: attachment` header.

---

## 8. Analytics Events

**File:** `src/lib/analytics.ts`

### Adding a New Event

1. Add the event name to the type union in `analytics.ts`
2. Call `trackEvent("my_new_event", { optional_props })` in your component
3. Event goes to Plausible (prod) or console (dev) automatically

### Provider Pattern

```typescript
type AnalyticsProvider = {
  trackEvent: (name: string, props?: Record<string, string>) => void;
};

// Plausible provider (production)
const plausibleProvider: AnalyticsProvider = {
  trackEvent: (name, props) => window.plausible?.(name, { props }),
};

// Console provider (development)
const consoleProvider: AnalyticsProvider = {
  trackEvent: (name, props) => console.log(`[Analytics] ${name}`, props),
};
```

### Adding a New Provider

1. Implement the `AnalyticsProvider` interface
2. Call `setAnalyticsProvider(myProvider)` at app initialization
3. All `trackEvent` calls will route to your provider

---

## 9. Adding New API Routes

All API routes live under `app/api/`. Next.js App Router convention:

```
app/api/my-feature/route.ts  →  /api/my-feature
```

### Template

```typescript
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/src/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Validate input
    if (!body.requiredField) {
      return NextResponse.json(
        { error: "requiredField is required" },
        { status: 400 }
      );
    }

    // Database operation
    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from("my_table")
      .insert({ field: body.requiredField });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
```

### Patterns Used Across Routes

- `runtime = "nodejs"` — required for Playwright and crypto
- `dynamic = "force-dynamic"` — prevents caching of API responses
- Rate limiting: import `checkRateLimit` from `@/src/lib/rateLimit`
- IP extraction: `request.headers.get("x-forwarded-for")?.split(",")[0]`
- Admin auth: check `cookies().get("admin_ok")?.value === "true"`

---

## 10. Adding Premium Feature Gating

Currently, all features are free. To add premium gating:

### Lead-Gate Pattern (existing)

The report already uses a gate — `lead_captured` controls data visibility. This pattern can be extended:

```typescript
// In /api/audit/[reportId]/route.ts
if (!report.lead_captured) {
  // Return partial data
  return NextResponse.json({
    status: report.status,
    partial: { overall_score, category_scores },
  });
}
// Return full data
return NextResponse.json({ status: report.status, report: fullData });
```

### Premium Gate (future)

To add a paid tier:

1. **Add `tier` column to reports** — `free` / `pro` / `enterprise`
2. **Add user/subscription table** — linked to Stripe customer ID
3. **Gate in API routes:**
   ```typescript
   if (report.tier === "free") {
     // Return limited findings (e.g., top 3 only)
   } else {
     // Return all findings
   }
   ```
4. **Gate in UI** — show upgrade prompts for locked sections
5. **Feature request tracking** — already captures `unlock_full_audit` and `pdf_interest` via `/api/feature-request`

### Adding Stripe

Recommended approach:
1. Create `app/api/stripe/webhook/route.ts` for Stripe webhooks
2. Create `app/api/stripe/checkout/route.ts` for creating checkout sessions
3. Store `stripe_customer_id` and `subscription_status` on a users table
4. Check subscription status in API routes before returning premium data

---

## 11. Environment & Configuration

### Next.js Config (`next.config.ts`)

```typescript
const nextConfig: NextConfig = {
  serverExternalPackages: ["playwright"],
};
```

`serverExternalPackages` tells Next.js to not bundle Playwright into the client — it's server-only.

### TypeScript Config (`tsconfig.json`)

- **Strict mode** enabled
- **Path alias:** `@/*` maps to project root (e.g., `@/src/lib/openai`)
- **Target:** ES2017 (async/await native)
- **Module resolution:** bundler (Next.js standard)

### Tailwind CSS v4

- Configuration is in `app/globals.css` via `@theme inline { ... }`
- No separate `tailwind.config.js` — Tailwind v4 uses CSS-based config
- Custom colors are CSS variables mapped to Tailwind tokens
- Dark mode: `prefers-color-scheme: dark` (automatic)

### Vercel Cron (`vercel.json`)

```json
{
  "crons": [
    {
      "path": "/api/audit/process",
      "schedule": "* * * * *"
    }
  ]
}
```

Vercel's cron sends a GET request to this path. The `process` route accepts both GET and POST.

---

## 12. Common Debugging Scenarios

### "Audit stuck in queued state"

1. Check if the `process` route is being triggered — look at Vercel function logs
2. If `CRON_SECRET` is set, verify Vercel Cron is configured with the same secret
3. Manually trigger: `curl -X POST https://your-domain.com/api/audit/process`
4. Check Supabase: `SELECT * FROM reports WHERE status = 'queued' ORDER BY created_at`

### "Audit stuck in running state"

1. The worker crashed mid-processing
2. Wait up to 5 minutes — the stuck recovery logic will re-queue it
3. Or manually: `UPDATE reports SET status = 'queued' WHERE status = 'running' AND id = '...'`

### "AI returns mock report in production"

1. Check `OPENAI_API_KEY` is set correctly in Vercel env vars
2. Check OpenAI billing — 429 errors trigger mock fallback
3. Check Vercel function logs for "quota" or "rate limit" errors
4. Reports with `used_mock = true` in the database used mock mode

### "Scraper returns empty data"

1. The site may block headless browsers — Cheerio fallback may also fail
2. Check if the URL is reachable from a server (CDN issues, geo-blocking)
3. Playwright may not be installed: run `npx playwright install`
4. On Vercel, Playwright browsers are bundled automatically

### "Admin dashboard shows no data"

1. Check `ADMIN_PASSWORD` is set in env vars
2. Clear cookies and re-login
3. Check Supabase connection: `GET /api/health`
4. Verify date range filter isn't excluding all data

### "Rate limit hit during testing"

1. Rate limit is per IP, 50/day
2. Check Supabase: `SELECT * FROM rate_limits ORDER BY created_at DESC`
3. Delete the rate limit row for your IP hash to reset
4. Or increase the limit in `src/lib/rateLimit.ts` (the `MAX_REQUESTS` constant)

### Local Development Tips

- Set `USE_MOCK_AI=true` to skip OpenAI calls
- The mock report is realistic (8 findings) — useful for UI development
- Playwright requires browser binaries: `npx playwright install`
- Check system health: `http://localhost:3000/api/health`

---

## 13. Code Conventions

### File Organization

- **Pages:** `app/` directory, one folder per route
- **API routes:** `app/api/`, one folder per endpoint
- **Shared logic:** `src/lib/` for all shared utilities
- **Components:** `src/components/` for shared React components
- **Types:** Central types in `src/lib/types.ts`; database types in `src/lib/database.types.ts`

### Naming

- Files: `camelCase.ts` for lib files, `PascalCase.tsx` for components
- Routes: `kebab-case` for URL paths (e.g., `feature-request`)
- Types: `PascalCase` for interfaces and type aliases
- Constants: `UPPER_SNAKE_CASE` for module-level constants

### Error Handling

- API routes: always return structured JSON errors with appropriate HTTP status codes
- Try/catch at route level — never let unhandled errors reach the client
- Scraper/AI: use fallback chains (Playwright → Cheerio, AI → repair → mock)
- Frontend: error boundaries via error recovery UX (retry button, support link)

### Imports

- Use `@/` path alias for all imports from project root
- Example: `import { getSupabaseAdmin } from "@/src/lib/supabase"`

### Runtime Directives

All API routes explicitly set:
```typescript
export const runtime = "nodejs";    // Required for Playwright, crypto
export const dynamic = "force-dynamic"; // Prevent response caching
```

---

*For architecture details, database schema, and feature breakdown, see [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md).*
