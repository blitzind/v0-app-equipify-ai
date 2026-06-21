/** GS-AI-PLAYBOOK-3C — Outcome record builder (client-safe). */

import type { GrowthPersonalizationEvaluationGenerationRecord } from "@/lib/growth/personalization/evaluation/growth-personalization-evaluation-types"
import { resolvePersonaArchetype } from "@/lib/growth/playbooks/personas/growth-playbook-persona-frameworks"
import type {
  GrowthPersonaArchetype,
  GrowthPersonaCtaType,
  GrowthPersonaProofType,
} from "@/lib/growth/playbooks/personas/growth-playbook-persona-types"
import type {
  GrowthPlaybookOutcomeChannel,
  GrowthPlaybookOutcomeNarrativeType,
  GrowthPlaybookOutcomeRecord,
} from "@/lib/growth/playbooks/outcomes/growth-playbook-outcome-types"

function ratePercent(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null
  return Math.round((numerator / denominator) * 100)
}

export function inferOutcomeCtaType(text: string | null | undefined): GrowthPersonaCtaType | null {
  if (!text?.trim()) return null
  const lower = text.toLowerCase()
  if (/\b(compliance|audit|regulatory|joint commission|htm)\b/.test(lower)) return "compliance_review"
  if (/\b(roi|margin|revenue|profit|financial|cost)\b/.test(lower)) return "roi_discussion"
  if (/\b(strategic|executive|leadership|owner|president)\b/.test(lower)) return "strategic_review"
  if (/\b(dispatch|routing|schedule board|technician assignment)\b/.test(lower)) return "dispatch_demonstration"
  if (/\b(scheduling|pm schedule|preventive maintenance)\b/.test(lower)) return "scheduling_walkthrough"
  if (/\b(workflow|process|how you|how your team|compare|review)\b/.test(lower)) return "workflow_walkthrough"
  if (/\b(scale|scaling|multi[- ]location|capacity|growth)\b/.test(lower)) return "scalability_assessment"
  if (/\b(demo|walkthrough|show|see how|quick look)\b/.test(lower)) return "workflow_walkthrough"
  if (/\b(discover|curious|open to|worth|conversation)\b/.test(lower)) return "consultative_discovery"
  return "operational_review"
}

export function inferOutcomeProofType(input: {
  claimKeys?: string[]
  capabilityText?: string | null
}): GrowthPersonaProofType | null {
  const haystack = [...(input.claimKeys ?? []), input.capabilityText ?? ""].join(" ").toLowerCase()
  if (!haystack.trim()) return null
  if (/\b(compliance|audit|recall|regulatory|joint commission|fda|iso)\b/.test(haystack)) return "compliance"
  if (/\b(audit readiness|survey prep|inspection)\b/.test(haystack)) return "audit_readiness"
  if (/\b(pm completion|preventive maintenance|pm schedule)\b/.test(haystack)) return "pm_completion"
  if (/\b(revenue|margin|billing|profit)\b/.test(haystack)) return "revenue_growth"
  if (/\b(cost|leakage|warranty|profitability)\b/.test(haystack)) return "profitability"
  if (/\b(labor|technician productivity|efficiency)\b/.test(haystack)) return "labor_savings"
  if (/\b(callback|repeat visit|first[- ]time fix)\b/.test(haystack)) return "reduced_callbacks"
  if (/\b(dispatch|scheduling|routing)\b/.test(haystack)) return "faster_scheduling"
  if (/\b(visibility|dashboard|reporting)\b/.test(haystack)) return "visibility"
  if (/\b(standard|consistency|process)\b/.test(haystack)) return "standardization"
  if (/\b(scale|growth|multi[- ]location)\b/.test(haystack)) return "scalability"
  return "technician_productivity"
}

export function inferOutcomeNarrativeType(input: {
  storylineCategory?: GrowthPlaybookOutcomeNarrativeType | null
  claimKeys?: string[]
  subject?: string | null
}): GrowthPlaybookOutcomeNarrativeType | null {
  if (input.storylineCategory) return input.storylineCategory
  const haystack = [...(input.claimKeys ?? []), input.subject ?? ""].join(" ").toLowerCase()
  if (/\b(revenue|margin|billing|profit|financial|roi)\b/.test(haystack)) return "financial"
  if (/\b(scale|growth|contract|expansion|portfolio)\b/.test(haystack)) return "growth"
  if (/\b(dispatch|pm|workflow|compliance|technician|maintenance)\b/.test(haystack)) return "operational"
  return null
}

