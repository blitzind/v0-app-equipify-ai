/** GE-AIOS-23 — Adapt canonical prospect research to legacy LLM research shapes (client-safe). */

import type { GrowthLeadResearchNotes, GrowthLeadResearchResult, GrowthLeadResearchRun } from "@/lib/growth/research-types"
import type {
  GrowthProspectIntelligenceBundle,
  GrowthResearchRunPublicView,
} from "@/lib/growth/research/research-types"
import { GROWTH_LEAD_FIT_MODEL_VERSION } from "@/lib/growth/research-schema"
import { normalizeGrowthResearchConfidence } from "@/lib/growth/research/research-confidence"

export const GROWTH_CANONICAL_RESEARCH_READ_PROJECTION_QA_MARKER =
  "ge-aios-hotfix-live-1c-4-canonical-research-read-v1" as const

function isUsableLegacyResearchRun(run: GrowthLeadResearchRun | null | undefined): boolean {
  return run?.status === "succeeded" || run?.status === "partial"
}

function sortResearchRunsDesc(runs: GrowthLeadResearchRun[]): GrowthLeadResearchRun[] {
  return [...runs].sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
}

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
    equipifyFitScore: Math.round((evidence?.qualityScores.overallEvidenceConfidence ?? 0.5) * 100),
    outreachAngles: run.suggestedPitchAngle ? [run.suggestedPitchAngle] : [],
    recommendedNextAction: String(run.recommendedNextAction ?? "Manual Review"),
    researchConfidence: normalizeGrowthResearchConfidence(run.researchConfidence) ?? 0,
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
    researchConfidence: normalizeGrowthResearchConfidence(run.researchConfidence),
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

/** Read-only GET projection — never writes to growth.lead_research_runs. */
export function projectGrowthLeadResearchBundleReadModel(input: {
  legacyRuns: GrowthLeadResearchRun[]
  legacyLatestRun: GrowthLeadResearchRun | null
  manualNotes: GrowthLeadResearchNotes | null
  prospectIntelligence: GrowthProspectIntelligenceBundle
}): {
  runs: GrowthLeadResearchRun[]
  latestRun: GrowthLeadResearchRun | null
  manualNotes: GrowthLeadResearchNotes | null
} {
  const projectedCanonicalRuns = input.prospectIntelligence.runs
    .filter((run) => run.status === "completed")
    .map((run) => mapProspectRunToLegacyResearchRun(run))

  const legacyRunIds = new Set(input.legacyRuns.map((run) => run.id))
  const projectedOnly = projectedCanonicalRuns.filter((run) => !legacyRunIds.has(run.id))
  const runs = sortResearchRunsDesc([...projectedOnly, ...input.legacyRuns])

  const canonicalLatest =
    (input.prospectIntelligence.latestRun?.status === "completed"
      ? mapProspectRunToLegacyResearchRun(input.prospectIntelligence.latestRun)
      : null) ??
    projectedCanonicalRuns[0] ??
    null

  const latestRun =
    canonicalLatest ??
    (isUsableLegacyResearchRun(input.legacyLatestRun) ? input.legacyLatestRun : null) ??
    runs.find((run) => isUsableLegacyResearchRun(run)) ??
    null

  return {
    runs,
    latestRun,
    manualNotes: input.manualNotes,
  }
}
