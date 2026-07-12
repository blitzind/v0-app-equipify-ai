/** GE-AIOS-8A-3/8A-4 — Run Business Intelligence from Evidence Engine snapshots (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import {
  generateBusinessIntelligenceAiRecommendations,
  type GenerateBusinessIntelligenceAiRecommendationsDeps,
} from "@/lib/growth/business-intelligence/business-intelligence-ai-recommendations"
import { buildBusinessIntelligenceReport } from "@/lib/growth/business-intelligence/business-intelligence-report-builder"
import {
  fetchBusinessIntelligenceReportBySnapshot,
  fetchLatestBusinessIntelligenceReport,
  isBusinessIntelligenceSchemaReady,
  persistBusinessIntelligenceReport,
} from "@/lib/growth/business-intelligence/business-intelligence-repository"
import type {
  BusinessIntelligenceReport,
  BusinessIntelligenceReportStatus,
  RunBusinessIntelligenceInput,
  RunBusinessIntelligenceResult,
} from "@/lib/growth/business-intelligence/business-intelligence-types"
import { BUSINESS_INTELLIGENCE_EMPTY_SNAPSHOT_MESSAGE } from "@/lib/growth/business-intelligence/business-intelligence-types"
import { fetchLatestEvidenceEngineSnapshot } from "@/lib/growth/evidence-engine/evidence-engine-repository"
import type { EvidenceEngineSnapshotRecord } from "@/lib/growth/evidence-engine/evidence-engine-snapshot"
import { runEvidenceEngine } from "@/lib/growth/evidence-engine/run-evidence-engine"
import type { RunEvidenceEngineDeps } from "@/lib/growth/evidence-engine/run-evidence-engine"

export type RunBusinessIntelligenceDeps = RunEvidenceEngineDeps &
  GenerateBusinessIntelligenceAiRecommendationsDeps & {
    fetchLatestEvidenceEngineSnapshot?: typeof fetchLatestEvidenceEngineSnapshot
    fetchLatestBusinessIntelligenceReport?: typeof fetchLatestBusinessIntelligenceReport
    fetchBusinessIntelligenceReportBySnapshot?: typeof fetchBusinessIntelligenceReportBySnapshot
    persistBusinessIntelligenceReport?: typeof persistBusinessIntelligenceReport
    isBusinessIntelligenceSchemaReady?: typeof isBusinessIntelligenceSchemaReady
    generateBusinessIntelligenceAiRecommendations?: typeof generateBusinessIntelligenceAiRecommendations
  }

export type RunBusinessIntelligenceOptions = RunBusinessIntelligenceInput & {
  admin: SupabaseClient
  deps?: RunBusinessIntelligenceDeps
}

function resolveReportStatus(report: ReturnType<typeof buildBusinessIntelligenceReport>): BusinessIntelligenceReportStatus {
  const totalFields = 25
  const unknown = report.confidence_summary.unknown_count
  if (unknown >= totalFields) return "empty"
  if (unknown > totalFields / 2) return "partial"
  return "completed"
}

async function loadSnapshot(
  admin: SupabaseClient,
  organizationId: string,
  deps: RunBusinessIntelligenceDeps,
): Promise<EvidenceEngineSnapshotRecord | null> {
  const fetchSnapshot = deps.fetchLatestEvidenceEngineSnapshot ?? fetchLatestEvidenceEngineSnapshot
  return fetchSnapshot(admin, organizationId)
}

async function attachAiRecommendationsIfRequested(input: {
  organizationId: string
  report: BusinessIntelligenceReport
  includeAiRecommendations: boolean
  forceRefresh: boolean
  deps: RunBusinessIntelligenceDeps
}): Promise<BusinessIntelligenceReport> {
  if (!input.includeAiRecommendations) {
    return {
      ...input.report,
      ai_recommendations: null,
      ai_recommendations_metadata: { status: "skipped" },
    }
  }

  if (
    !input.forceRefresh &&
    input.report.ai_recommendations &&
    input.report.ai_recommendations.length > 0 &&
    input.report.ai_recommendations_metadata?.status === "ok"
  ) {
    return input.report
  }

  const generate =
    input.deps.generateBusinessIntelligenceAiRecommendations ?? generateBusinessIntelligenceAiRecommendations

  const aiResult = await generate({
    organizationId: input.organizationId,
    report: input.report,
    deps: input.deps,
  })

  return {
    ...input.report,
    ai_recommendations: aiResult.recommendations,
    ai_recommendations_metadata: aiResult.metadata,
  }
}

async function finalizeReport(input: {
  admin: SupabaseClient
  organizationId: string
  report: BusinessIntelligenceReport
  snapshot: EvidenceEngineSnapshotRecord
  persist: boolean
  includeAiRecommendations: boolean
  forceRefresh: boolean
  deps: RunBusinessIntelligenceDeps
}): Promise<RunBusinessIntelligenceResult> {
  const reportWithAi = await attachAiRecommendationsIfRequested({
    organizationId: input.organizationId,
    report: input.report,
    includeAiRecommendations: input.includeAiRecommendations,
    forceRefresh: input.forceRefresh,
    deps: input.deps,
  })

  const status = resolveReportStatus(reportWithAi)
  let reportId: string | null = null
  let persisted = false

  const schemaReadyFn = input.deps.isBusinessIntelligenceSchemaReady ?? isBusinessIntelligenceSchemaReady
  const schemaReady = input.persist ? await schemaReadyFn(input.admin) : false

  if (input.persist && schemaReady) {
    const persistReport = input.deps.persistBusinessIntelligenceReport ?? persistBusinessIntelligenceReport
    reportId = await persistReport(input.admin, {
      organization_id: input.organizationId,
      evidence_snapshot_id: input.snapshot.snapshot_id,
      evidence_run_id: input.snapshot.run_id,
      status,
      report: reportWithAi,
      confidence_summary: reportWithAi.confidence_summary,
      gaps: reportWithAi.gaps,
      source_providers: reportWithAi.source_providers,
      metadata: reportWithAi.metadata,
    })
    persisted = Boolean(reportId)
  }

  return {
    ok: true,
    status,
    organization_id: input.organizationId,
    report: reportWithAi,
    report_id: reportId,
    persisted,
    evidence_snapshot_id: input.snapshot.snapshot_id,
    evidence_run_id: input.snapshot.run_id,
    empty_state: false,
    ai_recommendations_included: input.includeAiRecommendations,
  }
}

export async function runBusinessIntelligence(
  input: RunBusinessIntelligenceOptions,
): Promise<RunBusinessIntelligenceResult> {
  const deps = input.deps ?? {}
  const runEvidenceEngineFlag = input.runEvidenceEngine === true
  const includeAiRecommendations = input.includeAiRecommendations === true
  const persist = input.persist !== false
  const forceRefresh = input.forceRefresh === true

  if (!forceRefresh && persist && !includeAiRecommendations) {
    const fetchLatestReport = deps.fetchLatestBusinessIntelligenceReport ?? fetchLatestBusinessIntelligenceReport
    const latestReport = await fetchLatestReport(input.admin, input.organizationId)
    if (latestReport) {
      const snapshot = await loadSnapshot(input.admin, input.organizationId, deps)
      if (snapshot && latestReport.evidence_snapshot_id === snapshot.snapshot_id) {
        return {
          ok: true,
          status: latestReport.status,
          organization_id: input.organizationId,
          report: latestReport.report,
          report_id: latestReport.report_id,
          persisted: true,
          evidence_snapshot_id: latestReport.evidence_snapshot_id,
          evidence_run_id: latestReport.evidence_run_id,
          empty_state: false,
          ai_recommendations_included: false,
        }
      }
    }
  }

  let snapshot = await loadSnapshot(input.admin, input.organizationId, deps)

  if (!snapshot && runEvidenceEngineFlag) {
    await runEvidenceEngine({
      admin: input.admin,
      organizationId: input.organizationId,
      trigger: "operator_request",
      websiteUrl: input.websiteUrl ?? null,
      persist: true,
      forceRefresh: input.forceRefresh,
      deps,
    })
    snapshot = await loadSnapshot(input.admin, input.organizationId, deps)
  }

  if (!snapshot) {
    return {
      ok: true,
      status: "empty",
      organization_id: input.organizationId,
      empty_state: true,
      message: BUSINESS_INTELLIGENCE_EMPTY_SNAPSHOT_MESSAGE,
      report: null,
      report_id: null,
      persisted: false,
    }
  }

  const fetchBySnapshot = deps.fetchBusinessIntelligenceReportBySnapshot ?? fetchBusinessIntelligenceReportBySnapshot
  if (!forceRefresh && !includeAiRecommendations) {
    const existing = await fetchBySnapshot(input.admin, {
      organization_id: input.organizationId,
      evidence_snapshot_id: snapshot.snapshot_id,
    })
    if (existing) {
      return {
        ok: true,
        status: existing.status,
        organization_id: input.organizationId,
        report: existing.report,
        report_id: existing.report_id,
        persisted: true,
        evidence_snapshot_id: existing.evidence_snapshot_id,
        evidence_run_id: existing.evidence_run_id,
        empty_state: false,
        ai_recommendations_included: false,
      }
    }
  }

  if (!forceRefresh && includeAiRecommendations) {
    const existing = await fetchBySnapshot(input.admin, {
      organization_id: input.organizationId,
      evidence_snapshot_id: snapshot.snapshot_id,
    })
    if (
      existing?.report.ai_recommendations &&
      existing.report.ai_recommendations.length > 0 &&
      existing.report.ai_recommendations_metadata?.status === "ok"
    ) {
      return {
        ok: true,
        status: existing.status,
        organization_id: input.organizationId,
        report: existing.report,
        report_id: existing.report_id,
        persisted: true,
        evidence_snapshot_id: existing.evidence_snapshot_id,
        evidence_run_id: existing.evidence_run_id,
        empty_state: false,
        ai_recommendations_included: true,
      }
    }
  }

  const report = buildBusinessIntelligenceReport({
    organization_id: input.organizationId,
    teammateName: input.teammateName,
    evidence_snapshot_id: snapshot.snapshot_id,
    evidence_run_id: snapshot.run_id,
    snapshot: snapshot.snapshot,
    metadata: {
      evidence_input_hash: snapshot.input_hash,
      generated_from: "evidence_engine_snapshot",
    },
  })

  return finalizeReport({
    admin: input.admin,
    organizationId: input.organizationId,
    report,
    snapshot,
    persist,
    includeAiRecommendations,
    forceRefresh,
    deps,
  })
}
