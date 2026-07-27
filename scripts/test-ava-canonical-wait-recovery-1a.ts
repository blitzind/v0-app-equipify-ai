/**
 * AVA-CANONICAL-WAIT-RECOVERY-1A — Certification.
 * Run: pnpm test:ava-canonical-wait-recovery-1a
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { evaluateGrowth5fPackagePreparation } from "@/lib/growth/aios/growth/growth-canonical-decision-engine-1c-enforcement"
import {
  GROWTH_CANONICAL_OUTREACH_PACKAGE_AUTHORITY_1A_QA_MARKER,
  isAuthoritativeCanonicalOutreachPackage,
  outreachApprovalPackageHasDurableBody,
  selectLatestAuthoritativeOutreachPackage,
} from "@/lib/growth/aios/growth/growth-canonical-outreach-package-authority-1a"
import type { GrowthCanonicalDecisionResolution } from "@/lib/growth/aios/growth/growth-canonical-decision-engine-1b-types"
import type { GrowthAutonomousOutreachApprovalPackage } from "@/lib/growth/aios/growth/growth-autonomous-outreach-preparation-pilot-types"

const QA_MARKER = "ava-canonical-wait-recovery-1a-v1" as const
const ROOT = process.cwd()

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

function orphanPackage(): GrowthAutonomousOutreachApprovalPackage {
  return {
    packageId: "outreach-prep:lead-1:2026-07-23T05:41:10.332Z",
    leadId: "lead-1",
    companyName: "Example Co",
    preparedAt: "2026-07-23T05:41:10.332Z",
    generatedAssets: [],
    personalizationEvidence: [],
    supportingResearch: [],
    confidence: 0.5,
    approvalRequirements: [],
    complianceNotes: [],
    recommendedChannel: "email",
    recommendedSequence: "single",
    expectedOutcome: "outreach-prep",
    pendingHumanApproval: true,
    transportBlocked: true,
    salesStrategyBrief: {
      relationshipAssessment: {
        available: true,
        relationshipGoal: {
          current: "expand_committee",
          label: "Expand committee",
          rationale: "Single-thread risk",
          successCriteria: "Identify stakeholder",
          progress: 0.35,
          completed: false,
          nextGoal: "identify_champion",
        },
        relationshipProtection: { active: false, action: "none", rationale: [] },
        trustBudget: { level: "maintaining", rationale: [] },
        relationshipMomentum: { trend: "building", rationale: [] },
        relationshipImprovementLikelihood: { ifProceed: "maintain", rationale: [] },
        relationshipDirection: "building",
      },
      revenueStrategyIntelligence: {
        recommendation: "delay",
        confidenceScore: 0.7,
        summary: "Wait",
        channelPlan: "email",
        sequencePlan: "single",
        primaryEntryPoint: "email",
        committeeStrategy: "expand",
        opportunityReadiness: { overall: 0.5 },
      },
    } as GrowthAutonomousOutreachApprovalPackage["salesStrategyBrief"],
  }
}

function waitDecision(): GrowthCanonicalDecisionResolution {
  return {
    qaMarker: "ge-aios-decision-engine-1b-v1",
    organizationId: "org",
    leadId: "lead-1",
    generatedAt: "2026-07-27T12:00:00.000Z",
    companyName: "Example Co",
    decision: {
      qaMarker: "ge-aios-decision-engine-1a-v1",
      decisionId: "decision:lead-1:test",
      decisionFingerprint: "fp",
      organizationId: "org",
      leadId: "lead-1",
      generatedAt: "2026-07-27T12:00:00.000Z",
      primaryAction: "wait",
      title: "Wait per revenue strategy",
      rationale: ["Revenue strategy recommends delay"],
      urgency: "scheduled",
      confidence: 74,
      recommendedActor: "ava",
      recommendedChannel: "none",
      targetContactId: null,
      targetRole: null,
      waitUntil: null,
      prerequisites: [],
      blockedBy: [],
      supportingActions: [],
      suppressedActions: [],
      sourceSummary: {
        relationshipGoal: "Expand committee",
        revenueRecommendation: "delay",
        latestMaterialEvent: null,
        currentStage: "building",
        packageStatus: "none",
        approvalStatus: null,
      },
      operatorReviewRequired: false,
      transportBlocked: true,
    },
    operatorCard: {
      headline: "Wait",
      summary: "Wait",
      essentials: [],
      recommendation: "Wait",
      statusLabel: "Waiting",
    },
    freshness: {
      state: "waiting_on_prospect",
      label: "Waiting on prospect",
      packageGeneratedAt: null,
      approvalAt: null,
      materialEventAt: null,
      decisionFingerprint: "fp",
      packageFingerprint: null,
      strategyChangedSincePackage: false,
      stalePackageRelativeToDecision: false,
    },
    suppressionHints: {
      suppressColdOutreach: true,
      suppressSequenceSends: true,
      suppressDuplicatePackage: false,
      suppressTransport: true,
      reasons: [],
    },
    inputDegraded: [],
  }
}

async function main() {
  console.log(`[${QA_MARKER}] certification\n`)

  assert.equal(
    GROWTH_CANONICAL_OUTREACH_PACKAGE_AUTHORITY_1A_QA_MARKER,
    "ava-canonical-wait-recovery-1a-outreach-package-authority-v1",
  )

  const orphan = orphanPackage()
  assert.equal(outreachApprovalPackageHasDurableBody(orphan), false)
  assert.equal(
    isAuthoritativeCanonicalOutreachPackage({
      package: orphan,
      draftFactoryPackageId: null,
      draftFactoryState: "waiting_for_generation",
    }),
    false,
  )
  console.log("  ✓ orphan pending package without body is not authoritative")

  const selected = selectLatestAuthoritativeOutreachPackage({
    runs: [
      {
        runId: "run-1",
        leadId: "lead-1",
        companyName: "Example Co",
        wakeCondition: "execution_completed",
        outcome: "completed",
        startedAt: orphan.preparedAt,
        completedAt: orphan.preparedAt,
        durationMs: 1,
        packageId: orphan.packageId,
        workflowType: null,
        confidence: 0.5,
        skipReason: null,
        blockReason: null,
        revenueOperatorHandoff: null,
        approvalPackage: {
          ...orphan,
          generatedAssets: [{ label: "email", channel: "email" }],
        },
      },
    ],
    draftFactoryPackageId: null,
    draftFactoryState: "waiting_for_generation",
  })
  assert.equal(selected, null)
  console.log("  ✓ recovered waiting_for_generation ignores legacy prep run even with body")

  const blocked = evaluateGrowth5fPackagePreparation(waitDecision(), {
    proposedPurpose: "outreach-prep",
    wakeCondition: "execution_completed",
  })
  assert.equal(blocked.allowed, false)
  assert.equal(blocked.outcome, "decision_blocked_waiting_on_prospect")
  console.log("  ✓ legitimate strategic wait blocks normal package preparation")

  const allowed = evaluateGrowth5fPackagePreparation(waitDecision(), {
    proposedPurpose: "supervised_ava_outreach_generation",
    wakeCondition: "execution_completed",
    isDraftFactoryGenerationWake: true,
  })
  assert.equal(allowed.allowed, true)
  assert.equal(allowed.outcome, "decision_allowed")
  console.log("  ✓ draft-factory generation wake allows strategic delay to reach GPT-5.5")

  const protectionWait = waitDecision()
  protectionWait.decision.primaryAction = "pause"
  const protectionBlocked = evaluateGrowth5fPackagePreparation(protectionWait, {
    isDraftFactoryGenerationWake: true,
  })
  assert.equal(protectionBlocked.allowed, false)
  console.log("  ✓ relationship protection pause still blocks generation wake")

  const persistence = readSource(
    "lib/growth/aios/growth/growth-autonomous-outreach-preparation-package-persistence.ts",
  )
  assert.match(persistence, /selectLatestAuthoritativeOutreachPackage/)
  assert.match(persistence, /isDraftFactoryGenerationWake: true/)
  assert.match(persistence, /invalidateCanonicalDecisionCacheForLead/)

  const draftService = readSource(
    "lib/growth/aios/growth/growth-autonomous-outreach-preparation-draft-service.ts",
  )
  assert.match(draftService, /isDraftFactoryGenerationWake/)

  const growth5fGate = readSource(
    "lib/growth/aios/growth/growth-canonical-decision-engine-1d-growth5f-gate.ts",
  )
  assert.match(growth5fGate, /isDraftFactoryGenerationWake/)

  const resolver = readSource("lib/growth/aios/growth/resolve-growth-canonical-decision-for-lead.ts")
  assert.match(resolver, /draftFactoryPackageId/)
  assert.match(resolver, /draftFactoryState/)

  const orphanService = readSource(
    "lib/growth/draft-factory/draft-factory-orphan-approval-package-reconcile-service-1a.ts",
  )
  assert.match(orphanService, /invalidateCanonicalDecisionCacheForLead/)

  console.log(`\nPASS — ${QA_MARKER}`)
}

void main().catch((error) => {
  console.error(error)
  process.exit(1)
})
