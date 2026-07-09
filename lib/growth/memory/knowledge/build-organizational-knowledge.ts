/** GE-AIOS-17C — Deterministic Organizational Knowledge builder (BI + Memory → conclusions). */

import type { BusinessIntelligenceReport } from "@/lib/growth/business-intelligence/business-intelligence-types"
import type { BusinessIntelligenceReportField } from "@/lib/growth/business-intelligence/business-intelligence-types"
import type { BusinessIntelligenceReviewDecisionRecord } from "@/lib/growth/business-intelligence/business-intelligence-review-types"
import type { BusinessIntelligenceReviewFieldKey } from "@/lib/growth/business-intelligence/business-intelligence-review-types"
import { inferIndustry } from "@/lib/growth/memory/events/record-memory-event"
import type { AvaMemoryEvent } from "@/lib/growth/memory/types"
import type {
  OrganizationalKnowledgeCategory,
  OrganizationalKnowledgeItem,
  OrganizationalKnowledgeSource,
} from "@/lib/growth/memory/knowledge/organization-knowledge-types"
import { GROWTH_ORGANIZATIONAL_KNOWLEDGE_QA_MARKER } from "@/lib/growth/memory/knowledge/organization-knowledge-types"
import { SALES_SPECIALIST_MEMORY_SOURCE } from "@/lib/growth/specialists/execution/sales-specialist-memory-bridge"
import type { SalesOutcome } from "@/lib/growth/specialists/execution/sales-outcome-types"

const BI_CONFIDENCE_THRESHOLD = 0.55

const INDUSTRY_LABELS: Record<string, string> = {
  medical_equipment: "medical equipment",
  hvac: "HVAC",
  software: "software",
  general: "general field-service",
}

type BiFieldSpec = {
  fieldKey: BusinessIntelligenceReviewFieldKey
  category: OrganizationalKnowledgeCategory
  specialist: string
  buildFinding: (value: string) => string
}

const BI_KNOWLEDGE_FIELD_SPECS: BiFieldSpec[] = [
  {
    fieldKey: "market.industries_served",
    category: "industry",
    specialist: "sales",
    buildFinding: (value) =>
      `Companies in ${value} are among your strongest-fit target industries based on business research.`,
  },
  {
    fieldKey: "market.geographic_markets",
    category: "market",
    specialist: "sales",
    buildFinding: (value) => `Geographic markets with the strongest alignment include ${value}.`,
  },
  {
    fieldKey: "sales.likely_buyer_personas",
    category: "persona",
    specialist: "sales",
    buildFinding: (value) => `${value} are primary buyer personas for your product.`,
  },
  {
    fieldKey: "sales.likely_pain_points",
    category: "pain_point",
    specialist: "sales",
    buildFinding: (value) => `Prospects commonly struggle with ${value}.`,
  },
  {
    fieldKey: "company.differentiators",
    category: "messaging",
    specialist: "sales",
    buildFinding: (value) => `${value} are proven differentiators in your market positioning.`,
  },
  {
    fieldKey: "company.plans_pricing",
    category: "messaging",
    specialist: "sales",
    buildFinding: (value) => `Pricing and plan positioning centers on ${value}.`,
  },
]

function getReportField(
  report: BusinessIntelligenceReport,
  fieldKey: BusinessIntelligenceReviewFieldKey,
): BusinessIntelligenceReportField | null {
  const [section, fieldName] = fieldKey.split(".")
  if (!section || !fieldName) return null

  if (section === "company") {
    return (report.sections.company as Record<string, BusinessIntelligenceReportField>)[fieldName] ?? null
  }
  if (section === "market") {
    return (report.sections.market as Record<string, BusinessIntelligenceReportField>)[fieldName] ?? null
  }
  if (section === "sales") {
    const salesKeyMap: Record<string, string> = {
      likely_buyer_personas: "likely_buyer_personas",
      likely_pain_points: "likely_pain_points",
    }
    const mapped = salesKeyMap[fieldName] ?? fieldName
    const sales = report.sections.sales_and_growth as Record<string, BusinessIntelligenceReportField>
    return sales[mapped] ?? null
  }

  return null
}

function formatFieldValue(value: string | string[] | null): string | null {
  if (value == null) return null
  if (Array.isArray(value)) {
    const filtered = value.map(String).map((row) => row.trim()).filter(Boolean)
    if (filtered.length === 0) return null
    if (filtered.length === 1) return filtered[0]
    if (filtered.length === 2) return `${filtered[0]} and ${filtered[1]}`
    return `${filtered.slice(0, -1).join(", ")}, and ${filtered[filtered.length - 1]}`
  }
  const trimmed = value.trim()
  return trimmed || null
}

function fieldConfidencePercent(field: BusinessIntelligenceReportField | null): number {
  if (!field) return 0
  return Math.round(Math.min(100, Math.max(0, field.confidence * 100)))
}

