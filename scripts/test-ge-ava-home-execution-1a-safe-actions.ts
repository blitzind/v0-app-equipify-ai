/**
 * GE-AVA-HOME-EXECUTION-1A — Ava Home safe execution certification.
 * Run: pnpm test:ge-ava-home-execution-1a-safe-actions
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_AVA_HOME_EXECUTION_1A_QA_MARKER,
  GROWTH_HOME_AVA_EXECUTE_ACTIONS,
  GROWTH_HOME_AVA_REFRESH_INTELLIGENCE_LABEL,
  GROWTH_HOME_AVA_RUN_INTAKE_LABEL,
  GROWTH_HOME_AVA_SAFE_EXECUTION_DISCLAIMER,
  GROWTH_HOME_AVA_START_RESEARCH_LABEL,
  growthHomeAvaExecuteHref,
} from "../lib/growth/ava-home/growth-home-ava-execute-api-contract"

const PHASE = "GE-AVA-HOME-EXECUTION-1A" as const

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

async function main(): Promise<void> {
  console.log(`[${PHASE}] Ava Home safe execution certification`)

  assert.equal(GROWTH_AVA_HOME_EXECUTION_1A_QA_MARKER, "ge-ava-home-execution-1a-v1")
  assert.deepEqual([...GROWTH_HOME_AVA_EXECUTE_ACTIONS], [
    "run_unified_intake",
    "start_research",
    "refresh_intelligence",
  ])
  assert.equal(GROWTH_HOME_AVA_RUN_INTAKE_LABEL, "Run intake workflow")
  assert.equal(GROWTH_HOME_AVA_START_RESEARCH_LABEL, "Start AI research")
  assert.equal(GROWTH_HOME_AVA_REFRESH_INTELLIGENCE_LABEL, "Refresh intelligence")
  assert.match(GROWTH_HOME_AVA_SAFE_EXECUTION_DISCLAIMER, /will not send outreach without approval/)

  assert.equal(
    growthHomeAvaExecuteHref("lead-1"),
    "/api/platform/growth/leads/lead-1/ava-execute",
  )

  const routePath = "app/api/platform/growth/leads/[leadId]/ava-execute/route.ts"
  const routeSource = readSource(routePath)
  assert.match(routeSource, /z\.enum\(GROWTH_HOME_AVA_EXECUTE_ACTIONS\)/)
  assert.match(routeSource, /executeGrowthHomeAvaSafeAction/)
  assert.match(routeSource, /Invalid action/)
  assert.doesNotMatch(
    routeSource,
    /sendEmail|sendSms|sendSMS|enrollSequence|sequenceEnrollment|launchCampaign|outboundExecution|autoApprove|createLeadCandidate|createGrowthLead|datamoon-audience-import/i,
  )

  const servicePath = "lib/growth/ava-home/growth-home-ava-execute-service.ts"
  const serviceSource = readSource(servicePath)
  assert.match(serviceSource, /runUnifiedRevenueWorkflowAfterIntake/)
  assert.match(serviceSource, /scheduleLeadResearchPilotForProspect/)
  assert.match(serviceSource, /resolveActiveLeadResearchState/)
  assert.match(serviceSource, /buildOpportunityIntelligenceViewModel/)
  assert.match(serviceSource, /publishAvaHomeExecuteAuditEvent/)
  assert.match(serviceSource, /publishAiOsEvent/)
  assert.match(serviceSource, /growth\.ava_home\.execute_requested/)
  assert.match(serviceSource, /growth\.ava_home\.execute_completed/)
  assert.match(serviceSource, /research_already_active|research_work_order_active|prospect_research_run_active/)
  assert.doesNotMatch(
    serviceSource,
    /sendEmail|sendSms|sendSMS|enrollSequence|sequenceEnrollment|launchCampaign|processOutbound|autoApprove|createLeadCandidate|createGrowthLead|runUnifiedRevenueWorkflow\(/i,
  )

  const registrySource = readSource("lib/growth/aios/ai-event-registry.ts")
  assert.match(registrySource, /growth\.ava_home\.execute_requested/)
  assert.match(registrySource, /growth\.ava_home\.execute_completed/)
  assert.match(registrySource, /growth\.ava_home\.execute_skipped/)
  assert.match(registrySource, /growth\.ava_home\.execute_failed/)

  const panelSource = readSource(
    "components/growth/workspace/executive-briefing/growth-home-ava-safe-execution-panel.tsx",
  )
  assert.match(panelSource, /GROWTH_HOME_AVA_RUN_INTAKE_LABEL/)
  assert.match(panelSource, /GROWTH_HOME_AVA_START_RESEARCH_LABEL/)
  assert.match(panelSource, /GROWTH_HOME_AVA_REFRESH_INTELLIGENCE_LABEL/)
  assert.match(panelSource, /GROWTH_HOME_AVA_SAFE_EXECUTION_DISCLAIMER/)
  assert.match(panelSource, /growthHomeAvaExecuteHref/)
  assert.match(panelSource, /run_unified_intake/)
  assert.match(panelSource, /start_research/)
  assert.match(panelSource, /refresh_intelligence/)
  assert.doesNotMatch(panelSource, /sendEmail|enroll|outbound|createLead/i)

  const sectionSource = readSource(
    "components/growth/workspace/executive-briefing/growth-home-ava-opportunity-intelligence-section.tsx",
  )
  assert.match(sectionSource, /GrowthHomeAvaSafeExecutionPanel/)

  console.log(`[${PHASE}] PASS — Ava Home safe execution certified (local)`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
