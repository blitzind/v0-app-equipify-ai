import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { collectTopIssues } from "@/lib/growth/deliverability/deliverability-dashboard"
import {
  fetchDeliverabilityDashboard,
} from "@/lib/growth/deliverability/deliverability-repository"
import { listDeliverabilityEvents } from "@/lib/growth/deliverability/deliverability-events"
import { isGrowthDnsDeliverabilitySchemaReady } from "@/lib/growth/deliverability/deliverability-schema-health"
import { GROWTH_DNS_DELIVERABILITY_PRIVACY_NOTE } from "@/lib/growth/deliverability/deliverability-types"

export const runtime = "nodejs"

/** DNS & Setup dashboard — separate from reputation protection at `/deliverability/dashboard`. */
export async function GET() {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  if (!(await isGrowthDnsDeliverabilitySchemaReady(access.admin))) {
    return NextResponse.json(
      {
        error: "growth_schema_incomplete",
        message: "Apply migration 20270126120000_growth_dns_deliverability.sql, then reload.",
      },
      { status: 503 },
    )
  }

  try {
    const [dashboard, events] = await Promise.all([
      fetchDeliverabilityDashboard(access.admin),
      listDeliverabilityEvents(access.admin, { limit: 20 }),
    ])
    const domains = await access.admin
      .schema("growth")
      .from("sender_domains")
      .select("id, domain, spf_valid, dkim_valid, dmarc_valid, mx_valid, deliverability_score, health_tier")
      .limit(100)
      .then(({ data }) =>
        (data ?? []).map((row) => ({
          domain_id: String((row as Record<string, unknown>).id),
          domain: String((row as Record<string, unknown>).domain),
          spf_present: Boolean((row as Record<string, unknown>).spf_valid),
          spf_valid: Boolean((row as Record<string, unknown>).spf_valid),
          dkim_present: Boolean((row as Record<string, unknown>).dkim_valid),
          dkim_valid: Boolean((row as Record<string, unknown>).dkim_valid),
          dmarc_present: Boolean((row as Record<string, unknown>).dmarc_valid),
          dmarc_valid: Boolean((row as Record<string, unknown>).dmarc_valid),
          mx_present: Boolean((row as Record<string, unknown>).mx_valid),
          mx_valid: Boolean((row as Record<string, unknown>).mx_valid),
          dns_health_score: Number((row as Record<string, unknown>).deliverability_score ?? 0),
          health_tier: String((row as Record<string, unknown>).health_tier ?? "unknown"),
          deliverability_score: Number((row as Record<string, unknown>).deliverability_score ?? 0),
          risk_level: "medium" as const,
          last_checked_at: null,
          recommendations: [] as string[],
        })),
      )

    return NextResponse.json({
      ok: true,
      dashboard,
      domains,
      top_issues: collectTopIssues(domains),
      events,
      privacy_note: GROWTH_DNS_DELIVERABILITY_PRIVACY_NOTE,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: "fetch_failed", message }, { status: 500 })
  }
}
