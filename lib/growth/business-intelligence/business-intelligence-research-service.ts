/** GE-AIOS-8A-6 — Operator-initiated Business Intelligence research (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import type { GrowthBusinessIntelligenceReportPayload } from "@/lib/growth/business-intelligence/business-intelligence-api-contract"
import { fetchBusinessIntelligenceReportReadModel } from "@/lib/growth/business-intelligence/business-intelligence-report-read-service"
import { runBusinessIntelligence } from "@/lib/growth/business-intelligence/run-business-intelligence"
import { getActiveApprovedBusinessProfile } from "@/lib/growth/business-profile/business-profile-repository"
import { runEvidenceEngine } from "@/lib/growth/evidence-engine/run-evidence-engine"

export type RunBusinessIntelligenceResearchDeps = {
  runEvidenceEngine?: typeof runEvidenceEngine
  runBusinessIntelligence?: typeof runBusinessIntelligence
  fetchBusinessIntelligenceReportReadModel?: typeof fetchBusinessIntelligenceReportReadModel
  getActiveApprovedBusinessProfile?: typeof getActiveApprovedBusinessProfile
}

export type RunBusinessIntelligenceResearchResult =
  | {
      ok: true
      cached: boolean
      evidence_cached: boolean
      payload: GrowthBusinessIntelligenceReportPayload
    }
  | {
      ok: false
      message: string
    }

function resolveWebsiteUrl(input: {
  websiteUrl?: string | null
  approvedWebsite?: string | null
  profileWebsite?: string | null
}): string | null {
  return input.websiteUrl?.trim() || input.approvedWebsite?.trim() || input.profileWebsite?.trim() || null
}

export async function runBusinessIntelligenceOperatorResearch(
  admin: SupabaseClient,
  input: {
    organizationId: string
    forceRefresh?: boolean
    websiteUrl?: string | null
    deps?: RunBusinessIntelligenceResearchDeps
  },
): Promise<RunBusinessIntelligenceResearchResult> {
  const deps = input.deps ?? {}
  const forceRefresh = input.forceRefresh === true
  const loadApprovedProfile = deps.getActiveApprovedBusinessProfile ?? getActiveApprovedBusinessProfile
  const runEvidenceEngineImpl = deps.runEvidenceEngine ?? runEvidenceEngine
  const runBusinessIntelligenceImpl = deps.runBusinessIntelligence ?? runBusinessIntelligence
  const fetchReadModel = deps.fetchBusinessIntelligenceReportReadModel ?? fetchBusinessIntelligenceReportReadModel

  const approvedProfile = await loadApprovedProfile(admin, input.organizationId)
  const websiteUrl = resolveWebsiteUrl({
    websiteUrl: input.websiteUrl,
    approvedWebsite: approvedProfile?.website ?? null,
    profileWebsite: approvedProfile?.profile?.company?.website ?? null,
  })

  let evidenceResult: Awaited<ReturnType<typeof runEvidenceEngine>>
  try {
    evidenceResult = await runEvidenceEngineImpl({
      admin,
      organizationId: input.organizationId,
      trigger: "operator_request",
      providers: ["website", "approved_profile"],
      websiteUrl,
      persist: true,
      forceRefresh,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Evidence collection failed."
    return { ok: false, message: `Could not research your company: ${message}` }
  }

  if (!evidenceResult.ok) {
    return { ok: false, message: "Could not research your company: evidence collection did not complete." }
  }

  let biResult: Awaited<ReturnType<typeof runBusinessIntelligence>>
  try {
    biResult = await runBusinessIntelligenceImpl({
      admin,
      organizationId: input.organizationId,
      runEvidenceEngine: false,
      persist: true,
      includeAiRecommendations: true,
      forceRefresh,
      websiteUrl,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Business Intelligence build failed."
    return { ok: false, message: `Could not build Ava's understanding: ${message}` }
  }

  if (!biResult.ok || biResult.empty_state || !biResult.report) {
    return {
      ok: false,
      message: biResult.message ?? "Research completed but Ava could not build a Business Intelligence report.",
    }
  }

  const readModel = await fetchReadModel(admin, {
    organizationId: input.organizationId,
    includeAiRecommendations: true,
  })

  if (readModel.empty_state || !readModel.payload?.report) {
    return {
      ok: false,
      message: "Research completed but the Business Intelligence report is unavailable.",
    }
  }

  return {
    ok: true,
    cached: evidenceResult.cached === true,
    evidence_cached: evidenceResult.cached === true,
    payload: readModel.payload,
  }
}
