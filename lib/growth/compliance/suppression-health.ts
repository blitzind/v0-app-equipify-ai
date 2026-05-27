import type { SupabaseClient } from "@supabase/supabase-js"
import {
  GROWTH_COMPLIANCE_SUPPRESSION_QA_MARKER,
  type GrowthComplianceDashboard,
} from "@/lib/growth/compliance/compliance-types"
import { isGrowthComplianceSchemaReady } from "@/lib/growth/compliance/compliance-schema-health"

export type GrowthSuppressionHealthSnapshot = {
  qa_marker: typeof GROWTH_COMPLIANCE_SUPPRESSION_QA_MARKER
  schema_ready: boolean
  active_suppressions: number
  unsubscribes_30d: number
  hard_bounces_30d: number
  complaints_30d: number
  compliance_health: "healthy" | "degraded" | "critical"
  notes: string[]
}

export async function buildSuppressionHealthSnapshot(
  admin: SupabaseClient | null,
): Promise<GrowthSuppressionHealthSnapshot> {
  const notes: string[] = []
  const schema_ready = admin ? await isGrowthComplianceSchemaReady(admin) : false

  if (!schema_ready) {
    notes.push("Apply migration 20270410120000_growth_compliance_suppression.sql.")
  }

  let active_suppressions = 0
  let unsubscribes_30d = 0
  let hard_bounces_30d = 0
  let complaints_30d = 0

  if (admin && schema_ready) {
    const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const [suppRes, unsubRes, bounceRes, complaintRes] = await Promise.all([
      admin.schema("growth").from("delivery_suppressions").select("id", { count: "exact", head: true }).eq("active", true),
      admin.schema("growth").from("unsubscribe_registry").select("id", { count: "exact", head: true }).gte("occurred_at", since30d),
      admin
        .schema("growth")
        .from("email_bounces")
        .select("id", { count: "exact", head: true })
        .in("bounce_type", ["hard", "blocked", "spam"])
        .gte("occurred_at", since30d),
      admin.schema("growth").from("email_complaints").select("id", { count: "exact", head: true }).gte("occurred_at", since30d),
    ])
    active_suppressions = suppRes.count ?? 0
    unsubscribes_30d = unsubRes.count ?? 0
    hard_bounces_30d = bounceRes.count ?? 0
    complaints_30d = complaintRes.count ?? 0
  }

  let compliance_health: GrowthSuppressionHealthSnapshot["compliance_health"] = "healthy"
  if (!schema_ready) compliance_health = "critical"
  else if (complaints_30d > 0 || hard_bounces_30d > 10) compliance_health = "degraded"
  else if (active_suppressions > 100) compliance_health = "degraded"

  return {
    qa_marker: GROWTH_COMPLIANCE_SUPPRESSION_QA_MARKER,
    schema_ready,
    active_suppressions,
    unsubscribes_30d,
    hard_bounces_30d,
    complaints_30d,
    compliance_health,
    notes,
  }
}

export function complianceHealthLabel(health: GrowthSuppressionHealthSnapshot["compliance_health"]): string {
  switch (health) {
    case "healthy":
      return "Healthy"
    case "degraded":
      return "Degraded"
    case "critical":
      return "Critical"
    default:
      return "Unknown"
  }
}

export function summarizeComplianceDashboard(dashboard: GrowthComplianceDashboard): string {
  return `Reputation ${dashboard.senderReputation.score} (${dashboard.senderReputation.tier}) · ${dashboard.suppressionCount} suppressions`
}
