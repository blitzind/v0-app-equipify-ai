/**
 * GE-AIOS-23 — Runtime Canonicalization certification.
 * Run: pnpm test:ge-aios-23-runtime-canonicalization
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_CANONICAL_RESEARCH_23_QA_MARKER,
  GROWTH_CANONICAL_RESEARCH_EXECUTION_CHAIN,
} from "../lib/growth/research/growth-canonical-research-types"
import { GROWTH_CANONICAL_MISSION_RUNTIME_QA_MARKER } from "../lib/growth/mission/growth-canonical-mission-runtime"
import { GROWTH_CANONICAL_SUPPRESSION_READ_QA_MARKER } from "../lib/growth/compliance/growth-canonical-suppression-types"
import { GROWTH_AI_OS_COMMAND_CENTER_CANONICAL_QA_MARKER } from "../lib/growth/aios/growth-ai-os-command-center-canonical"

const PHASE = "GE-AIOS-23" as const

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function assertRoutesThroughFacade(source: string, label: string): void {
  assert.match(source, /routeCanonicalProspectResearch|executeGrowthLeadProspectResearch/)
  assert.doesNotMatch(source, /from "@\/lib\/growth\/research\/research-orchestrator"/)
  console.log(`  ✓ ${label} routes through 21A facade`)
}

function main(): void {
  console.log(`[${PHASE}] Runtime Canonicalization certification`)

  assert.equal(GROWTH_CANONICAL_RESEARCH_23_QA_MARKER, "ge-aios-23-runtime-canonicalization-v1")
  assert.deepEqual([...GROWTH_CANONICAL_RESEARCH_EXECUTION_CHAIN], [
    "executeGrowthLeadProspectResearch",
    "runProspectResearch",
  ])
  console.log("  ✓ 23 QA marker + execution chain")

  const executionService = readSource("lib/growth/research/growth-lead-research-execution-service.ts")
  assert.match(executionService, /executeGrowthLeadProspectResearch/)
  assert.match(executionService, /runProspectResearch/)
  assert.match(executionService, /admission_blocked/)
  assert.match(executionService, /companyEvidence_v22/)
  console.log("  ✓ 21A facade remains canonical research owner")

  const canonicalRoute = readSource("lib/growth/research/growth-canonical-research-route.ts")
  assert.match(canonicalRoute, /executeGrowthLeadProspectResearch/)
  console.log("  ✓ canonical research route helper exists")

  assertRoutesThroughFacade(readSource("app/api/platform/growth/leads/[leadId]/research/run/route.ts"), "research/run")
  assertRoutesThroughFacade(readSource("app/api/platform/growth/leads/[leadId]/research/rebuild/route.ts"), "research/rebuild")

  const legacyPost = readSource("app/api/platform/growth/leads/[leadId]/research/route.ts")
  assert.match(legacyPost, /routeCanonicalProspectResearch/)
  assert.doesNotMatch(legacyPost, /runGrowthLeadResearch\(/)
  console.log("  ✓ legacy POST /research delegates to canonical route")

  const deprecatedRunner = readSource("lib/growth/run-lead-research.ts")
  assert.match(deprecatedRunner, /routeCanonicalProspectResearch/)
  assert.doesNotMatch(deprecatedRunner, /runAiTask/)
  console.log("  ✓ runGrowthLeadResearch deprecated wrapper delegates")

  const avaExecute = readSource("lib/growth/ava-home/growth-home-ava-execute-service.ts")
  assert.match(avaExecute, /scheduleGrowthLeadProspectResearchIfNeeded/)
  assert.doesNotMatch(avaExecute, /scheduleLeadResearchPilotForProspect/)
  console.log("  ✓ Ava home start_research uses canonical scheduler")

  const avaOrchestrator = readSource("lib/growth/ava-home/growth-ava-research-orchestrator-service.ts")
  assert.match(avaOrchestrator, /executeGrowthLeadProspectResearch/)
  console.log("  ✓ Ava research queue uses 21A facade")

  const pilotExecutor = readSource("lib/growth/aios/pilot/lead-research-agent-executor.ts")
  assert.match(pilotExecutor, /routeCanonicalProspectResearch/)
  assert.doesNotMatch(pilotExecutor, /invokeAiOsProviderWithContextPackage/)
  assert.doesNotMatch(pilotExecutor, /insertGrowthLeadResearchRun/)
  console.log("  ✓ AI OS pilot executor routes through canonical research")

  const salesAgent = readSource("lib/growth/specialists/execution/execute-sales-workflow-agent.ts")
  assert.match(salesAgent, /executeGrowthLeadProspectResearch/)
  console.log("  ✓ sales loop research agent uses 21A facade")

  const prospectRepo = readSource("lib/growth/research/research-repository.ts")
  assert.match(prospectRepo, /GE-AIOS-23 — Canonical prospect research runs/)
  const legacyRepo = readSource("lib/growth/research-repository.ts")
  assert.match(legacyRepo, /DEPRECATED for writes/)
  console.log("  ✓ repository ownership documented")

  assert.equal(GROWTH_CANONICAL_MISSION_RUNTIME_QA_MARKER, "ge-aios-23-canonical-mission-runtime-v1")
  const missionDoc = readSource("lib/growth/mission/growth-canonical-mission-runtime.ts")
  assert.match(missionDoc, /growth-objective-runtime-service/)
  console.log("  ✓ mission runtime ownership declared")

  assert.equal(GROWTH_CANONICAL_SUPPRESSION_READ_QA_MARKER, "ge-aios-23-canonical-suppression-read-v1")
  const preSend = readSource("lib/growth/compliance/pre-send-assertion.ts")
  assert.match(preSend, /evaluateCanonicalRecipientSuppression/)
  console.log("  ✓ pre-send uses canonical suppression read")

  assert.equal(GROWTH_AI_OS_COMMAND_CENTER_CANONICAL_QA_MARKER, "ge-aios-23-canonical-command-center-v1")
  const commandRoute = readSource("app/api/platform/growth/ai-os/command-center/route.ts")
  assert.match(commandRoute, /fetchAiOsCommandCenterReadModel/)
  assert.match(commandRoute, /GROWTH_AI_OS_COMMAND_CENTER_CANONICAL_QA_MARKER/)
  console.log("  ✓ AI OS command center is canonical operator surface")

  const personalization = readSource("lib/growth/outreach/personalization/context-packet-builder.ts")
  assert.match(personalization, /companyEvidence_v22/)
  console.log("  ✓ personalization consumes canonical company evidence")

  const architectureDoc = readSource("docs/GE-AIOS-23_RUNTIME_CANONICALIZATION.md")
  assert.match(architectureDoc, /Canonical ownership matrix/)
  assert.match(architectureDoc, /executeGrowthLeadProspectResearch/)
  console.log("  ✓ runtime ownership documentation present")

  console.log(`[${PHASE}] PASS — Runtime Canonicalization certified (local)`)
}

main()
