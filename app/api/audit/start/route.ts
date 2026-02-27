import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/src/lib/supabase";
import { generateReport } from "@/src/lib/openai";
import { scrapePage } from "@/src/lib/scraper";
import { checkRateLimit, hashIp } from "@/src/lib/rateLimit";
import { validateUrl, normalizeUrl } from "@/src/lib/validators";
import type { Database } from "@/src/lib/database.types";
import type { PageType } from "@/src/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const allowedPageTypes: PageType[] = ["product", "home", "cart", "other"];
type ReportRow = Database["public"]["Tables"]["reports"]["Row"];

const CACHE_WINDOW_HOURS = 24;

/* ────────────────────────── helpers ────────────────────────── */

const getClientIp = (request: Request) => {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }
  return request.headers.get("x-real-ip") || "unknown";
};

/**
 * Normalize URL for cache lookups – strip trailing slash, lowercase host,
 * remove common tracking params.
 */
const normalizeCacheUrl = (url: string): string => {
  try {
    const parsed = new URL(url);
    parsed.hostname = parsed.hostname.toLowerCase();
    // Remove common tracking params
    for (const p of [
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_content",
      "utm_term",
      "fbclid",
      "gclid",
      "ref",
    ]) {
      parsed.searchParams.delete(p);
    }
    let path = parsed.pathname.replace(/\/+$/, "") || "/";
    parsed.pathname = path;
    return parsed.toString();
  } catch {
    return url;
  }
};

/* ────────────────────────── user-friendly errors ────────────────────────── */

const userFriendlyError = (message: string): string => {
  if (message.includes("relation") && message.includes("does not exist")) {
    return "Our database is being set up. Please try again in a few minutes.";
  }
  if (message.includes("rate limit") || message.includes("rate_limits")) {
    return "You've reached the daily audit limit. Please try again tomorrow.";
  }
  if (message.includes("fetch failed") || message.includes("ENOTFOUND")) {
    return "We couldn't reach that URL. Please check it and try again.";
  }
  if (message.includes("timeout") || message.includes("ETIMEDOUT")) {
    return "The page took too long to load. Please try again or use a different URL.";
  }
  return "Something went wrong. Please try again later.";
};

/* ────────────────────────── process audit ────────────────────────── */

const processAudit = async (
  reportId: string,
  url: string,
  pageType: PageType,
  useLiveAudit: boolean
) => {
  const supabase = getSupabaseAdmin();
  await supabase
    .from("reports")
    .update({ status: "running" })
    .eq("id", reportId);

  try {
    const scraped = await scrapePage(url);
    await supabase
      .from("reports")
      .update({ scraped_json: scraped })
      .eq("id", reportId);

    const { report, usedMock } = await generateReport(scraped, pageType, {
      useLiveAudit,
    });

    await supabase
      .from("reports")
      .update({ status: "done", result_json: report, used_mock: usedMock })
      .eq("id", reportId);
  } catch (error) {
    const rawMsg = error instanceof Error ? error.message : "Audit failed";
    await supabase
      .from("reports")
      .update({
        status: "failed",
        error: userFriendlyError(rawMsg),
      })
      .eq("id", reportId);
  }
};

/* ────────────────────────── POST handler ────────────────────────── */

export async function POST(request: Request) {
  try {
    const supabase = getSupabaseAdmin();
    const body = (await request.json()) as {
      url?: string;
      pageType?: PageType;
      useLiveAudit?: boolean;
      forceRefresh?: boolean;
    };

    if (!body?.url || !body.pageType) {
      return NextResponse.json(
        { error: "Please provide a URL and select a page type." },
        { status: 400 }
      );
    }

    if (!allowedPageTypes.includes(body.pageType)) {
      return NextResponse.json(
        { error: "That page type isn't supported yet." },
        { status: 400 }
      );
    }

    const validation = await validateUrl(body.url);
    if (!validation.ok) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    const ip = getClientIp(request);
    const ipHash = hashIp(ip);
    const rateKey = `ip:${ipHash}`;

    let rateLimit;
    try {
      rateLimit = await checkRateLimit(rateKey);
    } catch (rateError) {
      const message =
        rateError instanceof Error ? rateError.message : "Rate limit failed";
      console.error("[audit/start] rate limit error", message);
      return NextResponse.json(
        { error: userFriendlyError(message) },
        { status: 500 }
      );
    }

    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: `You've reached the daily audit limit (${rateLimit.remaining === 0 ? "0" : rateLimit.remaining} remaining). Resets at ${rateLimit.resetAt.toISOString()}.`,
        },
        { status: 429 }
      );
    }

    /* ── cache check: reuse recent report for same normalized URL ── */
    const cacheUrl = normalizeCacheUrl(validation.normalized);
    if (!body.forceRefresh) {
      const cutoff = new Date(
        Date.now() - CACHE_WINDOW_HOURS * 60 * 60 * 1000
      ).toISOString();

      const { data: cached } = await supabase
        .from("reports")
        .select("id, status")
        .eq("url", cacheUrl)
        .eq("page_type", body.pageType)
        .gte("created_at", cutoff)
        .in("status", ["done", "running", "queued"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle<Pick<ReportRow, "id" | "status">>();

      if (cached?.id) {
        return NextResponse.json({ reportId: cached.id, cached: true });
      }
    }

    /* ── create new report ── */
    const { data, error } = await supabase
      .from("reports")
      .insert({
        url: cacheUrl,
        page_type: body.pageType,
        status: "queued",
        lead_captured: false,
        ip_hash: ipHash,
      })
      .select("id")
      .single<ReportRow>();

    if (error || !data) {
      console.error("[audit/start] insert error", error?.message);
      return NextResponse.json(
        { error: userFriendlyError(error?.message || "Unable to create report.") },
        { status: 500 }
      );
    }

    void processAudit(
      data.id,
      validation.normalized,
      body.pageType,
      Boolean(body.useLiveAudit)
    );

    return NextResponse.json({ reportId: data.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    console.error("[audit/start] failure", message);
    return NextResponse.json(
      { error: userFriendlyError(message) },
      { status: 500 }
    );
  }
}
