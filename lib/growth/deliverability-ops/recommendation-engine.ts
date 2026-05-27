import { risksToEvidence } from "@/lib/growth/deliverability-ops/risk-detector"
import type { DetectedDeliverabilityRisk } from "@/lib/growth/deliverability-ops/risk-detector"
import type {
  GrowthDeliverabilityEvidenceSnippet,
  GrowthDeliverabilityRecommendationType,
  GrowthDeliverabilitySeverity,
} from "@/lib/growth/deliverability-ops/deliverability-ops-types"

export type GeneratedDeliverabilityRecommendation = {
  recommendationType: GrowthDeliverabilityRecommendationType
  title: string
  description: string
  severity: GrowthDeliverabilitySeverity
  entityType: DetectedDeliverabilityRisk["entityType"]
  entityId: string | null
  entityLabel: string
  evidence: GrowthDeliverabilityEvidenceSnippet[]
}

const RISK_TO_RECOMMENDATION: Partial<
  Record<DetectedDeliverabilityRisk["riskType"], GrowthDeliverabilityRecommendationType[]>
> = {
  spf_failure: ["fix_spf", "investigate_domain"],
  dkim_failure: ["fix_dkim", "investigate_domain"],
  dmarc_failure: ["fix_dmarc", "investigate_domain"],
  bounce_spike: ["reduce_volume", "suppress_bad_leads", "review_targeting"],
  complaint_spike: ["pause_sender", "review_copy", "suppress_bad_leads"],
  unsubscribe_spike: ["review_copy", "review_targeting", "reduce_volume"],
  open_rate_drop: ["review_copy", "rotate_sender"],
  click_rate_drop: ["review_copy", "review_targeting"],
  reply_rate_drop: ["review_targeting", "review_copy"],
  sender_fatigue: ["pause_sender", "rotate_sender", "reduce_volume"],
  warmup_mismatch: ["increase_warmup", "reduce_volume"],
  provider_degradation: ["switch_provider_route", "reduce_volume"],
  domain_reputation_drop: ["investigate_domain", "fix_spf", "fix_dkim", "fix_dmarc"],
  rate_limit_pressure: ["reduce_volume", "switch_provider_route", "rotate_sender"],
}

function recommendationCopy(
  type: GrowthDeliverabilityRecommendationType,
  risk: DetectedDeliverabilityRisk,
): { title: string; description: string } {
  switch (type) {
    case "pause_sender":
      return {
        title: "Consider pausing sender",
        description: `Human review recommended for ${risk.entityLabel} — advisory pause to protect reputation.`,
      }
    case "reduce_volume":
      return {
        title: "Consider reducing send volume",
        description: "Gradually lower daily caps after operator approval — no automatic volume change.",
      }
    case "rotate_sender":
      return {
        title: "Consider rotating sender",
        description: "Evaluate sender pool rotation to distribute load — rotation remains human-gated.",
      }
    case "increase_warmup":
      return {
        title: "Increase warmup cadence",
        description: "Warmup stage may be behind actual volume — review warmup profile manually.",
      }
    case "fix_spf":
      return {
        title: "Fix SPF record",
        description: "Update SPF DNS record via your DNS provider — Growth Engine will not mutate DNS.",
      }
    case "fix_dkim":
      return {
        title: "Fix DKIM record",
        description: "Verify DKIM selector and public key in DNS — manual DNS change required.",
      }
    case "fix_dmarc":
      return {
        title: "Fix DMARC policy",
        description: "Align DMARC policy with SPF/DKIM — advisory only, no autonomous DNS edits.",
      }
    case "review_copy":
      return {
        title: "Review message copy",
        description: "Engagement or complaint signals suggest copy review before next sends.",
      }
    case "review_targeting":
      return {
        title: "Review list targeting",
        description: "List quality or ICP fit may be driving negative signals — human list review.",
      }
    case "switch_provider_route":
      return {
        title: "Review provider route",
        description: "Consider alternate delivery route after operator approval — no auto provider switch.",
      }
    case "suppress_bad_leads":
      return {
        title: "Suppress risky leads",
        description: "Apply compliance suppressions for hard bounces and complaints — human confirmation.",
      }
    case "investigate_domain":
      return {
        title: "Investigate domain health",
        description: "Domain authentication or reputation needs operator investigation.",
      }
    default:
      return { title: "Deliverability review", description: risk.description }
  }
}

export function generateDeliverabilityRecommendations(
  risks: DetectedDeliverabilityRisk[],
): GeneratedDeliverabilityRecommendation[] {
  const results: GeneratedDeliverabilityRecommendation[] = []
  const seen = new Set<string>()

  for (const risk of risks) {
    const types = RISK_TO_RECOMMENDATION[risk.riskType] ?? ["review_copy"]
    const evidence = risksToEvidence(risk)
    if (evidence.length === 0) continue

    for (const recommendationType of types) {
      const key = `${recommendationType}:${risk.entityLabel}:${risk.riskType}`
      if (seen.has(key)) continue
      seen.add(key)

      const copy = recommendationCopy(recommendationType, risk)
      results.push({
        recommendationType,
        title: copy.title,
        description: copy.description,
        severity: risk.severity,
        entityType: risk.entityType,
        entityId: risk.entityId,
        entityLabel: risk.entityLabel,
        evidence,
      })
    }
  }

  return results.filter((rec) => rec.evidence.length > 0)
}

export function hasMinimumRecommendationEvidence(
  evidence: GrowthDeliverabilityEvidenceSnippet[],
): boolean {
  return evidence.length >= 2
}
