import type { Metadata } from "next";
import { getSupabaseAdmin } from "@/src/lib/supabase";
import type { Database } from "@/src/lib/database.types";
import type { AuditReport } from "@/src/lib/types";

type ReportRow = Database["public"]["Tables"]["reports"]["Row"];

export async function generateMetadata({
  params,
}: {
  params: Promise<{ reportId: string }>;
}): Promise<Metadata> {
  const { reportId } = await params;

  const fallback: Metadata = {
    title: "Audit Report",
    description:
      "AI-powered CRO audit report with prioritized fixes for your ecommerce store.",
    robots: { index: false, follow: true },
  };

  if (!reportId) return fallback;

  try {
    const supabase = getSupabaseAdmin();
    const { data } = await supabase
      .from("reports")
      .select("url,page_type,status,result_json")
      .eq("id", reportId)
      .maybeSingle<ReportRow>();

    if (!data) return fallback;

    const score =
      data.status === "done" && data.result_json
        ? (data.result_json as AuditReport).overall_score
        : null;

    const domain = data.url
      ? (() => {
          try {
            return new URL(data.url).hostname.replace(/^www\./, "");
          } catch {
            return null;
          }
        })()
      : null;

    const title = score
      ? `${domain ?? "Audit"} scored ${score}/100 — CRO Report`
      : `CRO Audit Report${domain ? ` for ${domain}` : ""}`;

    const description = score
      ? `CROSignal audited ${domain ?? "this store"} and scored it ${score}/100. See prioritized fixes for conversion, trust, copy, and mobile UX.`
      : `AI-powered CRO audit${domain ? ` for ${domain}` : ""}. Get prioritized conversion optimization fixes.`;

    return {
      title,
      description,
      robots: { index: false, follow: true },
      openGraph: {
        title: `${title} | CROSignal`,
        description,
        url: `https://crosignal.com/audit/${reportId}`,
      },
      twitter: {
        card: "summary",
        title: `${title} | CROSignal`,
        description,
      },
    };
  } catch {
    return fallback;
  }
}

export default function AuditLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
