/** GS-AI-PLAYBOOK-1E — Personalization evaluation utilities (client-safe, no AI). */

import type { GrowthPersonalizationRegenerationFeedbackCategory } from "@/lib/growth/personalization/personalization-types"
import { GROWTH_PERSONALIZATION_EVALUATION_QA_MARKER } from "@/lib/growth/personalization/personalization-types"
import {
  GROWTH_PERSONALIZATION_NEGATIVE_FEEDBACK_REASONS,
  type GrowthPersonalizationEvaluationGenerationRecord,
  type GrowthPersonalizationEvaluationOverview,
  type GrowthPersonalizationEvaluationRecommendation,
  type GrowthPersonalizationEvaluationReport,
  type GrowthPersonalizationFeedbackInsight,
  type GrowthPersonalizationIndustryMetrics,
  type GrowthPersonalizationNegativeFeedbackReason,
  type GrowthPersonalizationOperatorEvaluationSentiment,
  type GrowthPersonalizationPlaybookAnalytics,
  type GrowthPersonalizationPlaybookElementStat,
} from "@/lib/growth/personalization/evaluation/growth-personalization-evaluation-types"

export {
  GROWTH_PERSONALIZATION_EVALUATION_QA_MARKER,
  GROWTH_PERSONALIZATION_NEGATIVE_FEEDBACK_REASONS,
}
export type {
  GrowthPersonalizationEvaluationReport,
  GrowthPersonalizationEvaluationGenerationRecord,
  GrowthPersonalizationNegativeFeedbackReason,
  GrowthPersonalizationOperatorEvaluationSentiment,
} from "@/lib/growth/personalization/evaluation/growth-personalization-evaluation-types"

const UNKNOWN_INDUSTRY_ID = "unknown"
const UNKNOWN_INDUSTRY_LABEL = "Unknown / Unresolved"

export function ratePercent(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0
  return Math.round((numerator / denominator) * 100)
}

export function average(values: number[]): number {
  if (values.length === 0) return 0
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)
}

export function negativeFeedbackReasonLabel(reason: GrowthPersonalizationNegativeFeedbackReason): string {
  switch (reason) {
    case "too_generic":
      return "Too Generic"
    case "wrong_industry_assumptions":
      return "Wrong Industry Assumptions"
    case "too_salesy":
      return "Too Salesy"
    case "missing_company_context":
      return "Missing Company Context"
    case "too_long":
      return "Too Long"
    case "too_technical":
      return "Too Technical"
    case "other":
      return "Other"
    default:
      return reason.replace(/_/g, " ")
  }
}

export function regenerationFeedbackLabel(category: GrowthPersonalizationRegenerationFeedbackCategory): string {
  switch (category) {
    case "too_generic":
      return "Too Generic"
    case "wrong_industry_assumptions":
      return "Wrong Industry Assumptions"
    case "too_salesy":
      return "Too Salesy"
    case "not_enough_personalization":
      return "Not Enough Personalization"
    case "missing_company_context":
      return "Missing Company Context"
    case "custom":
      return "Custom Feedback"
    default:
      return category.replace(/_/g, " ")
  }
}

export function classifyPlaybookElement(
  claimKey: string,
): { elementKey: string; elementKind: GrowthPersonalizationPlaybookElementStat["elementKind"]; elementLabel: string } {
  if (claimKey.startsWith("industry_playbook_pain_")) {
    const index = Number(claimKey.replace("industry_playbook_pain_", ""))
    return {
      elementKey: claimKey,
      elementKind: "pain",
      elementLabel: `Pain #${Number.isFinite(index) ? index + 1 : "?"}`,
    }
  }
  if (claimKey.startsWith("industry_playbook_discovery_")) {
    const index = Number(claimKey.replace("industry_playbook_discovery_", ""))
    return {
      elementKey: claimKey,
      elementKind: "discovery_question",
      elementLabel: `Discovery Question #${Number.isFinite(index) ? index + 1 : "?"}`,
    }
  }
  if (claimKey.startsWith("industry_playbook_video_storyline_")) {
    const index = Number(claimKey.replace("industry_playbook_video_storyline_", ""))
    return {
      elementKey: claimKey,
      elementKind: "video_storyline",
      elementLabel: `Video Storyline #${Number.isFinite(index) ? index + 1 : "?"}`,
    }
  }
  if (claimKey.startsWith("industry_playbook_capability_")) {
    const slug = claimKey.replace("industry_playbook_capability_", "")
    return {
      elementKey: claimKey,
      elementKind: "capability_mapping",
      elementLabel: slug.replace(/_/g, " "),
    }
  }
  if (claimKey.startsWith("industry_playbook_cta_") || claimKey === "recommended_cta") {
    const index = Number(claimKey.replace("industry_playbook_cta_", ""))
    return {
      elementKey: claimKey,
      elementKind: "cta",
      elementLabel: Number.isFinite(index) ? `CTA #${index + 1}` : "Recommended CTA",
    }
  }
  return { elementKey: claimKey, elementKind: "other", elementLabel: claimKey }
}

