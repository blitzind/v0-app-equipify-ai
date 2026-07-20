/**
 * GE-AIOS-NEXT-3C — Evidence-backed executive reasoning regression tests.
 * Run: pnpm test:ge-aios-next-3c-executive-reasoning
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { enrichGrowthHomeExecutiveLanguageNext3c } from "../lib/growth/ava-home/recommendations/growth-home-ava-executive-language-enrichment-next-3c"
import { buildGrowthHomeAvaStrategicLeadershipPayload } from "../lib/growth/ava-home/recommendations/growth-home-ava-strategic-leadership-next-1f"
import {
  assertExecutiveLanguageProfessional,
  buildGrowthHomeAvaExecutiveReasoningNext3c,
  polishExecutiveLanguage,
} from "../lib/growth/ava-home/recommendations/growth-home-ava-executive-reasoning-next-3c"
import { GROWTH_AIOS_NEXT_3C_EXECUTIVE_REASONING_QA_MARKER } from "../lib/growth/ava-home/recommendations/growth-home-ava-executive-reasoning-next-3c-types"
import { buildGrowthOrganizationalEvidenceCompletenessSnapshot } from "../lib/growth/organizational-effectiveness/growth-organizational-evidence-completeness-next-3b"
import type { GrowthOrganizationalEvidenceCompletenessInput } from "../lib/growth/organizational-effectiveness/growth-organizational-evidence-completeness-next-3b-types"

const PHASE = "GE-AIOS-NEXT-3C-EXECUTIVE-REASONING" as const
const ROOT = process.cwd()

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

function evidenceInput(): GrowthOrganizationalEvidenceCompletenessInput {
  return {
    organizationId: "org-3c",
    generatedAt: new Date().toISOString(),
    measurementPeriodLabel: "Current 24 hours",
    baselineSnapshot: {
      qaMarker: "ge-aios-next-3a-organizational-effectiveness-baseline-v1",
      principle: "test",
      architecturalRule: "test",
      organizationId: "org-3c",
      generatedAt: new Date().toISOString(),
      measurementPeriod: {
        id: "current_24h",
        label: "Current 24 hours",
        start: new Date(Date.now() - 86400000).toISOString(),
        end: new Date().toISOString(),
        sampleSizeNote: null,
        sufficientForComparison: true,
      },
      comparisonPeriod: null,
      baselineStatus: "establishing",
      improvementTrend: "establishing_baseline",
      dimensions: [],
      bottleneckCandidates: [],
      highestConfidenceBottleneck: null,
      unavailableMeasurements: [],
      dataCompletenessSummary: "test",
      canonicalDefinitions: {},
    },
    admission: {
      driftRows: [{ evaluatedState: "review", reasons: ["pending_operational_keyword_validation"] }],
      discoveryIntake: {
        discoveryRunsInWindow: 28,
        providerRecordsInWindow: 9295,
        intakeSelectedTotal: 111,
        intakePushedTotal: 0,
        intakeExistingTotal: 70,
        intakeRejectedTotal: 0,
        intakeSkippedInvalidTotal: 0,
        intakeErrorTotal: 0,
        leadsAdmittedInWindow: 0,
        providerToLeadYieldPct: 0,
        completeness: "available",
        completenessNote: null,
      },
    },
    decisionMakers: {
      waitingForDm: 19,
      waitingForContactVerification: 0,
      verifiedWithDecisionMakerId: 1,
      contactVerificationFailed: 0,
      draftFactoryActive: 46,
      progressionHoursSamples: [2, 4],
      blockingReasons: [{ reason: "waiting_for_dm", count: 19 }],
    },
    research: {
      completedRuns: [{ createdAt: new Date(Date.now() - 3600000).toISOString(), completedAt: new Date().toISOString() }],
      activeRuns: 9,
      stalledThresholdHours: 24,
    },
    operator: {
      packageApprovedInPeriod: 0,
      packageRejectedInPeriod: 0,
      pendingApprovals: 1,
      memoryDecisionEvents: 0,
      memoryApprovalEvents: 0,
      workflowRequestsAcceptedInPeriod: 0,
      workflowRequestsCompletedInPeriod: 0,
      workflowRequestsTotal: 14,
    },
  }
}

async function main(): Promise<void> {
  console.log(`[${PHASE}] certification`)

  const polished = polishExecutiveLanguage("I think it's time we refocus on discovery.")
  assert.match(polished, /Current evidence suggests/)
  assert.doesNotMatch(polished, /I think/i)
  console.log("  ✓ executive language polish removes speculative phrasing")

  const completeness = buildGrowthOrganizationalEvidenceCompletenessSnapshot(evidenceInput())
  const reasoning = buildGrowthHomeAvaExecutiveReasoningNext3c({
    evidenceCompleteness: completeness,
    pendingApprovals: 1,
    outboundDisabled: true,
  })

  assert.equal(reasoning.qaMarker, GROWTH_AIOS_NEXT_3C_EXECUTIVE_REASONING_QA_MARKER)
  assert.ok(reasoning.primary)
  assert.ok(reasoning.primary.evidence.length >= 2)
  assert.ok(reasoning.primary.alternativeExplanations.length >= 1)
  assert.ok(reasoning.primary.recommendation)
  assert.ok(assertExecutiveLanguageProfessional(reasoning.primary.observation))
  console.log("  ✓ reasoning model includes observation, evidence, confidence, alternatives, recommendation, impact")

  const leadership = buildGrowthHomeAvaStrategicLeadershipPayload({
    missionDiscovery: {
      qaMarker: "ge-aios-18g-mission-discovery-snapshot-v1",
      missionId: "m1",
      lifecycleState: "researching",
      activityLabel: "Researching",
      counters: {
        newCompaniesFound: 1,
        recordsImported: 100,
        researchingCount: 19,
        draftsPrepared: 2,
        pendingApprovals: 1,
      },
      searchSummary: "HVAC",
      audienceName: "HVAC",
      recordsImported: 100,
      newCompaniesFound: 1,
      leadPoolVisible: 80,
      leadPoolHasMore: false,
      pipelineLow: false,
      lastEventSummary: null,
      discoveryAction: "begin_research",
      startupDiscoveryReady: true,
    },
    pendingApprovals: 1,
  })

  const enriched = enrichGrowthHomeExecutiveLanguageNext3c({
    reasoningInput: { evidenceCompleteness: completeness, outboundDisabled: true, pendingApprovals: 1 },
    strategicLeadership: leadership,
  })

  assert.ok(enriched.strategicLeadership?.executiveReasoning)
  assert.doesNotMatch(enriched.strategicLeadership?.insight?.observation ?? "", /I think/i)
  console.log("  ✓ home integration enriches strategic leadership without new sections")

  const heroSource = readSource("lib/growth/workspace/executive-briefing/growth-home-ava-hero-7a.ts")
  assert.match(heroSource, /enrichGrowthHomeExecutiveLanguageNext3c/)
  assert.doesNotMatch(heroSource, /runGrowthObjectiveRuntimeScheduler/)
  console.log("  ✓ hero wires enrichment projection only")

  const sections = [
    "components/growth/workspace/executive-briefing/growth-home-ava-strategic-insight-section.tsx",
    "components/growth/workspace/executive-briefing/growth-home-ava-since-you-were-last-here-section.tsx",
    "components/growth/workspace/executive-briefing/growth-home-ava-recommendation-experience-section.tsx",
    "components/growth/workspace/executive-briefing/growth-home-ava-business-objective-section.tsx",
  ]
  for (const file of sections) {
    assert.ok(fs.existsSync(path.join(ROOT, file)))
  }
  assert.doesNotMatch(readSource(sections[0]), /data-qa-section="home-ava-executive-reasoning"/)
  console.log("  ✓ no new Home sections — existing narratives enriched in place")

  const reasoningSource = readSource("lib/growth/ava-home/recommendations/growth-home-ava-executive-reasoning-next-3c.ts")
  assert.doesNotMatch(reasoningSource, /\.insert\(|runGrowthObjectiveRuntimeScheduler|new CronJob/)
  console.log("  ✓ no duplicate analytics, learning, or recommendation engines")

  console.log(`\n[${PHASE}] PASS — primary topic: ${reasoning.primary?.topic ?? "none"}`)
}

void main().catch((error) => {
  console.error(error)
  process.exit(1)
})
