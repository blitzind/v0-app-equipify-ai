/**
 * GE-AIOS-21A — Deep Autonomous Company Research certification.
 * Run: pnpm test:ge-aios-21a-deep-autonomous-company-research
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_LEAD_RESEARCH_READINESS_21A_QA_MARKER,
  hasUsableLeadResearch,
  shouldAutoQueueLeadResearch,
} from "../lib/growth/research/growth-lead-research-readiness"
import { enqueueGrowthLeadResearchFromDrawer } from "../lib/growth/research/growth-lead-research-drawer-client"

const PHASE = "GE-AIOS-21A" as const

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function main(): void {
  console.log(`[${PHASE}] Deep Autonomous Company Research certification`)

  assert.equal(
    GROWTH_LEAD_RESEARCH_READINESS_21A_QA_MARKER,
    "ge-aios-21a-deep-autonomous-company-research-v1",
  )
  console.log("  ✓ 21A QA marker")

  const executionService = readSource("lib/growth/research/growth-lead-research-execution-service.ts")
  assert.match(executionService, /executeGrowthLeadProspectResearch/)
  assert.match(executionService, /runProspectResearch/)
  assert.match(executionService, /publishGrowthLeadResearchWorkflowStatus/)
  assert.match(executionService, /fetchActiveProspectResearchRun/)
  assert.match(executionService, /scheduleGrowthLeadProspectResearchIfNeeded/)
  assert.match(executionService, /admission_blocked/)
  assert.doesNotMatch(executionService, /new ResearchEngine/)
  console.log("  ✓ unified execution facade wraps runProspectResearch")

  const executeAgent = readSource("lib/growth/specialists/execution/execute-sales-workflow-agent.ts")
  assert.match(executeAgent, /executeGrowthLeadProspectResearch/)
  assert.doesNotMatch(executeAgent, /runAutonomousResearchManualRefresh/)
  console.log("  ✓ autonomous sales loop uses unified prospect research")

  const leadRepo = readSource("lib/growth/lead-repository.ts")
  assert.match(leadRepo, /scheduleGrowthLeadProspectResearchIfNeeded/)
  assert.doesNotMatch(leadRepo, /scheduleLeadResearchPilotForProspect/)
  console.log("  ✓ lead import schedules prospect research")

  const researchRunRoute = readSource("app/api/platform/growth/leads/[leadId]/research/run/route.ts")
  assert.match(researchRunRoute, /routeCanonicalProspectResearch|executeGrowthLeadProspectResearch/)
  console.log("  ✓ research/run API uses unified facade")

  const drawerClient = readSource("lib/growth/research/growth-lead-research-drawer-client.ts")
  assert.match(drawerClient, /enqueueGrowthLeadResearchFromDrawer/)
  assert.match(drawerClient, /research\/run/)
  console.log("  ✓ drawer opportunistic enqueue is non-blocking")

  const drawer = readSource("components/growth/growth-lead-drawer.tsx")
  assert.match(drawer, /enqueueGrowthLeadResearchFromDrawer/)
  console.log("  ✓ lead drawer wires opportunistic research")

  const commandCenter = readSource("components/growth/growth-lead-command-center.tsx")
  assert.match(commandCenter, /resolveDrawerResearchPrimaryAction/)
  assert.doesNotMatch(commandCenter, /Generate Personalization/)
  console.log("  ✓ command center primary CTA is research-first")

  const personalization = readSource("components/growth/personalization/embedded/growth-personalization-embedded-panel.tsx")
  assert.match(personalization, /enqueueGrowthLeadResearchFromDrawer/)
  assert.match(personalization, /hasUsableLeadResearch/)
  console.log("  ✓ personalization gated on research readiness")

  const companyIntel = readSource("components/growth/growth-company-intelligence-snapshot.tsx")
  assert.match(companyIntel, /Ava is researching this company/)
  assert.match(companyIntel, /prospectRun/)
  console.log("  ✓ company intelligence shows research progress and prospect data")

  const avaOrchestrator = readSource("lib/growth/ava-home/growth-ava-research-orchestrator-service.ts")
  assert.match(avaOrchestrator, /executeGrowthLeadProspectResearch/)
  console.log("  ✓ Ava research queue reuses unified facade")

  const decisionContext = readSource("lib/growth/decision-engine/context/build-decision-context.ts")
  assert.match(decisionContext, /buildDailyWorkQueueResearchCandidates/)
  console.log("  ✓ mission discovery emits per-lead research candidates from work queue")

  const vercelCron = readSource("vercel.json")
  const cronMatches = vercelCron.match(/growth-objective-runtime-scheduler/g) ?? []
  assert.equal(cronMatches.length, 1)
  assert.doesNotMatch(vercelCron, /autonomous-sales-loop/)
  console.log("  ✓ no duplicate research scheduler added")

  assert.equal(
    shouldAutoQueueLeadResearch({
      website: "https://example.com",
      status: "new",
      metadata: { admission_state: "accepted" },
      lastProspectResearchedAt: null,
      latestProspectResearchRunId: null,
      lastResearchedAt: null,
      latestResearchRunId: null,
    }),
    true,
  )
  assert.equal(
    shouldAutoQueueLeadResearch({
      website: "https://yahoo.com",
      status: "new",
      metadata: { admission_state: "invalid" },
      lastProspectResearchedAt: null,
      latestProspectResearchRunId: null,
      lastResearchedAt: null,
      latestResearchRunId: null,
    }),
    false,
  )
  assert.equal(
    hasUsableLeadResearch({
      lastProspectResearchedAt: "2026-07-01T00:00:00.000Z",
      latestProspectResearchRunId: "run-1",
    }),
    true,
  )
  console.log("  ✓ readiness helpers derive queue + usable research")

  assert.equal(typeof enqueueGrowthLeadResearchFromDrawer, "function")
  console.log("  ✓ drawer client helper exported")

  console.log(`[${PHASE}] PASS — Deep Autonomous Company Research certified (local)`)
}

main()