export function inferCtaElementKey(subject: string): string | null {
  const trimmed = subject.trim()
  if (!trimmed) return null
  return `subject_cta:${trimmed.toLowerCase().slice(0, 80)}`
}

function rejectionReasonForRecord(record: GrowthPersonalizationEvaluationGenerationRecord): string | null {
  if (record.operatorNegativeReason) return record.operatorNegativeReason
  if (record.rejectionCategory) return record.rejectionCategory
  if (record.regenerationCategory) return record.regenerationCategory
  return null
}

export function computeEvaluationOverview(
  records: GrowthPersonalizationEvaluationGenerationRecord[],
): GrowthPersonalizationEvaluationOverview {
  const approvalCount = records.filter((row) => row.status === "approved" || row.status === "sent").length
  const rejectionCount = records.filter((row) => row.status === "rejected").length
  const regenerationCount = records.filter((row) => row.isRegeneration).length
  const draftCount = records.filter((row) => row.status === "draft").length
  const helpfulCount = records.filter((row) => row.operatorSentiment === "helpful").length
  const notHelpfulCount = records.filter((row) => row.operatorSentiment === "not_helpful").length

  const approvalDurations = records
    .filter((row) => row.approvedAt)
    .map((row) => new Date(row.approvedAt!).getTime() - new Date(row.createdAt).getTime())
    .filter((value) => Number.isFinite(value) && value >= 0)

  return {
    generationCount: records.length,
    approvalCount,
    rejectionCount,
    regenerationCount,
    draftCount,
    approvalRate: ratePercent(approvalCount, records.length),
    rejectionRate: ratePercent(rejectionCount, records.length),
    regenerationRate: ratePercent(regenerationCount, records.length),
    avgEvidenceCoverage: average(records.map((row) => row.evidenceCoverageScore)),
    avgPersonalizationScore: average(records.map((row) => row.personalizationScore)),
    avgTimeToApprovalMs:
      approvalDurations.length > 0 ? Math.round(average(approvalDurations)) : null,
    helpfulCount,
    notHelpfulCount,
  }
}

