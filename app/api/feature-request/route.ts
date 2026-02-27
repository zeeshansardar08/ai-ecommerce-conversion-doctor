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
      type?: "unlock_full_audit" | "pdf_interest" | "waitlist";
      email?: string;
      reportId?: string;
      storeUrl?: string;
    };

    if (!body?.type || !body.email) {
      return NextResponse.json(
        { error: "Type and email are required." },
        { status: 400 }
      );
    }

    const { email, isValid } = validateEmail(body.email);
    if (!isValid) {
      return NextResponse.json({ error: "Invalid email." }, { status: 400 });
    }

    const { error } = await supabase
      .from("feature_requests")
      .insert({
        type: body.type,
        email,
        report_id: body.reportId || null,
        store_url: body.storeUrl || null,
      } satisfies Database["public"]["Tables"]["feature_requests"]["Insert"]);

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
