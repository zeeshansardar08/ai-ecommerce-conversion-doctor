import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/src/lib/supabase";
import { generateReport } from "@/src/lib/openai";
import { scrapePage } from "@/src/lib/scraper";
import type { Database } from "@/src/lib/database.types";
import type { PageType } from "@/src/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Maximum number of reports to process per invocation.
 * Keeps execution within serverless function time limits.
 */
const BATCH_SIZE = 1;

/**
 * Reports stuck in "running" for longer than this (ms) are
 * considered dead and get re-queued for another attempt.
 */
const STUCK_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

type ReportRow = Database["public"]["Tables"]["reports"]["Row"];

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

/* ────────────────────────── recover stuck reports ────────────────────────── */

async function recoverStuckReports() {
  const supabase = getSupabaseAdmin();
  const cutoff = new Date(Date.now() - STUCK_THRESHOLD_MS).toISOString();

  // Find reports stuck in "running" beyond the threshold
  const { data: stuck } = await supabase
    .from("reports")
    .select("id")
    .eq("status", "running")
    .lt("created_at", cutoff)
    .limit(5);

  if (!stuck || stuck.length === 0) return 0;

  // Re-queue them so the next run picks them up
  for (const row of stuck) {
    await supabase
      .from("reports")
      .update({ status: "queued", error: null })
      .eq("id", row.id)
      .eq("status", "running"); // double-check status hasn't changed
    console.log(`[audit/process] recovered stuck report ${row.id}`);
  }

  return stuck.length;
}

/* ────────────────────────── claim & process one report ────────────────────────── */

async function claimAndProcess(): Promise<{
  processed: boolean;
  reportId?: string;
  error?: string;
}> {
  const supabase = getSupabaseAdmin();

  // 1. Find the oldest queued report
  const { data: queued } = await supabase
    .from("reports")
    .select("id, url, page_type")
    .eq("status", "queued")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle<Pick<ReportRow, "id" | "url" | "page_type">>();

  if (!queued) {
    return { processed: false };
  }

  // 2. Atomically claim it by setting status to "running"
  //    The .eq("status", "queued") ensures no other worker grabs it
  const { data: claimed, error: claimError } = await supabase
    .from("reports")
    .update({ status: "running" })
    .eq("id", queued.id)
    .eq("status", "queued") // atomic: only if still queued
    .select("id")
    .maybeSingle<Pick<ReportRow, "id">>();

  if (claimError || !claimed) {
    // Another worker already claimed it — not an error
    return { processed: false };
  }

  // 3. Process: scrape → AI → save
  try {
    console.log(`[audit/process] processing ${claimed.id} (${queued.url})`);

    const scraped = await scrapePage(queued.url);
    await supabase
      .from("reports")
      .update({ scraped_json: scraped })
      .eq("id", claimed.id);

    const { report, usedMock } = await generateReport(
      scraped,
      queued.page_type as PageType,
      { useLiveAudit: true }
    );

    await supabase
      .from("reports")
      .update({ status: "done", result_json: report, used_mock: usedMock })
      .eq("id", claimed.id);

    console.log(`[audit/process] completed ${claimed.id}`);
    return { processed: true, reportId: claimed.id };
  } catch (error) {
    const rawMsg = error instanceof Error ? error.message : "Audit failed";
    console.error(`[audit/process] failed ${claimed.id}:`, rawMsg);

    await supabase
      .from("reports")
      .update({
        status: "failed",
        error: userFriendlyError(rawMsg),
      })
      .eq("id", claimed.id);

    return { processed: true, reportId: claimed.id, error: rawMsg };
  }
}

/* ────────────────────────── POST / GET handler ────────────────────────── */

/**
 * Queue worker endpoint.
 *
 * Called by:
 *  1. Fire-and-forget from /api/audit/start (immediate processing)
 *  2. Vercel Cron every minute (safety net for missed/stuck reports)
 *
 * Accepts both GET (cron) and POST (programmatic trigger).
 */
async function handler(request: Request) {
  // Optional: Verify cron secret in production
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    // If CRON_SECRET is set, only allow authorized calls
    // Skip check if CRON_SECRET is not configured (dev mode)
    const origin = request.headers.get("origin") || request.headers.get("referer");
    if (!origin) {
      // External call without auth — reject
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    // Internal call from same origin (fire-and-forget from /start) — allow
  }

  try {
    // Step 1: Recover any stuck reports
    const recovered = await recoverStuckReports();

    // Step 2: Process up to BATCH_SIZE queued reports
    const results: { reportId?: string; error?: string }[] = [];

    for (let i = 0; i < BATCH_SIZE; i++) {
      const result = await claimAndProcess();
      if (!result.processed) break;
      results.push({ reportId: result.reportId, error: result.error });
    }

    return NextResponse.json({
      ok: true,
      recovered,
      processed: results.length,
      results,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Process error";
    console.error("[audit/process] handler error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const GET = handler;
export const POST = handler;
