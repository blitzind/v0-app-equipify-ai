/** GE-AIOS-8A-7 — Business Intelligence review decision logic (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import type { BusinessIntelligenceReportField } from "@/lib/growth/business-intelligence/business-intelligence-types"
import type { BusinessIntelligenceReport } from "@/lib/growth/business-intelligence/business-intelligence-types"
import { isUnknownField } from "@/lib/growth/business-intelligence/business-intelligence-fact-mapper"
import {
  fetchLatestBusinessIntelligenceReport,
} from "@/lib/growth/business-intelligence/business-intelligence-repository"
import {
  fetchBusinessIntelligenceReviewDecisions,
  isBusinessIntelligenceReviewSchemaReady,
  upsertBusinessIntelligenceReviewDecision,
} from "@/lib/growth/business-intelligence/business-intelligence-review-repository"
import type {
  BusinessIntelligenceReviewDecisionRecord,
  BusinessIntelligenceReviewDecisionSummary,
  BusinessIntelligenceReviewDecisionType,
  BusinessIntelligenceReviewFieldKey,
  BusinessIntelligenceReviewFieldValue,
  BusinessIntelligenceReviewProgress,
} from "@/lib/growth/business-intelligence/business-intelligence-review-types"
import {
  BUSINESS_INTELLIGENCE_REVIEW_FIELD_KEYS,
  isBusinessIntelligenceReviewFieldKey,
} from "@/lib/growth/business-intelligence/business-intelligence-review-types"

const CONTRADICTION_FACT_FIELD_MAP: Record<string, BusinessIntelligenceReviewFieldKey> = {
  "company.description": "company.company_description",
}

export function getBusinessIntelligenceReportFieldByKey(
  report: BusinessIntelligenceReport,
  fieldKey: BusinessIntelligenceReviewFieldKey,
): BusinessIntelligenceReportField | null {
  const [section, fieldName] = fieldKey.split(".")
  if (!section || !fieldName) return null

  if (section === "company") {
    const company = report.sections.company as Record<string, BusinessIntelligenceReportField>
    return company[fieldName] ?? null
  }
  if (section === "market") {
    const market = report.sections.market as Record<string, BusinessIntelligenceReportField>
    return market[fieldName] ?? null
  }
  if (section === "sales") {
    const salesKeyMap: Record<string, string> = {
      likely_buyer_personas: "likely_buyer_personas",
      likely_pain_points: "likely_pain_points",
    }
    const mapped = salesKeyMap[fieldName]
    if (!mapped) return null
    const sales = report.sections.sales_and_growth as Record<string, BusinessIntelligenceReportField>
    return sales[mapped] ?? null
  }

  return null
}

function serializeFieldValue(value: string | string[] | null): BusinessIntelligenceReviewFieldValue {
  if (value == null) return null
  if (Array.isArray(value)) return [...value]
  return value
}

function contradictionFieldKeys(report: BusinessIntelligenceReport): BusinessIntelligenceReviewFieldKey[] {
  const keys = new Set<BusinessIntelligenceReviewFieldKey>()
  for (const contradiction of report.contradictions) {
    const mapped = CONTRADICTION_FACT_FIELD_MAP[contradiction.fact_key]
    if (mapped) keys.add(mapped)
  }
  return [...keys]
}

export function computeBusinessIntelligenceReviewProgress(input: {
  report: BusinessIntelligenceReport
  decisions: BusinessIntelligenceReviewDecisionRecord[]
}): BusinessIntelligenceReviewProgress {
  const decisionByField = new Map(input.decisions.map((decision) => [decision.field_key, decision]))
  const contradictionFields = contradictionFieldKeys(input.report)

  let reviewed_count = 0
  let missing_required_confirmations = 0

  for (const fieldKey of BUSINESS_INTELLIGENCE_REVIEW_FIELD_KEYS) {
    const decision = decisionByField.get(fieldKey)
    if (decision) {
      reviewed_count += 1
      continue
    }

    const field = getBusinessIntelligenceReportFieldByKey(input.report, fieldKey)
    const requiresConfirmation =
      field?.needs_review ||
      contradictionFields.includes(fieldKey) ||
      (isUnknownField(field ?? { value: null, confidence: 0, supporting_evidence_ids: [], source_providers: [], decision_tiers: [], lifecycle_status: "unknown", needs_review: false, explanation: "" }) &&
        fieldKey === "company.plans_pricing")

    if (requiresConfirmation) {
      missing_required_confirmations += 1
    }
  }

  const unresolved_contradictions = contradictionFields.filter(
    (fieldKey) => !decisionByField.has(fieldKey),
  ).length

  const hasActionableDecisions = input.decisions.some(
    (decision) => decision.decision === "approved" || decision.decision === "edited",
  )

  const can_apply_to_profile =
    hasActionableDecisions && unresolved_contradictions === 0 && missing_required_confirmations === 0

  return {
    reviewed_count,
    total_review_fields: BUSINESS_INTELLIGENCE_REVIEW_FIELD_KEYS.length,
    unresolved_contradictions,
    missing_required_confirmations,
    can_apply_to_profile,
  }
}

export function summarizeReviewDecisions(
  decisions: BusinessIntelligenceReviewDecisionRecord[],
): Record<string, BusinessIntelligenceReviewDecisionSummary> {
  const summary: Record<string, BusinessIntelligenceReviewDecisionSummary> = {}
  for (const decision of decisions) {
    summary[decision.field_key] = {
      field_key: decision.field_key,
      decision: decision.decision,
      approved_value_json: decision.approved_value_json,
      decided_at: decision.decided_at,
    }
  }
  return summary
}

export type SaveBusinessIntelligenceReviewDecisionDeps = {
  fetchLatestBusinessIntelligenceReport?: typeof fetchLatestBusinessIntelligenceReport
  fetchBusinessIntelligenceReviewDecisions?: typeof fetchBusinessIntelligenceReviewDecisions
  upsertBusinessIntelligenceReviewDecision?: typeof upsertBusinessIntelligenceReviewDecision
  isBusinessIntelligenceReviewSchemaReady?: typeof isBusinessIntelligenceReviewSchemaReady
}

export async function saveBusinessIntelligenceReviewDecision(
  admin: SupabaseClient,
  input: {
    organizationId: string
    fieldKey: string
    decision: BusinessIntelligenceReviewDecisionType
    approvedValue?: BusinessIntelligenceReviewFieldValue
    decidedBy: string | null
    deps?: SaveBusinessIntelligenceReviewDecisionDeps
  },
): Promise<{
  decision: BusinessIntelligenceReviewDecisionRecord
  progress: BusinessIntelligenceReviewProgress
}> {
  if (!isBusinessIntelligenceReviewFieldKey(input.fieldKey)) {
    throw new Error(`Unknown review field_key: ${input.fieldKey}`)
  }

  const schemaReadyFn = input.deps?.isBusinessIntelligenceReviewSchemaReady ?? isBusinessIntelligenceReviewSchemaReady
  const schemaReady = await schemaReadyFn(admin)
  if (!schemaReady) {
    throw new Error("Business Intelligence review schema is not ready.")
  }

  const fetchLatestReport = input.deps?.fetchLatestBusinessIntelligenceReport ?? fetchLatestBusinessIntelligenceReport
  const reportRecord = await fetchLatestReport(admin, input.organizationId)
  if (!reportRecord?.report) {
    throw new Error("No Business Intelligence report exists to review.")
  }

  const field = getBusinessIntelligenceReportFieldByKey(reportRecord.report, input.fieldKey)
  if (!field) {
    throw new Error(`Field ${input.fieldKey} is not present in the latest Business Intelligence report.`)
  }

  const originalValue = serializeFieldValue(field.value)
  let approvedValue: BusinessIntelligenceReviewFieldValue = originalValue

  if (input.decision === "edited") {
    if (input.approvedValue == null) {
      throw new Error("Edited decisions require approvedValue.")
    }
    approvedValue = input.approvedValue
  } else if (input.decision === "dismissed" || input.decision === "marked_unknown") {
    approvedValue = null
  } else if (input.decision === "needs_more_info") {
    approvedValue = input.approvedValue ?? null
  }

  const upsert = input.deps?.upsertBusinessIntelligenceReviewDecision ?? upsertBusinessIntelligenceReviewDecision
  const saved = await upsert(admin, {
    organization_id: input.organizationId,
    business_intelligence_report_id: reportRecord.report_id,
    evidence_snapshot_id: reportRecord.evidence_snapshot_id,
    field_key: input.fieldKey,
    original_value_json: originalValue,
    approved_value_json: approvedValue,
    decision: input.decision,
    confidence_at_decision: field.confidence,
    supporting_evidence_ids: [...field.supporting_evidence_ids],
    decided_by: input.decidedBy,
    metadata: {
      source: "operator_review",
    },
  })

  const fetchDecisions =
    input.deps?.fetchBusinessIntelligenceReviewDecisions ?? fetchBusinessIntelligenceReviewDecisions
  const allDecisions = await fetchDecisions(admin, {
    organization_id: input.organizationId,
    business_intelligence_report_id: reportRecord.report_id,
  })

  return {
    decision: saved,
    progress: computeBusinessIntelligenceReviewProgress({
      report: reportRecord.report,
      decisions: allDecisions,
    }),
  }
}

export async function loadBusinessIntelligenceReviewState(
  admin: SupabaseClient,
  input: {
    organizationId: string
    reportId: string
    report: BusinessIntelligenceReport
  },
): Promise<{
  decisions: BusinessIntelligenceReviewDecisionRecord[]
  decisionSummaries: Record<string, BusinessIntelligenceReviewDecisionSummary>
  progress: BusinessIntelligenceReviewProgress
}> {
  const schemaReady = await isBusinessIntelligenceReviewSchemaReady(admin)
  if (!schemaReady) {
    return {
      decisions: [],
      decisionSummaries: {},
      progress: computeBusinessIntelligenceReviewProgress({
        report: input.report,
        decisions: [],
      }),
    }
  }

  const decisions = await fetchBusinessIntelligenceReviewDecisions(admin, {
    organization_id: input.organizationId,
    business_intelligence_report_id: input.reportId,
  })

  return {
    decisions,
    decisionSummaries: summarizeReviewDecisions(decisions),
    progress: computeBusinessIntelligenceReviewProgress({
      report: input.report,
      decisions,
    }),
  }
}
