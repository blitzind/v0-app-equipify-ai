/**
 * AVA-SAL-RUNTIME-CONVERGENCE-1A — Certification.
 *
 *   pnpm test:ava-sal-runtime-convergence-1a
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  AVA_AUTONOMOUS_DISCOVERY_GPT_QUALIFICATION_METADATA_KEY,
  AVA_SAL_RUNTIME_CONVERGENCE_1A_QA_MARKER,
  AVA_SIMPLE_GPT_QUALIFICATION_1A_QA_MARKER,
  hasPersistedAutonomousDiscoveryGptQualificationDecision,
  isAutonomousDiscoveryGptQualificationLead,
  shouldSkipLegacyGrowthEngineOrchestrationForLeadMetadata,
} from "@/lib/growth/ava-reasoning/ava-sal-runtime-convergence-1a"
import { evaluatePortfolioReplenishmentDecision } from "@/lib/growth/portfolio-manager/growth-autonomous-portfolio-replenishment-1a"
import { evaluateGrowthLeadAdmission } from "@/lib/growth/revenue-workflow/evaluate-growth-lead-admission"
import { shouldAutoQueueLeadResearch } from "@/lib/growth/research/growth-lead-research-readiness"
import { shouldScheduleAutonomousDiscoveryGptQualification } from "@/lib/growth/ava-reasoning/ava-autonomous-discovery-gpt-qualification-1a"
import { isSendableAvaSupervisedDraft } from "@/lib/growth/ava-reasoning/equipify-supervised-draft-persistence"

const CERT_ID = AVA_SAL_RUNTIME_CONVERGENCE_1A_QA_MARKER
const ROOT = process.cwd()

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

function sampleGptMarkerMetadata(extra: Record<string, unknown> = {}) {
  return {
    [AVA_AUTONOMOUS_DISCOVERY_GPT_QUALIFICATION_METADATA_KEY]: AVA_SIMPLE_GPT_QUALIFICATION_1A_QA_MARKER,
    intake_site_key: "prospect_search_external_discovery",
    ...extra,
  }
}

async function main() {
  console.log(`[${CERT_ID}] certification\n`)

  // 1. Legacy admission queue depth does not block autonomous replenishment.
  const replenishment = evaluatePortfolioReplenishmentDecision({
    target: {
      minimumHealthyCompanies: 10,
      targetActiveCompanies: 20,
      replenishBatchSize: 5,
      maximumDailyDiscovery: 10,
      maximumQueuedAdmissions: 50,
      maximumConcurrentResearch: 5,
    },
    health: {
      healthState: "needs_replenishment",
      approvedProfilePresent: true,
      admissionsPending: 52,
      counts: {
        activeCompanies: 2,
        activeCandidateInventory: 2,
        researching: 0,
        awaitingAdmission: 30,
        awaitingReview: 22,
        qualified: 0,
        archived: 0,
        rejected: 0,
        invalid: 0,
        discoveryRemaining: 0,
      },
    },
    memory: { discoveriesToday: 0, discoveriesTodayDate: null },
    generatedAt: "2026-07-28T15:00:00.000Z",
  })
  assert.equal(replenishment.blockedByQueueLimit, true)
  assert.equal(replenishment.shouldReplenish, true, "queue depth must not block autonomous discovery")
  console.log("  ✓ admission queue depth does not block autonomous replenishment")

  // 2. GPT-marker intake skips Unified Revenue Workflow.
  const pushSource = readSource("lib/growth/prospect-search/prospect-search-push-to-inbox.ts")
  assert.match(pushSource, /usesAutonomousGptPath/)
  assert.match(pushSource, /autonomous_sal_gpt_path/)
  assert.doesNotMatch(
    pushSource,
    /usesAutonomousGptPath[\s\S]*runUnifiedRevenueWorkflowAfterIntake\(\{[\s\S]*usesAutonomousGptPath: false/,
  )
  console.log("  ✓ GPT-marker push skips Unified Revenue Workflow")

  // 3. GPT-marker leads bypass legacy research/keyword/industry admission.
  const admission = evaluateGrowthLeadAdmission(
    {
      source: "datamoon",
      companyName: "Acme Service Co",
      website: "https://acmeservice.com",
      industry: "Unrelated Industry",
      email: "ops@acmeservice.com",
      contactName: "Ops Lead",
      metadata: sampleGptMarkerMetadata(),
    },
    { approvedProfile: null, activeMissionTitle: null },
    { autonomousGptQualificationPath: true, prospectSearchIndustryGatePassed: false },
  )
  assert.equal(admission.state, "accepted")
  assert.ok(admission.reasons.includes("autonomous_discovery_gpt_path"))
  assert.equal(admission.allowAutoResearch, false)
  assert.equal(
    shouldAutoQueueLeadResearch({
      metadata: sampleGptMarkerMetadata(),
      status: "new",
      website: "https://acmeservice.com",
    }),
    false,
  )
  console.log("  ✓ GPT-marker leads bypass legacy admission/research gates")

  // 4–5. Draft Factory + ASL skip GPT-path leads.
  const dfSource = readSource("lib/growth/draft-factory/draft-factory-supervised-ava-generation-1a.ts")
  assert.match(dfSource, /shouldSkipLegacyGrowthEngineOrchestrationForLeadMetadata/)
  const dfTickSource = readSource("lib/growth/draft-factory/draft-factory-due-scheduler-tick.ts")
  assert.match(dfTickSource, /shouldSkipLegacyGrowthEngineOrchestrationForLeadMetadata/)
  const aslSource = readSource("lib/growth/specialists/execution/execute-sales-workflow-agent.ts")
  assert.match(aslSource, /autonomous_sal_gpt_path/)
  const aslLoopSource = readSource("lib/growth/specialists/execution/run-autonomous-sales-loop.ts")
  assert.match(aslLoopSource, /shouldSkipLegacyGrowthEngineOrchestrationForLeadMetadata/)
  console.log("  ✓ Draft Factory and ASL skip autonomous Sal GPT-path leads")

  // 6–9. Preserved controls remain wired (static presence).
  const discoverySource = readSource("lib/growth/prospect-search/prospect-search-datamoon-discovery-1a.ts")
  assert.match(discoverySource, /isDatamoonAutonomousDiscoveryRunActive/)
  assert.match(replenishment.reason ?? "", /Replenish/)
  const replenishmentSource = readSource("lib/growth/portfolio-manager/growth-autonomous-portfolio-replenishment-1a.ts")
  assert.match(replenishmentSource, /blockedByDailyLimit/)
  assert.match(replenishmentSource, /duplicateDiscoveryPrevented/)
  const pushMetaSource = readSource("lib/growth/prospect-search/prospect-search-push-metadata.ts")
  assert.match(pushMetaSource, /AVA_AUTONOMOUS_DISCOVERY_GPT_QUALIFICATION_METADATA_KEY/)
  console.log("  ✓ single-flight, budget, dedupe, and marker wiring preserved")

  // 10–12. GPT idempotency + pursue/reject/hold draft semantics unchanged.
  assert.equal(isAutonomousDiscoveryGptQualificationLead(sampleGptMarkerMetadata()), true)
  assert.equal(
    shouldScheduleAutonomousDiscoveryGptQualification({
      id: "lead-1",
      status: "new",
      metadata: sampleGptMarkerMetadata({
        ava_gpt_qualification: { evaluated_at: "2026-07-28T00:00:00.000Z", decision: "reject" },
      }),
    }),
    false,
  )
  assert.equal(
    hasPersistedAutonomousDiscoveryGptQualificationDecision(
      sampleGptMarkerMetadata({
        ava_gpt_qualification: { evaluated_at: "2026-07-28T00:00:00.000Z", decision: "hold" },
      }),
    ),
    true,
  )
  assert.equal(
    shouldSkipLegacyGrowthEngineOrchestrationForLeadMetadata(
      sampleGptMarkerMetadata({
        ava_gpt_qualification: { evaluated_at: "2026-07-28T00:00:00.000Z", decision: "pursue" },
      }),
    ),
    true,
  )
  assert.equal(
    isSendableAvaSupervisedDraft({
      status: "draft",
      sentAt: null,
      classification: { primary: "reject" },
    }),
    false,
  )
  console.log("  ✓ GPT idempotency and pursue-only draft semantics unchanged")

  // 13–15. Home review + legacy path retention (no destructive deletes).
  const homeSource = readSource("lib/growth/ava-reasoning/equipify-supervised-home-projection-1a.ts")
  assert.match(homeSource, /readyForReview/)
  assert.match(readSource("lib/growth/revenue-workflow/unified-revenue-workflow-intake-runner.ts"), /runUnifiedRevenueWorkflowAfterIntake/)
  assert.match(readSource("lib/growth/ava-reasoning/ava-direct/equipify-ava-direct-reasoning.ts"), /runSalesReasoningFromEvidence/)
  console.log("  ✓ Home review, legacy IRE, and @fuzor/sales runtime retained")

  console.log(`\n[${CERT_ID}] PASS`)
}

void main().catch((error) => {
  console.error(error)
  process.exit(1)
})
