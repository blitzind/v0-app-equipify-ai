/** GE-AIOS-8A-5 — Read-only Business Intelligence report loader (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import type { GrowthBusinessIntelligenceReportPayload } from "@/lib/growth/business-intelligence/business-intelligence-api-contract"
import { GROWTH_BUSINESS_INTELLIGENCE_EMPTY_MESSAGE } from "@/lib/growth/business-intelligence/business-intelligence-api-contract"
import type { BusinessIntelligenceReport } from "@/lib/growth/business-intelligence/business-intelligence-types"
import {
  fetchLatestBusinessIntelligenceReport,
  isBusinessIntelligenceSchemaReady,
} from "@/lib/growth/business-intelligence/business-intelligence-repository"
import { loadBusinessIntelligenceReviewState } from "@/lib/growth/business-intelligence/business-intelligence-review-service"
import type {
  BusinessIntelligenceReviewDecisionSummary,
  BusinessIntelligenceReviewProgress,
} from "@/lib/growth/business-intelligence/business-intelligence-review-types"
import { fetchEvidenceEngineEvidenceByIds } from "@/lib/growth/evidence-engine/evidence-engine-repository"

function collectEvidenceIdsFromReport(report: BusinessIntelligenceReport): string[] {
  const ids = new Set<string>()

  for (const section of Object.values(report.sections)) {
    for (const field of Object.values(section)) {
      for (const evidenceId of field.supporting_evidence_ids) {
        ids.add(evidenceId)
      }
    }
  }

  for (const contradiction of report.contradictions) {
    for (const evidenceId of contradiction.evidence_ids) {
      ids.add(evidenceId)
    }
  }

  for (const recommendation of report.ai_recommendations ?? []) {
    for (const evidenceId of recommendation.supporting_evidence_ids) {
      ids.add(evidenceId)
    }
  }

  return [...ids]
}

function stripAiRecommendations(report: BusinessIntelligenceReport): BusinessIntelligenceReport {
  return {
    ...report,
    ai_recommendations: null,
    ai_recommendations_metadata: { status: "skipped" },
  }
}

export async function fetchBusinessIntelligenceReportReadModel(
  admin: SupabaseClient,
  input: {
    organizationId: string
    includeAiRecommendations?: boolean
  },
): Promise<{
  schemaReady: boolean
  empty_state: boolean
  message?: string
  payload: GrowthBusinessIntelligenceReportPayload | null
}> {
  const schemaReady = await isBusinessIntelligenceSchemaReady(admin)
  if (!schemaReady) {
    return {
      schemaReady: false,
      empty_state: true,
      message: GROWTH_BUSINESS_INTELLIGENCE_EMPTY_MESSAGE,
      payload: null,
    }
  }

  const record = await fetchLatestBusinessIntelligenceReport(admin, input.organizationId)
  if (!record?.report) {
    return {
      schemaReady: true,
      empty_state: true,
      message: GROWTH_BUSINESS_INTELLIGENCE_EMPTY_MESSAGE,
      payload: null,
    }
  }

  const includeAi = input.includeAiRecommendations === true
  const report = includeAi ? record.report : stripAiRecommendations(record.report)

  const evidenceIds = collectEvidenceIdsFromReport(report)
  const evidenceItems = await fetchEvidenceEngineEvidenceByIds(admin, {
    organization_id: input.organizationId,
    evidence_ids: evidenceIds,
    run_id: record.evidence_run_id,
  })

  const evidence_by_id: GrowthBusinessIntelligenceReportPayload["evidence_by_id"] = {}
  for (const item of evidenceItems) {
    evidence_by_id[item.evidence_id] = {
      evidence_id: item.evidence_id,
      provider: item.provider,
      source_url: item.source_url,
      page_title: item.page_title,
      confidence: item.confidence.overall_confidence,
      decision_tier: item.decision_tier,
      lifecycle_status: item.lifecycle_status,
      raw_excerpt: item.raw_excerpt,
    }
  }

  return {
    schemaReady: true,
    empty_state: false,
    payload: {
      report_id: record.report_id,
      status: record.status,
      generated_at: record.generated_at,
      evidence_snapshot_id: record.evidence_snapshot_id,
      evidence_run_id: record.evidence_run_id,
      report,
      confidence_summary: report.confidence_summary,
      gaps: report.gaps,
      contradictions: report.contradictions,
      ai_recommendations: includeAi ? (report.ai_recommendations ?? null) : null,
      ai_recommendations_metadata: includeAi ? (report.ai_recommendations_metadata ?? null) : { status: "skipped" },
      evidence_by_id,
      ...(await buildReviewPayload(admin, {
        organizationId: input.organizationId,
        reportId: record.report_id,
        report,
      })),
    },
  }
}

async function buildReviewPayload(
  admin: SupabaseClient,
  input: {
    organizationId: string
    reportId: string
    report: BusinessIntelligenceReport
  },
): Promise<{
  review_decisions: Record<string, BusinessIntelligenceReviewDecisionSummary>
  review_progress: BusinessIntelligenceReviewProgress
}> {
  const reviewState = await loadBusinessIntelligenceReviewState(admin, {
    organizationId: input.organizationId,
    reportId: input.reportId,
    report: input.report,
  })

  return {
    review_decisions: reviewState.decisionSummaries,
    review_progress: reviewState.progress,
  }
}
