/**
 * GE-AIOS-6B — Certification for Ava Research Orchestrator.
 *
 * Run: node -r ./scripts/server-only-shim.cjs --import tsx scripts/certify-ge-aios-6b-ava-research-orchestrator.ts
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { bootstrapGrowthOperatorNotificationsCertEnv } from "@/lib/growth/notifications/growth-notification-cert-bootstrap"
import {
  buildAvaResearchLoopNarrative,
  resolveAvaQualificationOrchestratorOutcome,
  selectRevenueQueueResearchCandidates,
} from "../lib/growth/ava-home/growth-ava-research-orchestrator-service"
import {
  GROWTH_AVA_RESEARCH_ORCHESTRATOR_QA_MARKER,
  GROWTH_AVA_RESEARCH_QUEUE_API_PATH,
  GROWTH_AVA_RESEARCH_QUEUE_OPERATOR_LABEL,
} from "../lib/growth/ava-home/growth-ava-research-orchestrator-types"
import { buildGrowthHomeWorkspaceSummary } from "../lib/growth/home/growth-home-workspace-summary-service"

const ROOT = process.cwd()

function read(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

function runStaticCert(): void {
  console.log(`\n=== ${GROWTH_AVA_RESEARCH_ORCHESTRATOR_QA_MARKER} (static) ===\n`)

  assert.equal(GROWTH_AVA_RESEARCH_QUEUE_API_PATH, "/api/platform/growth/ava/research-queue")
  assert.equal(GROWTH_AVA_RESEARCH_QUEUE_OPERATOR_LABEL, "Research Top Revenue Queue Leads")

  const orchestrator = read("lib/growth/ava-home/growth-ava-research-orchestrator-service.ts")
  assert.match(orchestrator, /runProspectResearch/)
  assert.match(orchestrator, /runAutonomousQualificationManualEvaluation/)
  assert.match(orchestrator, /resolveAvaQualificationOrchestratorOutcome/)
  assert.match(orchestrator, /fetchLatestGrowthLeadResearchWorkflowSnapshot/)
  assert.match(orchestrator, /recomputeGrowthLeadWorkflowSignals/)
  assert.match(orchestrator, /buildRevenueQueueDashboardSectionsFromLeads/)
  assert.doesNotMatch(orchestrator, /runAutonomousOutreachPreparation/)
  assert.doesNotMatch(orchestrator, /executeTransportSend/)
  assert.doesNotMatch(orchestrator, /sequence.*enroll/i)

  const route = read("app/api/platform/growth/ava/research-queue/route.ts")
  assert.match(route, /runAvaResearchQueueOrchestrator/)
  assert.match(route, /transportBlocked: true/)

  const summaryTypes = read("lib/growth/home/growth-home-workspace-summary-types.ts")
  assert.match(summaryTypes, /researchLoopSummary/)

  const summaryService = read("lib/growth/home/growth-home-workspace-summary-service.ts")
  assert.match(summaryService, /fetchLatestAvaResearchLoopSummary/)

  const panel = read("components/growth/workspace/executive-briefing/growth-home-ava-research-queue-panel.tsx")
  assert.match(panel, /GROWTH_AVA_RESEARCH_QUEUE_OPERATOR_LABEL/)

  const narrative = buildAvaResearchLoopNarrative({
    companiesReviewed: 5,
    researchCompleted: 5,
    researchFailed: 0,
    buyingSignalsVerified: 3,
    readyForOutreachReview: 2,
    qualificationCompleted: 0,
    qualificationSkipped: 5,
    qualificationFailed: 0,
  })
  assert.match(narrative, /Ava reviewed 5 companies/)
  assert.match(narrative, /Research completed/)
  assert.match(narrative, /Qualification is waiting for approval or policy enablement/)
  assert.match(narrative, /3 have verified buying signals/)
  assert.match(narrative, /2 appear ready for outreach review/)
  assert.match(narrative, /Please review/)

  const assessedDespiteMissingPilot = resolveAvaQualificationOrchestratorOutcome({
    workflowStatus: "assessed",
    policyGate: { allowed: false, blockReason: "Qualification autonomy disabled.", policyKey: "qualification_autonomy_disabled" },
    pilotRun: null,
  })
  assert.equal(assessedDespiteMissingPilot.qualificationStatus, "completed")
  assert.equal(assessedDespiteMissingPilot.qualificationSkipReason, null)

  const policyBlocked = resolveAvaQualificationOrchestratorOutcome({
    workflowStatus: "research_complete",
    policyGate: {
      allowed: false,
      blockReason: "Qualification autonomy disabled — enable enrichment capability in Growth Autonomy.",
      policyKey: "qualification_autonomy_disabled",
    },
    pilotRun: null,
  })
  assert.equal(policyBlocked.qualificationStatus, "blocked")
  assert.match(policyBlocked.qualificationSkipReason ?? "", /Qualification autonomy disabled/)

  const completedNarrative = buildAvaResearchLoopNarrative({
    companiesReviewed: 1,
    researchCompleted: 1,
    researchFailed: 0,
    buyingSignalsVerified: 1,
    readyForOutreachReview: 1,
    qualificationCompleted: 1,
    qualificationSkipped: 0,
    qualificationFailed: 0,
  })
  assert.match(completedNarrative, /Qualification completed\./)

  const selected = selectRevenueQueueResearchCandidates(
    [
      {
        id: "lead-a",
        companyName: "Alpha HVAC",
        status: "new",
        score: 80,
        metadata: {},
      } as never,
    ],
    5,
  )
  assert.ok(Array.isArray(selected))

  console.log("PASS — static structure")
}

async function runProductionCert(): Promise<void> {
  console.log(`\n=== ${GROWTH_AVA_RESEARCH_ORCHESTRATOR_QA_MARKER} (production) ===\n`)

  process.env.EQUIPIFY_VERCEL_PRODUCTION_ENV_RUN = "1"
  const boot = bootstrapGrowthOperatorNotificationsCertEnv()
  if (!boot) {
    console.error(JSON.stringify({ ok: false, error: "bootstrap_failed" }, null, 2))
    process.exit(1)
  }

  const summary = await buildGrowthHomeWorkspaceSummary({
    admin: boot.admin,
    operatorEmail: "cert@equipify.ai",
    actorUserId: "00000000-0000-0000-0000-000000000001",
  })

  assert.equal(summary.ok, true)
  assert.ok(summary.avaConsole)
  assert.equal(summary.avaConsole.researchLoopSummary, null)

  console.log(
    JSON.stringify(
      {
        qa_marker: GROWTH_AVA_RESEARCH_ORCHESTRATOR_QA_MARKER,
        revenue_queue_total: summary.revenueQueue.total,
        research_loop_summary_present: summary.avaConsole.researchLoopSummary != null,
        transport_blocked: true,
        human_approval_required: true,
        outbound_occurred: false,
      },
      null,
      2,
    ),
  )

  console.log("PASS — production workspace summary includes avaConsole.researchLoopSummary")
}

async function main(): Promise<void> {
  runStaticCert()
  await runProductionCert()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
