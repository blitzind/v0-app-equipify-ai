/**
 * GE-AIOS-HOTFIX-LIVE-1C-4 — Canonical CRM research read projection certification.
 * Run: pnpm test:ge-aios-hotfix-live-1c-4-canonical-research-read
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_CANONICAL_RESEARCH_READ_PROJECTION_QA_MARKER,
  mapProspectRunToLegacyResearchRun,
  projectGrowthLeadResearchBundleReadModel,
} from "../lib/growth/research/growth-canonical-research-legacy-adapter"
import { normalizeGrowthResearchConfidence } from "../lib/growth/research/research-confidence"
import { GROWTH_COMPANY_EVIDENCE_22_QA_MARKER } from "../lib/growth/research/company-evidence/company-evidence-types"
import type { GrowthResearchRunPublicView } from "../lib/growth/research/research-types"
import type { GrowthLeadResearchRun } from "../lib/growth/research-types"

const PHASE = "GE-AIOS-HOTFIX-LIVE-1C-4" as const

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function sampleCanonicalRun(overrides: Partial<GrowthResearchRunPublicView> = {}): GrowthResearchRunPublicView {
  return {
    id: "canonical-run-1",
    leadId: "lead-block-imaging",
    status: "completed",
    websiteUrl: "https://blockimaging.com",
    companyName: "Block Imaging",
    industryGuess: "Medical Equipment",
    employeeSizeGuess: "51-200",
    revenueSizeGuess: null,
    websiteMaturityScore: 62,
    socialPresenceScore: null,
    reputationScore: null,
    technologyScore: 40,
    detectedTechnologies: ["WordPress"],
    signals: {
      painSignals: [],
      companyEvidence_v22: {
        qaMarker: GROWTH_COMPANY_EVIDENCE_22_QA_MARKER,
        collectedAt: "2026-07-10T20:00:00.000Z",
        websiteUrl: "https://blockimaging.com",
        profile: {},
        qualityScores: {
          identityConfidence: 0.8,
          websiteConfidence: 0.8,
          industryConfidence: 0.7,
          offeringConfidence: 0.7,
          marketConfidence: 0.6,
          overallEvidenceConfidence: 0.72,
        },
        crawlState: {
          pagesPlanned: 3,
          pagesCrawled: 3,
          pagesSkipped: 0,
          stoppedEarly: false,
          stopReason: null,
          websiteCoverage: ["https://blockimaging.com"],
          missingInformation: [],
        },
        missionComparison: null,
        qualificationExplanation: null,
        evidenceSources: ["https://blockimaging.com"],
        cacheKey: null,
      },
    },
    competitors: [],
    researchSummary: "Block Imaging services medical imaging equipment.",
    suggestedPitchAngle: "Service workflow angle",
    suggestedSequence: null,
    suggestedCallOpening: null,
    recommendedNextAction: "Call Prospect",
    researchConfidence: 72,
    completedAt: "2026-07-10T20:00:00.000Z",
    failedReason: null,
    createdAt: "2026-07-10T19:59:00.000Z",
    ...overrides,
  }
}

function sampleLegacyRun(id: string, createdAt: string): GrowthLeadResearchRun {
  return {
    id,
    leadId: "lead-block-imaging",
    status: "succeeded",
    triggerKind: "manual",
    websiteUrl: "https://legacy.example",
    websiteFetchStatus: "ok",
    websiteTextExcerpt: "Legacy LLM research",
    sourceUrls: [],
    result: {
      companySummary: "Legacy summary",
      websiteSummary: "Legacy summary",
      likelyServiceCategory: "HVAC",
      serviceAreaClues: [],
      companySizeEstimate: null,
      equipmentServiceIndicators: [],
      equipifyPainPoints: [],
      equipifyFitScore: 55,
      outreachAngles: [],
      recommendedNextAction: "Manual Review",
      researchConfidence: 55,
      sourceUrls: [],
      caveats: [],
      fitModelVersion: "v1",
      decisionMakerCandidates: [],
      estimatedAnnualRevenue: null,
      estimatedEmployeeCount: null,
      fleetSizeEstimate: null,
      crmDetected: null,
      fieldServiceStackDetected: null,
    },
    researchConfidence: 55,
    equipifyFitScore: 55,
    modelTask: "legacy_llm",
    modelProvider: "openai",
    modelName: "legacy",
    errorCode: null,
    errorMessage: null,
    durationMs: 1000,
    inputHash: null,
    createdBy: null,
    createdAt,
    finishedAt: createdAt,
  }
}

function main(): void {
  console.log(`[${PHASE}] Canonical CRM research read projection certification`)

  assert.equal(
    GROWTH_CANONICAL_RESEARCH_READ_PROJECTION_QA_MARKER,
    "ge-aios-hotfix-live-1c-4-canonical-research-read-v1",
  )
  console.log("  ✓ read projection QA marker")

  const routeSource = readSource("app/api/platform/growth/leads/[leadId]/research/route.ts")
  assert.match(routeSource, /projectGrowthLeadResearchBundleReadModel/)
  assert.doesNotMatch(routeSource, /insertGrowthLeadResearchRun/)
  console.log("  ✓ GET route projects canonical read model without legacy writes")

  const rebuildRoute = readSource("app/api/platform/growth/leads/[leadId]/research/rebuild/route.ts")
  assert.match(rebuildRoute, /routeCanonicalProspectResearch/)
  assert.doesNotMatch(rebuildRoute, /projectGrowthLeadResearchBundleReadModel/)
  console.log("  ✓ rebuild route unchanged")

  const orchestrator = readSource("lib/growth/research/research-orchestrator.ts")
  assert.match(orchestrator, /Math\.min\(\s*100/)
  assert.doesNotMatch(orchestrator, /Math\.min\(\s*1,\s*\n\s*computeResearchConfidence/)
  console.log("  ✓ orchestrator persists 0–100 research confidence")

  const prospectRepo = readSource("lib/growth/research/research-repository.ts")
  assert.match(prospectRepo, /normalizeGrowthResearchConfidence\(row\.research_confidence\)/)
  console.log("  ✓ prospect repository normalizes confidence on read")

  const card = readSource("components/growth/growth-prospect-intelligence-card.tsx")
  assert.match(card, /normalizeGrowthResearchConfidence/)
  console.log("  ✓ Prospect Intelligence card normalizes confidence for display")

  const canonicalOnly = projectGrowthLeadResearchBundleReadModel({
    legacyRuns: [],
    legacyLatestRun: null,
    manualNotes: null,
    prospectIntelligence: {
      leadId: "lead-block-imaging",
      latestRun: sampleCanonicalRun(),
      runs: [sampleCanonicalRun()],
    },
  })
  assert.ok(canonicalOnly.latestRun)
  assert.equal(canonicalOnly.latestRun?.id, "canonical-run-1")
  assert.equal(canonicalOnly.latestRun?.status, "succeeded")
  assert.equal(canonicalOnly.runs.length, 1)
  console.log("  ✓ canonical-only lead returns non-empty current research bundle")

  const withLegacyHistory = projectGrowthLeadResearchBundleReadModel({
    legacyRuns: [sampleLegacyRun("legacy-run-1", "2026-07-01T12:00:00.000Z")],
    legacyLatestRun: sampleLegacyRun("legacy-run-1", "2026-07-01T12:00:00.000Z"),
    manualNotes: { body: "notes", updatedAt: "2026-07-01T12:00:00.000Z", updatedBy: null },
    prospectIntelligence: {
      leadId: "lead-block-imaging",
      latestRun: sampleCanonicalRun(),
      runs: [sampleCanonicalRun(), sampleCanonicalRun({ id: "canonical-run-0", createdAt: "2026-07-05T12:00:00.000Z", completedAt: "2026-07-05T12:00:00.000Z" })],
    },
  })
  assert.equal(withLegacyHistory.latestRun?.id, "canonical-run-1")
  assert.equal(withLegacyHistory.runs.length, 3)
  assert.ok(withLegacyHistory.runs.some((run) => run.id === "legacy-run-1"))
  console.log("  ✓ legacy history preserved and canonical latest wins")

  const deduped = projectGrowthLeadResearchBundleReadModel({
    legacyRuns: [mapProspectRunToLegacyResearchRun(sampleCanonicalRun())],
    legacyLatestRun: mapProspectRunToLegacyResearchRun(sampleCanonicalRun()),
    manualNotes: null,
    prospectIntelligence: {
      leadId: "lead-block-imaging",
      latestRun: sampleCanonicalRun(),
      runs: [sampleCanonicalRun()],
    },
  })
  assert.equal(deduped.runs.length, 1)
  assert.equal(deduped.latestRun?.id, "canonical-run-1")
  console.log("  ✓ projected history dedupes shared canonical run id")

  assert.equal(normalizeGrowthResearchConfidence(72), 72)
  assert.equal(normalizeGrowthResearchConfidence(0.72), 72)
  assert.equal(normalizeGrowthResearchConfidence(1), 100)
  assert.equal(normalizeGrowthResearchConfidence(null), null)
  console.log("  ✓ confidence normalization handles 0–100 and legacy 0–1 values")

  const projectedConfidence = mapProspectRunToLegacyResearchRun(
    sampleCanonicalRun({ researchConfidence: 68 }),
  ).researchConfidence
  assert.equal(projectedConfidence, 68)
  console.log("  ✓ projected legacy run carries normalized confidence")

  console.log(`[${PHASE}] certification passed`)
}

main()