export function inferOutcomePersonaArchetype(input: {
  decisionMakerTitle?: string | null
  personaTitle?: string | null
}): GrowthPersonaArchetype {
  const title = input.personaTitle ?? input.decisionMakerTitle ?? ""
  return resolvePersonaArchetype(title, input.decisionMakerTitle).archetype
}

export function buildOutcomeRecordFromEvaluation(
  record: GrowthPersonalizationEvaluationGenerationRecord,
  extras?: Partial<
    Pick<
      GrowthPlaybookOutcomeRecord,
      | "channel"
      | "personaArchetype"
      | "ctaType"
      | "proofType"
      | "narrativeType"
      | "opened"
      | "replied"
      | "meetingBooked"
      | "ctaClicked"
      | "videoCompleted"
      | "shareEngaged"
    >
  >,
): GrowthPlaybookOutcomeRecord {
  const ctaType = extras?.ctaType ?? inferOutcomeCtaType(record.subject)
  const proofType =
    extras?.proofType ??
    inferOutcomeProofType({ claimKeys: [...record.evidenceClaimKeys, ...record.playbookElementKeys] })
  const narrativeType =
    extras?.narrativeType ??
    inferOutcomeNarrativeType({ claimKeys: record.playbookElementKeys, subject: record.subject })

  return {
    id: record.id,
    industryId: record.industryId,
    industryLabel: record.industryLabel,
    personaArchetype: extras?.personaArchetype ?? null,
    channel: extras?.channel ?? "EMAIL",
    ctaType,
    proofType,
    narrativeType,
    approved: record.status === "approved" || record.status === "sent",
    rejected: record.status === "rejected",
    regenerated: record.isRegeneration,
    operatorHelpful: record.operatorSentiment === "helpful" ? true : record.operatorSentiment === "not_helpful" ? false : null,
    opened: extras?.opened ?? false,
    replied: extras?.replied ?? false,
    meetingBooked: extras?.meetingBooked ?? false,
    ctaClicked: extras?.ctaClicked ?? false,
    videoCompleted: extras?.videoCompleted ?? false,
    shareEngaged: extras?.shareEngaged ?? false,
    recordedAt: record.createdAt,
  }
}

export function buildOutcomeRecordsFromEvaluation(
  records: GrowthPersonalizationEvaluationGenerationRecord[],
): GrowthPlaybookOutcomeRecord[] {
  return records.map((record) => buildOutcomeRecordFromEvaluation(record))
}

export function mergeOutcomeRecords(...groups: GrowthPlaybookOutcomeRecord[][]): GrowthPlaybookOutcomeRecord[] {
  const seen = new Map<string, GrowthPlaybookOutcomeRecord>()
  for (const group of groups) {
    for (const record of group) {
      seen.set(record.id, { ...seen.get(record.id), ...record })
    }
  }
  return [...seen.values()]
}

export function summarizeOutcomeRates(records: GrowthPlaybookOutcomeRecord[]): {
  approvalRate: number | null
  regenerationRate: number | null
  operatorHelpfulRate: number | null
  openRate: number | null
  replyRate: number | null
  meetingRate: number | null
  ctaRate: number | null
  videoCompletionRate: number | null
  shareEngagementRate: number | null
} {
  const total = records.length
  const engagementEligible = records.filter((row) => row.approved || row.replied || row.opened).length
  const helpfulEligible = records.filter((row) => row.operatorHelpful != null).length
  const videoEligible = records.filter((row) => row.channel === "VIDEO").length
  const shareEligible = records.filter((row) => row.channel === "SHARE_PAGE").length

  return {
    approvalRate: ratePercent(records.filter((row) => row.approved).length, total),
    regenerationRate: ratePercent(records.filter((row) => row.regenerated).length, total),
    operatorHelpfulRate: ratePercent(
      records.filter((row) => row.operatorHelpful === true).length,
      helpfulEligible,
    ),
    openRate: ratePercent(records.filter((row) => row.opened).length, engagementEligible || total),
    replyRate: ratePercent(records.filter((row) => row.replied).length, engagementEligible || total),
    meetingRate: ratePercent(records.filter((row) => row.meetingBooked).length, engagementEligible || total),
    ctaRate: ratePercent(records.filter((row) => row.ctaClicked).length, engagementEligible || total),
    videoCompletionRate: ratePercent(
      records.filter((row) => row.videoCompleted).length,
      videoEligible || total,
    ),
    shareEngagementRate: ratePercent(
      records.filter((row) => row.shareEngaged).length,
      shareEligible || total,
    ),
  }
}
