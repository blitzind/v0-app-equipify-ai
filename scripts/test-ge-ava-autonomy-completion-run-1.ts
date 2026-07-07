/**
 * GE-AVA-AUTONOMY-COMPLETION-RUN-1 — Async post-import completion orchestrator certification.
 * Run: pnpm test:ge-ava-autonomy-completion-run-1
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_AVA_AUTONOMY_COMPLETION_FEATURE_FLAG,
  GROWTH_AVA_AUTONOMY_COMPLETION_RUN_1_QA_MARKER,
} from "../lib/growth/mission-center/growth-ava-autonomy-completion-types"

const PHASE = "GE-AVA-AUTONOMY-COMPLETION-RUN-1" as const

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

async function main(): Promise<void> {
  console.log(`[${PHASE}] Ava autonomy completion orchestrator certification`)

  assert.equal(GROWTH_AVA_AUTONOMY_COMPLETION_RUN_1_QA_MARKER, "ge-ava-autonomy-completion-run-1-v1")
  assert.equal(GROWTH_AVA_AUTONOMY_COMPLETION_FEATURE_FLAG, "GROWTH_AVA_AUTONOMY_COMPLETION_ENABLED")

  const completion = readSource("lib/growth/mission-center/growth-ava-autonomy-completion-service.ts")
  assert.match(completion, /registerAvaAutonomyCompletionPendingLeads/)
  assert.match(completion, /scheduleAvaAutonomyCompletionForLead/)
  assert.match(completion, /runAvaAutonomyCompletionForLead/)
  assert.match(completion, /fetchLatestGrowthLeadResearchWorkflowSnapshot/)
  assert.match(completion, /buildOpportunityIntelligenceViewModel/)
  assert.match(completion, /resolveLeadCommunicationStrategyBundle/)
  assert.match(completion, /runUnifiedRevenueWorkflowLifecycleReEvaluation/)
  assert.match(completion, /runAutonomousOutreachPreparationManualRequest/)
  assert.match(completion, /fetchAiOsCommandCenterReadModel/)
  assert.match(completion, /workflowStatus !== "assessed"/)
  assert.match(completion, /pendingHumanApproval/)
  assert.doesNotMatch(completion, /startLeadResearchPilotForProspect|scheduleLeadResearchPilotForProspect/)
  assert.doesNotMatch(completion, /sendEmail|enrollSequence|launchCampaign|outboundExecution/i)

  const launch = readSource("lib/growth/mission-center/growth-mission-ava-launch-run-service.ts")
  assert.match(launch, /registerAvaAutonomyCompletionPendingLeads/)
  assert.doesNotMatch(launch, /runAvaAutonomyCompletionForLead/)

  const executor = readSource("lib/growth/aios/pilot/lead-research-agent-executor.ts")
  assert.match(executor, /scheduleAvaAutonomyCompletionForLead/)
  assert.doesNotMatch(executor, /runAvaAutonomyCompletionForLead\(/)

  const runtimeTypes = readSource("lib/growth/mission-center/growth-mission-runtime-types.ts")
  assert.match(runtimeTypes, /avaAutonomyCompletion/)

  console.log(`[${PHASE}] passed`)
}

void main()
