import type { InsightTheme, Recommendation, RecommendationCategory } from "./types"

const MODULE_BY_CATEGORY: Record<RecommendationCategory, string> = {
  prospect: "Prospects",
  financial: "Invoices",
  dispatch: "Dispatch",
  equipment: "Equipment",
  certificate: "Certificates",
  inventory: "Inventory",
  communications: "Communications",
  automation: "Automations",
  maintenance: "Maintenance",
}

const PRIORITY_SCORE = { high: 92, medium: 68, low: 42 } as const

/** Rule id → default insight theme when rules omit it. */
const RULE_THEME: Partial<Record<string, InsightTheme>> = {
  stale_prospect: "revenue_opportunity",
  overdue_invoice: "collections_risk",
  unscheduled_priority_wo: "dispatch_backlog",
  repeat_repair_risk: "repeat_repair",
  certificate_release_pending: "certificate_release",
  low_stock: "inventory_risk",
  failed_communication: "communications_risk",
  automation_failure_burst: "automation_health",
  maintenance_due_soon: "maintenance_upsell",
  follow_up_queue_pressure: "follow_up_risk",
  warranty_expiring_window: "warranty_window",
  tech_capacity_pressure: "capacity_risk",
  maintenance_plan_gap: "maintenance_upsell",
}

function firstSentence(text: string, max = 140): string {
  const t = text.trim()
  const cut = t.search(/[.!?]\s/)
  const base = cut > 0 ? t.slice(0, cut + 1) : t
  return base.length <= max ? base : `${base.slice(0, max - 1)}…`
}

export function enrichOperationalInsight(rec: Recommendation): Recommendation {
  const insightTheme =
    rec.insightTheme ?? RULE_THEME[rec.ruleId] ?? "dispatch_backlog"
  const confidenceScore =
    rec.confidenceScore ?? PRIORITY_SCORE[rec.priority]
  const sourceModule = rec.sourceModule ?? MODULE_BY_CATEGORY[rec.category]
  const sourceSignals =
    rec.sourceSignals?.length && rec.sourceSignals.length > 0
      ? rec.sourceSignals
      : [`rule:${rec.ruleId}`, `priority:${rec.priority}`]
  const suggestedNextStep =
    rec.suggestedNextStep ??
    (rec.actions?.[0]?.label
      ? `Consider: ${rec.actions[0].label}`
      : firstSentence(rec.explanation))

  return {
    ...rec,
    insightTheme,
    confidenceScore,
    sourceModule,
    sourceSignals,
    suggestedNextStep,
  }
}
