import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/src/lib/supabase";
import { validateEmail } from "@/src/lib/validators";
import type { Database } from "@/src/lib/database.types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const supabase = getSupabaseAdmin();
    const body = (await request.json()) as {
      name?: string;
      email?: string;
      storeUrl?: string;
      monthlyTraffic?: "<10k" | "10k-50k" | "50k-100k" | "100k+";
      revenueRange?: string;
      challenge?: string;
      reportId?: string;
    };

    if (!body?.name || !body.email || !body.monthlyTraffic) {
      return NextResponse.json(
        { error: "Name, email, and traffic are required." },
        { status: 400 }
      );
    }

    const { email, isValid } = validateEmail(body.email);
    if (!isValid) {
      return NextResponse.json({ error: "Invalid email." }, { status: 400 });
    }

    const { error } = await supabase
      .from("optimization_requests")
      .insert({
        name: body.name.trim(),
        email,
        store_url: body.storeUrl ? body.storeUrl.trim() : null,
        monthly_traffic: body.monthlyTraffic,
        revenue_range: body.revenueRange || null,
        challenge: body.challenge || null,
        report_id: body.reportId || null,
      } satisfies Database["public"]["Tables"]["optimization_requests"]["Insert"]);

    if (error) {
      return NextResponse.json(
        { error: error.message || "Unable to save request." },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