function buildBiKnowledgeItem(input: {
  organizationId: string
  generatedAt: string
  fieldKey: BusinessIntelligenceReviewFieldKey
  category: OrganizationalKnowledgeCategory
  specialist: string
  source: OrganizationalKnowledgeSource
  finding: string
  confidence: number
  supportingEventCount: number
}): OrganizationalKnowledgeItem {
  return {
    knowledge_id: `${input.source}:${input.fieldKey}`,
    organization_id: input.organizationId,
    source: input.source,
    specialist: input.specialist,
    category: input.category,
    finding: input.finding.endsWith(".") ? input.finding : `${input.finding}.`,
    confidence: Math.min(100, Math.max(0, input.confidence)),
    supporting_event_count: input.supportingEventCount,
    first_observed_at: input.generatedAt,
    last_confirmed_at: input.generatedAt,
    superseded_by: null,
    active: true,
    metadata: {
      field_key: input.fieldKey,
      qa_marker: GROWTH_ORGANIZATIONAL_KNOWLEDGE_QA_MARKER,
    },
  }
}

export function buildKnowledgeFromBusinessIntelligence(input: {
  organizationId: string
  generatedAt: string
  report: BusinessIntelligenceReport | null
  reviewDecisions?: BusinessIntelligenceReviewDecisionRecord[]
}): OrganizationalKnowledgeItem[] {
  if (!input.report) return []

  const items: OrganizationalKnowledgeItem[] = []
  const decisionByField = new Map(
    (input.reviewDecisions ?? []).map((row) => [row.field_key, row]),
  )

  for (const spec of BI_KNOWLEDGE_FIELD_SPECS) {
    const decision = decisionByField.get(spec.fieldKey)
    if (decision && (decision.decision === "approved" || decision.decision === "edited")) {
      const formatted = formatFieldValue(decision.approved_value_json)
      if (!formatted) continue
      const field = getReportField(input.report, spec.fieldKey)
      const confidence = Math.max(
        fieldConfidencePercent(field),
        Math.round((decision.confidence_at_decision ?? field?.confidence ?? 0.55) * 100),
        70,
      )
      items.push(
        buildBiKnowledgeItem({
          organizationId: input.organizationId,
          generatedAt: decision.decided_at || input.generatedAt,
          fieldKey: spec.fieldKey,
          category: spec.category,
          specialist: spec.specialist,
          source: "bi_review",
          finding: `Operator-confirmed: ${spec.buildFinding(formatted)}`,
          confidence,
          supportingEventCount: decision.supporting_evidence_ids.length,
        }),
      )
      continue
    }

    const field = getReportField(input.report, spec.fieldKey)
    if (!field || field.confidence < BI_CONFIDENCE_THRESHOLD) continue
    const formatted = formatFieldValue(field.value)
    if (!formatted) continue

    items.push(
      buildBiKnowledgeItem({
        organizationId: input.organizationId,
        generatedAt: input.report.generated_at || input.generatedAt,
        fieldKey: spec.fieldKey,
        category: spec.category,
        specialist: spec.specialist,
        source: "business_intelligence",
        finding: spec.buildFinding(formatted),
        confidence: fieldConfidencePercent(field),
        supportingEventCount: field.supporting_evidence_ids.length,
      }),
    )
  }

  const salesSection = input.report.sections.sales_and_growth
  const objectionField = salesSection.likely_objections
  if (objectionField.confidence >= BI_CONFIDENCE_THRESHOLD) {
    const formatted = formatFieldValue(objectionField.value)
    if (formatted) {
      items.push({
        knowledge_id: "business_intelligence:sales.likely_objections",
        organization_id: input.organizationId,
        source: "business_intelligence",
        specialist: "sales",
        category: "objection",
        finding: `Expect objections around ${formatted} during sales conversations.`,
        confidence: fieldConfidencePercent(objectionField),
        supporting_event_count: objectionField.supporting_evidence_ids.length,
        first_observed_at: input.report.generated_at || input.generatedAt,
        last_confirmed_at: input.report.generated_at || input.generatedAt,
        superseded_by: null,
        active: true,
        metadata: {
          field_key: "sales.likely_objections",
          qa_marker: GROWTH_ORGANIZATIONAL_KNOWLEDGE_QA_MARKER,
        },
      })
    }
  }

  const triggerField = salesSection.likely_decision_triggers
  if (triggerField.confidence >= BI_CONFIDENCE_THRESHOLD) {
    const formatted = formatFieldValue(triggerField.value)
    if (formatted) {
      items.push({
        knowledge_id: "business_intelligence:sales.likely_decision_triggers",
        organization_id: input.organizationId,
        source: "business_intelligence",
        specialist: "sales",
        category: "timing",
        finding: `Buying is often triggered by ${formatted}.`,
        confidence: fieldConfidencePercent(triggerField),
        supporting_event_count: triggerField.supporting_evidence_ids.length,
        first_observed_at: input.report.generated_at || input.generatedAt,
        last_confirmed_at: input.report.generated_at || input.generatedAt,
        superseded_by: null,
        active: true,
        metadata: {
          field_key: "sales.likely_decision_triggers",
          qa_marker: GROWTH_ORGANIZATIONAL_KNOWLEDGE_QA_MARKER,
        },
      })
    }
  }

  const sizesField = input.report.sections.market.company_sizes_served
  if (sizesField.confidence >= BI_CONFIDENCE_THRESHOLD) {
    const formatted = formatFieldValue(sizesField.value)
    if (formatted) {
      items.push({
        knowledge_id: "business_intelligence:market.company_sizes_served",
        organization_id: input.organizationId,
        source: "business_intelligence",
        specialist: "sales",
        category: "company_size",
        finding: `Prospects with ${formatted} are a strong match for your offering.`,
        confidence: fieldConfidencePercent(sizesField),
        supporting_event_count: sizesField.supporting_evidence_ids.length,
        first_observed_at: input.report.generated_at || input.generatedAt,
        last_confirmed_at: input.report.generated_at || input.generatedAt,
        superseded_by: null,
        active: true,
        metadata: {
          field_key: "market.company_sizes_served",
          qa_marker: GROWTH_ORGANIZATIONAL_KNOWLEDGE_QA_MARKER,
        },
      })
    }
  }

  return items
}

