import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/src/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const isMissingTableError = (message: string) => {
  return message.includes("does not exist") && message.includes("relation");
};

export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let supabaseConnected = false;
  let tablesReachable = false;

  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("reports").select("id").limit(1);

    if (!error) {
      supabaseConnected = true;
      tablesReachable = true;
    } else if (isMissingTableError(error.message)) {
      supabaseConnected = true;
      tablesReachable = false;
    } else {
      supabaseConnected = false;
      tablesReachable = false;
    }
  } catch {
    supabaseConnected = false;
    tablesReachable = false;
  }

  return NextResponse.json({ supabaseConnected, tablesReachable });
}
