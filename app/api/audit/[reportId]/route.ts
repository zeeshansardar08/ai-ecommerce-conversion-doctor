import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/src/lib/supabase";
import type { Database } from "@/src/lib/database.types";
import type { AuditReport } from "@/src/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ reportId?: string }> }
) {
  const supabase = getSupabaseAdmin();
  const resolvedParams = await params;
  const reportId = resolvedParams?.reportId;

  type ReportRow = Database["public"]["Tables"]["reports"]["Row"];

  if (!reportId) {
    return NextResponse.json({ error: "Missing report id." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("reports")
    .select(
      "id,status,error,result_json,lead_captured,url,page_type,created_at"
    )
    .eq("id", reportId)
    .maybeSingle<ReportRow>();

  if (error) {
    return NextResponse.json(
      { error: error.message || "Unable to fetch report." },
      { status: 500 }
    );
  }

  if (!data) {
    return NextResponse.json({ error: "Report not found." }, { status: 404 });
  }

  let report: AuditReport | null = null;
  if (data.status === "done" && data.result_json) {
    if (data.lead_captured) {
      report = data.result_json as AuditReport;
    } else {
      const partial = data.result_json as AuditReport;
      report = {
        overall_score: partial.overall_score,
        category_scores: partial.category_scores,
        top_fixes: [],
        findings: [],
      };
    }
  }

  return NextResponse.json({
    status: data.status,
    error: data.error,
    report,
    leadCaptured: data.lead_captured,
    url: data.url,
    pageType: data.page_type,
  });
}