function industryConversionRate(stats: { researched: number; qualified: number }): number {
  if (stats.researched <= 0) return 0
  return stats.qualified / stats.researched
}

export function buildKnowledgeFromMemoryEvents(input: {
  organizationId: string
  generatedAt: string
  memoryEvents: AvaMemoryEvent[]
  salesOutcomes?: SalesOutcome[]
}): OrganizationalKnowledgeItem[] {
  const items: OrganizationalKnowledgeItem[] = []
  const salesEvents = input.memoryEvents.filter((row) => row.source === SALES_SPECIALIST_MEMORY_SOURCE)

  const byIndustry = new Map<string, { researched: number; qualified: number; eventIds: string[] }>()
  for (const event of salesEvents) {
    const industry = inferIndustry(event.summary)
    const bucket = byIndustry.get(industry) ?? { researched: 0, qualified: 0, eventIds: [] }
    if (event.metadata.outcome_type === "research_completed") bucket.researched += 1
    if (event.metadata.outcome_type === "qualification_completed") bucket.qualified += 1
    bucket.eventIds.push(event.id)
    byIndustry.set(industry, bucket)
  }

  const industryEntries = [...byIndustry.entries()].filter(([, stats]) => stats.researched >= 2)
  if (industryEntries.length >= 2) {
    const ranked = industryEntries
      .map(([industry, stats]) => ({
        industry,
        stats,
        rate: industryConversionRate(stats),
      }))
      .sort((left, right) => right.rate - left.rate)

    const best = ranked[0]
    const baseline = ranked.find((row) => row.industry !== best.industry && row.stats.researched >= 2)
    if (
      baseline &&
      best.stats.qualified >= 1 &&
      best.rate >= baseline.rate + 0.15
    ) {
      const bestLabel = INDUSTRY_LABELS[best.industry] ?? best.industry
      const baselineLabel = INDUSTRY_LABELS[baseline.industry] ?? baseline.industry
      const rateDelta = Math.round((best.rate - baseline.rate) * 100)
      items.push({
        knowledge_id: `memory_events:industry:${best.industry}_vs_${baseline.industry}`,
        organization_id: input.organizationId,
        source: "memory_events",
        specialist: "sales",
        category: "industry",
        finding: `${bestLabel.charAt(0).toUpperCase()}${bestLabel.slice(1)} companies have responded ${rateDelta}% more frequently than ${baselineLabel} prospects in recent research.`,
        confidence: Math.min(95, 55 + best.stats.qualified * 10 + rateDelta),
        supporting_event_count: best.stats.eventIds.length + baseline.stats.eventIds.length,
        first_observed_at: input.generatedAt,
        last_confirmed_at: input.generatedAt,
        superseded_by: null,
        active: true,
        metadata: {
          best_industry: best.industry,
          baseline_industry: baseline.industry,
          qa_marker: GROWTH_ORGANIZATIONAL_KNOWLEDGE_QA_MARKER,
        },
      })
    }
  }

  const outcomes = input.salesOutcomes ?? []
  const outreachItems = outcomes.filter(
    (row) => row.outcome_type === "outreach_prepared" || row.outcome_type === "approval_pending",
  )
  const approvalRequired = outreachItems.filter((row) => row.approval_required)
  if (outreachItems.length >= 2 && approvalRequired.length >= Math.ceil(outreachItems.length * 0.5)) {
    items.push({
      knowledge_id: "memory_events:sales:outreach_approval_workflow",
      organization_id: input.organizationId,
      source: "memory_events",
      specialist: "sales",
      category: "messaging",
      finding:
        "Personalized outreach drafts consistently move to your approval queue before send — operator review is part of the default workflow.",
      confidence: Math.min(90, 60 + approvalRequired.length * 8),
      supporting_event_count: approvalRequired.length,
      first_observed_at: input.generatedAt,
      last_confirmed_at: input.generatedAt,
      superseded_by: null,
      active: true,
      metadata: {
        outreach_count: outreachItems.length,
        approval_count: approvalRequired.length,
        qa_marker: GROWTH_ORGANIZATIONAL_KNOWLEDGE_QA_MARKER,
      },
    })
  }

  const highConfidenceQualifications = salesEvents.filter(
    (row) =>
      row.metadata.outcome_type === "qualification_completed" &&
      typeof row.metadata.confidence === "number" &&
      row.metadata.confidence >= 80,
  )
  if (highConfidenceQualifications.length >= 2) {
    items.push({
      knowledge_id: "memory_events:sales:high_confidence_qualification",
      organization_id: input.organizationId,
      source: "memory_events",
      specialist: "sales",
      category: "sales_process",
      finding: `High-confidence qualified opportunities are emerging from recent research (${highConfidenceQualifications.length} validated this period).`,
      confidence: Math.min(92, 65 + highConfidenceQualifications.length * 5),
      supporting_event_count: highConfidenceQualifications.length,
      first_observed_at: input.generatedAt,
      last_confirmed_at: input.generatedAt,
      superseded_by: null,
      active: true,
      metadata: {
        qualification_count: highConfidenceQualifications.length,
        qa_marker: GROWTH_ORGANIZATIONAL_KNOWLEDGE_QA_MARKER,
      },
    })
  }

  return items
}

