import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSupabaseAdmin } from "@/src/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function escCsv(val: string | null | undefined): string {
  if (val == null) return "";
  const s = String(val);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export async function GET(request: Request) {
  const cookieStore = await cookies();
  if (cookieStore.get("admin_ok")?.value !== "true") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") ?? "reports";

  const supabase = getSupabaseAdmin();

  if (type === "leads") {
    const { data, error } = await supabase
      .from("leads")
      .select("id,created_at,email,report_id,consent")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const rows = data ?? [];
    const header = "id,created_at,email,report_id,consent";
    const csv =
      header +
      "\n" +
      rows
        .map(
          (r) =>
            `${escCsv(r.id)},${escCsv(r.created_at)},${escCsv(r.email)},${escCsv(r.report_id)},${r.consent}`
        )
        .join("\n");

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="crosignal-leads-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  }

  // Default: reports
  const { data, error } = await supabase
    .from("reports")
    .select("id,created_at,url,page_type,status,lead_captured,detected_platform,used_mock,error")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = data ?? [];
  const header =
    "id,created_at,url,page_type,status,lead_captured,detected_platform,used_mock,error";
  const csv =
    header +
    "\n" +
    rows
      .map(
        (r) =>
          `${escCsv(r.id)},${escCsv(r.created_at)},${escCsv(r.url)},${escCsv(r.page_type)},${escCsv(r.status)},${r.lead_captured},${escCsv(r.detected_platform)},${r.used_mock},${escCsv(r.error)}`
      )
      .join("\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="crosignal-reports-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
