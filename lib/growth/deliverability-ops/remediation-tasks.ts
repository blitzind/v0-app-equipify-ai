import type { DetectedDeliverabilityRisk } from "@/lib/growth/deliverability-ops/risk-detector"
import type { GeneratedDeliverabilityRecommendation } from "@/lib/growth/deliverability-ops/recommendation-engine"
import type {
  GrowthDeliverabilityRemediationChecklistItem,
  GrowthDeliverabilityRecommendationType,
  GrowthDeliverabilityRiskType,
} from "@/lib/growth/deliverability-ops/deliverability-ops-types"

export type RemediationTaskDraft = {
  taskType: string
  title: string
  description: string
  checklist: GrowthDeliverabilityRemediationChecklistItem[]
  entityType: GeneratedDeliverabilityRecommendation["entityType"]
  entityLabel: string
}

function checklistItem(label: string, id?: string): GrowthDeliverabilityRemediationChecklistItem {
  return { id: id ?? label.toLowerCase().replace(/\s+/g, "_").slice(0, 40), label, completed: false }
}

const RECOMMENDATION_CHECKLIST: Partial<
  Record<GrowthDeliverabilityRecommendationType, GrowthDeliverabilityRemediationChecklistItem[]>
> = {
  pause_sender: [
    checklistItem("Confirm sender identity and recent send volume"),
    checklistItem("Review open/bounce/complaint trends"),
    checklistItem("Manually pause sender in infrastructure if approved"),
    checklistItem("Notify sequence owners of pause decision"),
  ],
  reduce_volume: [
    checklistItem("Review daily caps and pool rotation settings"),
    checklistItem("Identify sequences driving highest volume"),
    checklistItem("Manually adjust caps after operator approval"),
    checklistItem("Monitor deliverability for 48 hours"),
  ],
  rotate_sender: [
    checklistItem("Review sender pool member health scores"),
    checklistItem("Confirm eligible fallback senders exist"),
    checklistItem("Update pool priority or manual override if needed"),
  ],
  increase_warmup: [
    checklistItem("Compare warmup stage vs actual send volume"),
    checklistItem("Review warmup profile daily limits"),
    checklistItem("Adjust warmup schedule manually if approved"),
  ],
  fix_spf: [
    checklistItem("Run DNS check from deliverability infrastructure"),
    checklistItem("Compare SPF record with provider requirements"),
    checklistItem("Apply DNS change in external DNS provider"),
    checklistItem("Re-validate SPF after propagation"),
  ],
  fix_dkim: [
    checklistItem("Verify DKIM selector in provider console"),
    checklistItem("Publish correct public key in DNS"),
    checklistItem("Re-run DKIM validation"),
  ],
  fix_dmarc: [
    checklistItem("Review current DMARC policy and alignment"),
    checklistItem("Ensure SPF and DKIM pass before tightening policy"),
    checklistItem("Publish DMARC TXT record manually"),
  ],
  review_copy: [
    checklistItem("Pull recent templates with elevated complaints"),
    checklistItem("Review subject lines and CTAs"),
    checklistItem("A/B test revised copy with human approval"),
  ],
  review_targeting: [
    checklistItem("Audit list sources and verification status"),
    checklistItem("Review ICP fit and bounce patterns"),
    checklistItem("Suppress or remove risky segments"),
  ],
  switch_provider_route: [
    checklistItem("Review provider health and rate limits"),
    checklistItem("Confirm fallback route availability"),
    checklistItem("Manually update route preference if approved"),
  ],
  suppress_bad_leads: [
    checklistItem("Export hard bounces and complaints"),
    checklistItem("Apply compliance suppressions"),
    checklistItem("Verify suppression registry updated"),
  ],
  investigate_domain: [
    checklistItem("Review domain DNS checks and reputation history"),
    checklistItem("Check blacklist and authentication scores"),
    checklistItem("Document findings and next steps"),
  ],
}

const RISK_CHECKLIST: Partial<Record<GrowthDeliverabilityRiskType, GrowthDeliverabilityRemediationChecklistItem[]>> =
  {
    bounce_spike: [
      checklistItem("Identify bounce categories (hard vs soft)"),
      checklistItem("Review list hygiene and verification"),
      checklistItem("Consider volume reduction if hard bounces persist"),
    ],
    complaint_spike: [
      checklistItem("Review recent copy and targeting"),
      checklistItem("Confirm unsubscribe link visibility"),
      checklistItem("Evaluate sender pause recommendation"),
    ],
    warmup_mismatch: [
      checklistItem("Compare warmup stage limits to actual sends"),
      checklistItem("Align warmup profile with operator plan"),
    ],
    rate_limit_pressure: [
      checklistItem("Review provider rate limit utilization"),
      checklistItem("Spread sends across routes or time windows"),
    ],
  }

export function buildRemediationTasksFromRecommendation(
  recommendation: GeneratedDeliverabilityRecommendation,
): RemediationTaskDraft {
  const checklist =
    RECOMMENDATION_CHECKLIST[recommendation.recommendationType] ?? [
      checklistItem("Review recommendation evidence"),
      checklistItem("Document operator decision"),
      checklistItem("Apply approved remediation manually"),
    ]

  return {
    taskType: `recommendation_${recommendation.recommendationType}`,
    title: `Remediate: ${recommendation.title}`,
    description: recommendation.description,
    checklist,
    entityType: recommendation.entityType,
    entityLabel: recommendation.entityLabel,
  }
}

export function buildRemediationTasksFromRisk(risk: DetectedDeliverabilityRisk): RemediationTaskDraft {
  const checklist = RISK_CHECKLIST[risk.riskType] ?? [
    checklistItem("Review risk signals"),
    checklistItem("Acknowledge risk in ops center"),
    checklistItem("Execute approved remediation steps"),
  ]

  return {
    taskType: `risk_${risk.riskType}`,
    title: `Address: ${risk.title}`,
    description: risk.description,
    checklist,
    entityType: risk.entityType,
    entityLabel: risk.entityLabel,
  }
}

export function mergeChecklistProgress(
  items: GrowthDeliverabilityRemediationChecklistItem[],
  completedIds: string[],
): GrowthDeliverabilityRemediationChecklistItem[] {
  const completed = new Set(completedIds)
  return items.map((item) => ({ ...item, completed: completed.has(item.id) || item.completed }))
}

export function checklistCompletionPct(items: GrowthDeliverabilityRemediationChecklistItem[]): number {
  if (items.length === 0) return 0
  const done = items.filter((item) => item.completed).length
  return Math.round((done / items.length) * 100)
}
