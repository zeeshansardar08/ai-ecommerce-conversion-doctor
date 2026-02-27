import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSupabaseAdmin } from "@/src/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ───────────────── helpers ───────────────── */

function dayKey(iso: string): string {
  return iso.slice(0, 10); // "2026-02-28"
}

function weekKey(iso: string): string {
  const d = new Date(iso);
  const jan1 = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(
    ((d.getTime() - jan1.getTime()) / 86_400_000 + jan1.getDay() + 1) / 7
  );
  return `${d.getFullYear()}-W${String(week).padStart(2, "0")}`;
}

function domainFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/* ───────────────── route ───────────────── */

export async function GET(request: Request) {
  const cookieStore = await cookies();
  if (cookieStore.get("admin_ok")?.value !== "true") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from"); // ISO date string
  const to = searchParams.get("to"); // ISO date string

  const supabase = getSupabaseAdmin();

  /* ── fetch reports ── */
  let reportsQuery = supabase
    .from("reports")
    .select("id,created_at,url,status,lead_captured,used_mock,error")
    .order("created_at", { ascending: false });

  if (from) reportsQuery = reportsQuery.gte("created_at", from);
  if (to) reportsQuery = reportsQuery.lte("created_at", to + "T23:59:59.999Z");

  const { data: reports, error: reportsErr } = await reportsQuery;
  if (reportsErr) {
    return NextResponse.json({ error: reportsErr.message }, { status: 500 });
  }

  /* ── fetch leads ── */
  let leadsQuery = supabase
    .from("leads")
    .select("id,created_at,email,report_id")
    .order("created_at", { ascending: false });

  if (from) leadsQuery = leadsQuery.gte("created_at", from);
  if (to) leadsQuery = leadsQuery.lte("created_at", to + "T23:59:59.999Z");

  const { data: leads, error: leadsErr } = await leadsQuery;
  if (leadsErr) {
    return NextResponse.json({ error: leadsErr.message }, { status: 500 });
  }

  /* ── compute metrics ── */
  const allReports = reports ?? [];
  const allLeads = leads ?? [];

  const totalAudits = allReports.length;
  const completed = allReports.filter((r) => r.status === "done").length;
  const failed = allReports.filter((r) => r.status === "failed").length;
  const failureRate = totalAudits > 0 ? Math.round((failed / totalAudits) * 100) : 0;

  const uniqueDomains = new Set(allReports.map((r) => domainFromUrl(r.url)));
  const uniqueDomainCount = uniqueDomains.size;

  const totalLeads = allLeads.length;
  const conversionRate =
    completed > 0 ? Math.round((totalLeads / completed) * 100) : 0;

  /* ── top requested domains ── */
  const domainCounts: Record<string, number> = {};
  for (const r of allReports) {
    const d = domainFromUrl(r.url);
    domainCounts[d] = (domainCounts[d] || 0) + 1;
  }
  const topDomains = Object.entries(domainCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([domain, count]) => ({ domain, count }));

  /* ── daily trend ── */
  const dailyMap: Record<string, { audits: number; leads: number; failures: number }> = {};
  for (const r of allReports) {
    const dk = dayKey(r.created_at);
    if (!dailyMap[dk]) dailyMap[dk] = { audits: 0, leads: 0, failures: 0 };
    dailyMap[dk].audits++;
    if (r.status === "failed") dailyMap[dk].failures++;
  }
  for (const l of allLeads) {
    const dk = dayKey(l.created_at);
    if (!dailyMap[dk]) dailyMap[dk] = { audits: 0, leads: 0, failures: 0 };
    dailyMap[dk].leads++;
  }
  const dailyTrend = Object.entries(dailyMap)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, v]) => ({ date, ...v }));

  /* ── weekly trend ── */
  const weeklyMap: Record<string, { audits: number; leads: number; failures: number }> = {};
  for (const r of allReports) {
    const wk = weekKey(r.created_at);
    if (!weeklyMap[wk]) weeklyMap[wk] = { audits: 0, leads: 0, failures: 0 };
    weeklyMap[wk].audits++;
    if (r.status === "failed") weeklyMap[wk].failures++;
  }
  for (const l of allLeads) {
    const wk = weekKey(l.created_at);
    if (!weeklyMap[wk]) weeklyMap[wk] = { audits: 0, leads: 0, failures: 0 };
    weeklyMap[wk].leads++;
  }
  const weeklyTrend = Object.entries(weeklyMap)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([week, v]) => ({ week, ...v }));

  return NextResponse.json({
    metrics: {
      totalAudits,
      uniqueDomains: uniqueDomainCount,
      completed,
      totalLeads,
      conversionRate,
      failureRate,
      failed,
    },
    topDomains,
    dailyTrend,
    weeklyTrend,
  });
}
