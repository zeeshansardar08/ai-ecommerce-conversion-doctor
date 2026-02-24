import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/src/lib/supabase";
import { checkRateLimit } from "@/src/lib/rateLimit";
import { validateEmail } from "@/src/lib/validators";
import type { Database } from "@/src/lib/database.types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const supabase = getSupabaseAdmin();
    const body = (await request.json()) as {
      reportId?: string;
      email?: string;
      consent?: boolean;
    };

    if (!body?.reportId || !body.email) {
      return NextResponse.json(
        { error: "Report ID and email are required." },
        { status: 400 }
      );
    }

    if (!body.consent) {
      return NextResponse.json(
        { error: "Consent is required to unlock the report." },
        { status: 400 }
      );
    }

    const { email, isValid } = validateEmail(body.email);
    if (!isValid) {
      return NextResponse.json({ error: "Invalid email." }, { status: 400 });
    }

    const rateKey = `email:${email}`;
    const rateLimit = await checkRateLimit(rateKey);

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Daily email audit limit reached." },
        { status: 429 }
      );
    }

    const { error } = await supabase
      .from("leads")
      .insert({
      report_id: body.reportId,
      email,
      consent: Boolean(body.consent),
      } satisfies Database["public"]["Tables"]["leads"]["Insert"]);

    if (error) {
      return NextResponse.json(
        { error: error.message || "Unable to save lead." },
        { status: 500 }
      );
    }

    const { error: updateError } = await supabase
      .from("reports")
      .update({ lead_captured: true })
      .eq("id", body.reportId);

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message || "Unable to unlock report." },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
