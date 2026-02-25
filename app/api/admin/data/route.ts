import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSupabaseAdmin } from "@/src/lib/supabase";
import type { Database } from "@/src/lib/database.types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const cookieStore = await cookies();
  const isAuthed = cookieStore.get("admin_ok")?.value === "true";

  if (!isAuthed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();

  const { data: optimizationRequests, error: optError } = await supabase
    .from("optimization_requests")
    .select(
      "id,created_at,name,email,store_url,monthly_traffic,revenue_range,report_id"
    )
    .order("created_at", { ascending: false });

  if (optError) {
    return NextResponse.json(
      { error: optError.message || "Unable to load optimization requests." },
      { status: 500 }
    );
  }

  const { data: featureRequests, error: featureError } = await supabase
    .from("feature_requests")
    .select("id,created_at,type,email,store_url,report_id")
    .order("created_at", { ascending: false });

  if (featureError) {
    return NextResponse.json(
      { error: featureError.message || "Unable to load feature requests." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    optimizationRequests: optimizationRequests || [],
    featureRequests: featureRequests || [],
  });
}