export function computeIndustryMetrics(
  records: GrowthPersonalizationEvaluationGenerationRecord[],
): GrowthPersonalizationIndustryMetrics[] {
  const grouped = new Map<string, GrowthPersonalizationEvaluationGenerationRecord[]>()
  for (const record of records) {
    const industryId = record.industryId ?? UNKNOWN_INDUSTRY_ID
    const bucket = grouped.get(industryId) ?? []
    bucket.push(record)
    grouped.set(industryId, bucket)
  }

  return [...grouped.entries()]
    .map(([industryId, rows]) => {
      const approvalCount = rows.filter((row) => row.status === "approved" || row.status === "sent").length
      const rejectionCount = rows.filter((row) => row.status === "rejected").length
      const regenerationCount = rows.filter((row) => row.isRegeneration).length

      const rejectionCounts = new Map<string, number>()
      const ctaCounts = new Map<string, number>()
      for (const row of rows) {
        const reason = rejectionReasonForRecord(row)
        if (reason) rejectionCounts.set(reason, (rejectionCounts.get(reason) ?? 0) + 1)
        const ctaKey = inferCtaElementKey(row.subject)
        if (ctaKey) ctaCounts.set(ctaKey, (ctaCounts.get(ctaKey) ?? 0) + 1)
      }

      const topRejectionReason =
        [...rejectionCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
      const topCtaSubject =
        [...ctaCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]?.replace(/^subject_cta:/, "") ?? null

      return {
        industryId,
        industryLabel: rows[0]?.industryLabel ?? UNKNOWN_INDUSTRY_LABEL,
        generationCount: rows.length,
        approvalCount,
        rejectionCount,
        regenerationCount,
        approvalRate: ratePercent(approvalCount, rows.length),
        avgEvidenceCoverage: average(rows.map((row) => row.evidenceCoverageScore)),
        avgPersonalizationScore: average(rows.map((row) => row.personalizationScore)),
        topRejectionReason,
        topCta: topCtaSubject,
      }
    })
    .sort((a, b) => b.generationCount - a.generationCount)
}

function upsertElementStat(
  map: Map<string, GrowthPersonalizationPlaybookElementStat>,
  elementKey: string,
  elementLabel: string,
  elementKind: GrowthPersonalizationPlaybookElementStat["elementKind"],
  record: GrowthPersonalizationEvaluationGenerationRecord,
): void {
  const existing =
    map.get(elementKey) ??
    ({
      elementKey,
      elementLabel,
      elementKind,
      usedCount: 0,
      approvedCount: 0,
      rejectedCount: 0,
      regeneratedCount: 0,
      approvalRate: 0,
    } satisfies GrowthPersonalizationPlaybookElementStat)

  existing.usedCount += 1
  if (record.status === "approved" || record.status === "sent") existing.approvedCount += 1
  if (record.status === "rejected") existing.rejectedCount += 1
  if (record.isRegeneration) existing.regeneratedCount += 1
  existing.approvalRate = ratePercent(existing.approvedCount, existing.usedCount)
  map.set(elementKey, existing)
}

export function computePlaybookAnalytics(
  records: GrowthPersonalizationEvaluationGenerationRecord[],
): GrowthPersonalizationPlaybookAnalytics[] {
  const grouped = new Map<string, GrowthPersonalizationEvaluationGenerationRecord[]>()
  for (const record of records) {
    if (!record.industryId) continue
    const bucket = grouped.get(record.industryId) ?? []
    bucket.push(record)
    grouped.set(record.industryId, bucket)
  }

  return [...grouped.entries()].map(([industryId, rows]) => {
    const elementMap = new Map<string, GrowthPersonalizationPlaybookElementStat>()
    for (const record of rows) {
      for (const claimKey of record.playbookElementKeys) {
        const classified = classifyPlaybookElement(claimKey)
        upsertElementStat(
          elementMap,
          classified.elementKey,
          classified.elementLabel,
          classified.elementKind,
          record,
        )
      }
      const ctaKey = inferCtaElementKey(record.subject)
      if (ctaKey) {
        upsertElementStat(elementMap, ctaKey, record.subject.trim(), "cta", record)
      }
    }

    const stats = [...elementMap.values()]
    const byKind = (kind: GrowthPersonalizationPlaybookElementStat["elementKind"]) =>
      stats.filter((entry) => entry.elementKind === kind).sort((a, b) => b.usedCount - a.usedCount)

    return {
      industryId,
      industryLabel: rows[0]?.industryLabel ?? industryId,
      pains: byKind("pain"),
      discoveryQuestions: byKind("discovery_question"),
      videoStorylines: byKind("video_storyline"),
      capabilityMappings: byKind("capability_mapping"),
      ctas: byKind("cta"),
    }
  })
}

export function computeFeedbackInsights(
  records: GrowthPersonalizationEvaluationGenerationRecord[],
): GrowthPersonalizationFeedbackInsight[] {
  const counts = new Map<string, { label: string; count: number }>()

  for (const record of records) {
    if (record.operatorNegativeReason) {
      const reason = record.operatorNegativeReason
      const label = negativeFeedbackReasonLabel(reason)
      counts.set(reason, { label, count: (counts.get(reason)?.count ?? 0) + 1 })
    }
    if (record.rejectionCategory) {
      const reason = record.rejectionCategory
      const label = regenerationFeedbackLabel(reason)
      counts.set(`rejection:${reason}`, { label: `Rejected — ${label}`, count: (counts.get(`rejection:${reason}`)?.count ?? 0) + 1 })
    }
    if (record.regenerationCategory) {
      const reason = record.regenerationCategory
      const label = regenerationFeedbackLabel(reason)
      counts.set(`regeneration:${reason}`, {
        label: `Regenerated — ${label}`,
        count: (counts.get(`regeneration:${reason}`)?.count ?? 0) + 1,
      })
    }
  }

  const total = [...counts.values()].reduce((sum, entry) => sum + entry.count, 0)
  return [...counts.entries()]
    .map(([reason, entry]) => ({
      reason,
      label: entry.label,
      count: entry.count,
      share: ratePercent(entry.count, total),
    }))
    .sort((a, b) => b.count - a.count)
}

export function generateEvaluationRecommendations(input: {
  industries: GrowthPersonalizationIndustryMetrics[]
  playbookAnalytics: GrowthPersonalizationPlaybookAnalytics[]
  feedbackInsights: GrowthPersonalizationFeedbackInsight[]
}): GrowthPersonalizationEvaluationRecommendation[] {
  const recommendations: GrowthPersonalizationEvaluationRecommendation[] = []

  for (const analytics of input.playbookAnalytics) {
    const allElements = [
      ...analytics.pains,
      ...analytics.discoveryQuestions,
      ...analytics.videoStorylines,
      ...analytics.capabilityMappings,
      ...analytics.ctas,
    ]

    for (const element of allElements) {
      if (element.usedCount < 3) continue
      if (element.approvalRate >= 75) {
        recommendations.push({
          industryId: analytics.industryId,
          industryLabel: analytics.industryLabel,
          elementKey: element.elementKey,
          elementLabel: element.elementLabel,
          elementKind: element.elementKind,
          action: "promote",
          approvalRate: element.approvalRate,
          sampleCount: element.usedCount,
          rationale: `${element.elementLabel} approval rate is ${element.approvalRate}% across ${element.usedCount} generations.`,
        })
      } else if (element.approvalRate <= 30) {
        recommendations.push({
          industryId: analytics.industryId,
          industryLabel: analytics.industryLabel,
          elementKey: element.elementKey,
          elementLabel: element.elementLabel,
          elementKind: element.elementKind,
          action: "demote",
          approvalRate: element.approvalRate,
          sampleCount: element.usedCount,
          rationale: `${element.elementLabel} approval rate is ${element.approvalRate}% — review or replace.`,
        })
      }
    }
  }

  for (const industry of input.industries) {
    if (industry.generationCount < 3) continue
    if (industry.approvalRate <= 40) {
      recommendations.push({
        industryId: industry.industryId,
        industryLabel: industry.industryLabel,
        elementKey: "industry_overall",
        elementLabel: industry.industryLabel,
        elementKind: "other",
        action: "enrich",
        approvalRate: industry.approvalRate,
        sampleCount: industry.generationCount,
        rationale: `Industry approval rate is ${industry.approvalRate}% — enrich playbook content and verified evidence paths.`,
      })
    }
    if (industry.topRejectionReason === "too_generic") {
      recommendations.push({
        industryId: industry.industryId,
        industryLabel: industry.industryLabel,
        elementKey: "rejection:too_generic",
        elementLabel: "Too Generic",
        elementKind: "other",
        action: "enrich",
        approvalRate: industry.approvalRate,
        sampleCount: industry.generationCount,
        rationale: "Top rejection is Too Generic — expand PM/compliance storyline and verified company facts.",
      })
    }
  }

  const topInsight = input.feedbackInsights[0]
  if (topInsight && topInsight.reason.includes("too_generic")) {
    recommendations.push({
      industryId: UNKNOWN_INDUSTRY_ID,
      industryLabel: "All industries",
      elementKey: "feedback:too_generic",
      elementLabel: "Too Generic",
      elementKind: "other",
      action: "review",
      approvalRate: 0,
      sampleCount: topInsight.count,
      rationale: `Most common operator feedback: ${topInsight.label} (${topInsight.share}% of feedback events).`,
    })
  }

  return recommendations
    .sort((a, b) => {
      const actionRank = { promote: 0, review: 1, enrich: 2, demote: 3 }
      return actionRank[a.action] - actionRank[b.action] || b.sampleCount - a.sampleCount
    })
    .slice(0, 24)
}

export function buildPersonalizationEvaluationReport(
  records: GrowthPersonalizationEvaluationGenerationRecord[],
): GrowthPersonalizationEvaluationReport {
  const industries = computeIndustryMetrics(records)
  const playbookAnalytics = computePlaybookAnalytics(records)
  const feedbackInsights = computeFeedbackInsights(records)
  return {
    qaMarker: GROWTH_PERSONALIZATION_EVALUATION_QA_MARKER,
    generatedAt: new Date().toISOString(),
    overview: computeEvaluationOverview(records),
    industries,
    playbookAnalytics,
    feedbackInsights,
    recommendations: generateEvaluationRecommendations({
      industries,
      playbookAnalytics,
      feedbackInsights,
    }),
  }
}