export function mergeOrganizationalKnowledgeItems(
  existing: OrganizationalKnowledgeItem[],
  incoming: OrganizationalKnowledgeItem[],
): OrganizationalKnowledgeItem[] {
  const byId = new Map<string, OrganizationalKnowledgeItem>()
  for (const item of existing) {
    byId.set(item.knowledge_id, item)
  }
  for (const item of incoming) {
    const prior = byId.get(item.knowledge_id)
    if (!prior) {
      byId.set(item.knowledge_id, item)
      continue
    }
    byId.set(item.knowledge_id, {
      ...item,
      first_observed_at: prior.first_observed_at,
      last_confirmed_at: item.last_confirmed_at,
      confidence: Math.max(prior.confidence, item.confidence),
      supporting_event_count: Math.max(prior.supporting_event_count, item.supporting_event_count),
    })
  }
  return [...byId.values()]
    .filter((row) => row.active && !row.superseded_by)
    .sort((left, right) => right.confidence - left.confidence)
}

export function buildOrganizationalKnowledge(input: {
  organizationId: string
  generatedAt: string
  report: BusinessIntelligenceReport | null
  reviewDecisions?: BusinessIntelligenceReviewDecisionRecord[]
  memoryEvents: AvaMemoryEvent[]
  salesOutcomes?: SalesOutcome[]
  existingItems?: OrganizationalKnowledgeItem[]
}): OrganizationalKnowledgeItem[] {
  const fromBi = buildKnowledgeFromBusinessIntelligence({
    organizationId: input.organizationId,
    generatedAt: input.generatedAt,
    report: input.report,
    reviewDecisions: input.reviewDecisions,
  })
  const fromMemory = buildKnowledgeFromMemoryEvents({
    organizationId: input.organizationId,
    generatedAt: input.generatedAt,
    memoryEvents: input.memoryEvents,
    salesOutcomes: input.salesOutcomes,
  })

  return mergeOrganizationalKnowledgeItems(input.existingItems ?? [], [...fromBi, ...fromMemory]).slice(
    0,
    100,
  )
}

export function buildKnowledgeInsightBullets(items: OrganizationalKnowledgeItem[]): string[] {
  return items
    .filter((row) => row.active && row.finding.trim())
    .sort((left, right) => right.confidence - left.confidence)
    .slice(0, 3)
    .map((row) => row.finding.replace(/\.$/, "") + ".")
}

export function buildKnowledgeNarrativeLines(items: OrganizationalKnowledgeItem[]): string[] {
  const top = items
    .filter((row) => row.active)
    .sort((left, right) => right.confidence - left.confidence)
    .slice(0, 2)
  return top.map((row) => {
    const finding = row.finding.replace(/\.$/, "")
    if (/^operator-confirmed/i.test(finding)) return finding + "."
    return `I also learned that ${finding.charAt(0).toLowerCase()}${finding.slice(1)}.`
  })
}
