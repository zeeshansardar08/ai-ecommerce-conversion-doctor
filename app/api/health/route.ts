import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/src/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const isMissingTableError = (message: string) =>
  message.includes("does not exist") && message.includes("relation");

export async function GET() {
  const status: Record<string, unknown> = {
    ok: true,
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV,
    supabase_connected: false,
    tables: {
      reports: false,
      rate_limits: false,
      leads: false,
    },
    openai_key_set: Boolean(process.env.OPENAI_API_KEY),
  };

  try {
    const supabase = getSupabaseAdmin();

    // Check reports table
    const { error: reportsErr } = await supabase
      .from("reports")
      .select("id")
      .limit(1);
    if (!reportsErr) {
      status.supabase_connected = true;
      (status.tables as Record<string, boolean>).reports = true;
    } else if (isMissingTableError(reportsErr.message)) {
      status.supabase_connected = true;
    }

    // Check rate_limits table
    const { error: rlErr } = await supabase
      .from("rate_limits")
      .select("id")
      .limit(1);
    if (!rlErr) {
      (status.tables as Record<string, boolean>).rate_limits = true;
    }

    // Check leads table
    const { error: leadsErr } = await supabase
      .from("leads")
      .select("id")
      .limit(1);
    if (!leadsErr) {
      (status.tables as Record<string, boolean>).leads = true;
    }
  } catch (err) {
    status.ok = false;
    status.supabase_connected = false;
    status.error =
      err instanceof Error ? err.message : "Failed to connect to Supabase";
  }

  // Mark overall status
  const tables = status.tables as Record<string, boolean>;
  if (!tables.reports || !tables.rate_limits) {
    status.ok = false;
  }

  const httpStatus = status.ok ? 200 : 503;
  return NextResponse.json(status, { status: httpStatus });
}
