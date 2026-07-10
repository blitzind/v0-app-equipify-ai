/** GE-AIOS-23 — Adapt canonical prospect research to legacy LLM research shapes (client-safe). */

import type { GrowthLeadResearchResult, GrowthLeadResearchRun } from "@/lib/growth/research-types"
import type { GrowthResearchRunPublicView } from "@/lib/growth/research/research-types"
import { GROWTH_LEAD_FIT_MODEL_VERSION } from "@/lib/growth/research-schema"

export function mapProspectRunToLegacyResearchResult(
  run: GrowthResearchRunPublicView,
): GrowthLeadResearchResult {
  const evidence = run.signals?.companyEvidence_v22
  const verifiedDescription = evidence?.profile.companyDescription?.value ?? null
  const verifiedIndustries = evidence?.profile.industriesServed?.values ?? []
  const verifiedServices = evidence?.profile.primaryServices?.values ?? []
  const verifiedProducts = evidence?.profile.primaryProducts?.values ?? []

  const companySummary =
    verifiedDescription?.trim() ||
    run.researchSummary?.trim() ||
    `${run.companyName ?? "Company"} prospect research summary unavailable.`

  return {
    companySummary,
    websiteSummary: run.researchSummary,
    likelyServiceCategory: run.industryGuess,
    serviceAreaClues: evidence?.profile.geographicMarkets?.values ?? [],
    companySizeEstimate: run.employeeSizeGuess,
    equipmentServiceIndicators: [...verifiedProducts, ...verifiedServices].slice(0, 6),
    equipifyPainPoints: (run.signals?.painSignals ?? []).map((signal) => signal.replace(/_/g, " ")),
    equipifyFitScore: Math.round((evidence?.qualityScores.overallEvidenceConfidence ?? run.researchConfidence ?? 0.5) * 100),
    outreachAngles: run.suggestedPitchAngle ? [run.suggestedPitchAngle] : [],
    recommendedNextAction: String(run.recommendedNextAction ?? "Manual Review"),
    researchConfidence: Math.round((run.researchConfidence ?? 0.5) * 100),
    sourceUrls: evidence?.evidenceSources ?? [],
    caveats: evidence?.crawlState.missingInformation ?? [],
    fitModelVersion: GROWTH_LEAD_FIT_MODEL_VERSION,
    decisionMakerCandidates: [],
    estimatedAnnualRevenue: run.revenueSizeGuess,
    estimatedEmployeeCount: run.employeeSizeGuess,
    fleetSizeEstimate: null,
    crmDetected: null,
    fieldServiceStackDetected: (run.detectedTechnologies ?? []).slice(0, 3).join(", ") || null,
  }
}

export function mapProspectRunToLegacyResearchRun(
  run: GrowthResearchRunPublicView,
  input?: { createdBy?: string | null; triggerKind?: "manual" | "regenerate" },
): GrowthLeadResearchRun {
  const legacyStatus =
    run.status === "completed" ? "succeeded" : run.status === "failed" ? "failed" : run.status

  return {
    id: run.id,
    leadId: run.leadId,
    status: legacyStatus as GrowthLeadResearchRun["status"],
    triggerKind: input?.triggerKind ?? "manual",
    websiteUrl: run.websiteUrl,
    websiteFetchStatus: run.status === "completed" ? "ok" : "failed",
    websiteTextExcerpt: run.researchSummary,
    sourceUrls: run.signals?.companyEvidence_v22?.evidenceSources ?? [],
    result: run.status === "completed" ? mapProspectRunToLegacyResearchResult(run) : null,
    researchConfidence: run.researchConfidence,
    equipifyFitScore: mapProspectRunToLegacyResearchResult(run).equipifyFitScore,
    modelTask: "canonical_prospect_research_v23",
    modelProvider: "growth_prospect_research",
    modelName: "runProspectResearch",
    errorCode: run.failedReason ? "research_failed" : null,
    errorMessage: run.failedReason,
    durationMs: null,
    inputHash: null,
    createdBy: input?.createdBy ?? null,
    createdAt: run.createdAt,
    finishedAt: run.completedAt,
  }
}
