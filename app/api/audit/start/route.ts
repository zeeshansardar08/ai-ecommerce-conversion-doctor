import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/src/lib/supabase";
import { generateReport } from "@/src/lib/openai";
import { scrapePage } from "@/src/lib/scraper";
import { checkRateLimit, hashIp } from "@/src/lib/rateLimit";
import { validateUrl } from "@/src/lib/validators";
import type { Database } from "@/src/lib/database.types";
import type { PageType } from "@/src/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const allowedPageTypes: PageType[] = ["product", "home", "cart", "other"];
type ReportRow = Database["public"]["Tables"]["reports"]["Row"];

const getClientIp = (request: Request) => {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }
  return request.headers.get("x-real-ip") || "unknown";
};

const processAudit = async (
  reportId: string,
  url: string,
  pageType: PageType
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

    const report = await generateReport(scraped, pageType);

    await supabase
      .from("reports")
      .update({ status: "done", result_json: report })
      .eq("id", reportId);
  } catch (error) {
    await supabase
      .from("reports")
      .update({
        status: "failed",
        error: error instanceof Error ? error.message : "Audit failed",
      })
      .eq("id", reportId);
  }
};

export async function POST(request: Request) {
  try {
    console.info("[audit/start] env", {
      hasSupabaseUrl: Boolean(process.env.SUPABASE_URL),
      hasServiceRoleKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
      hasIpSalt: Boolean(process.env.IP_HASH_SALT),
    });

    const supabase = getSupabaseAdmin();
    const body = (await request.json()) as {
      url?: string;
      pageType?: PageType;
    };

    if (!body?.url || !body.pageType) {
      return NextResponse.json(
        { error: "URL and page type are required." },
        { status: 400 }
      );
    }

    if (!allowedPageTypes.includes(body.pageType)) {
      return NextResponse.json(
        { error: "Unsupported page type." },
        { status: 400 }
      );
    }

    const validation = await validateUrl(body.url);
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    console.info("[audit/start] normalized url", validation.normalized);

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
      if (
        message.includes("relation") &&
        message.includes("rate_limits") &&
        message.includes("does not exist")
      ) {
        console.error("[audit/start] rate_limits table missing in Supabase.");
      }
      return NextResponse.json({ error: message }, { status: 500 });
    }

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Daily audit limit reached. Please try again tomorrow." },
        { status: 429 }
      );
    }

    const { data, error } = await supabase
      .from("reports")
      .insert({
        url: validation.normalized,
        page_type: body.pageType,
        status: "queued",
        lead_captured: false,
        ip_hash: ipHash,
      })
      .select("id")
      .single<ReportRow>();

    console.info("[audit/start] insert result", {
      success: Boolean(data?.id) && !error,
      error: error?.message,
    });

    if (error?.message?.includes("relation") &&
        error.message.includes("reports") &&
        error.message.includes("does not exist")) {
      console.error("[audit/start] reports table missing in Supabase.");
    }

    if (error || !data) {
      return NextResponse.json(
        { error: error?.message || "Unable to create report." },
        { status: 500 }
      );
    }

    void processAudit(data.id, validation.normalized, body.pageType);

    return NextResponse.json({ reportId: data.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    console.error("[audit/start] failure", message);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
