/**
 * GE-AVA-HOME-OPPORTUNITY-INTELLIGENCE-1A — Ava Home opportunity intelligence trigger certification.
 * Run: pnpm test:ge-ava-home-opportunity-intelligence-1a-foundation
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_AVA_HOME_OPPORTUNITY_INTELLIGENCE_1A_QA_MARKER,
  GROWTH_HOME_AVA_ANALYZE_LEAD_LABEL,
  GROWTH_HOME_AVA_REVIEW_DATAMOON_LABEL,
  GROWTH_HOME_AVA_SHOW_INTELLIGENCE_LABEL,
  growthHomeOpportunityIntelligenceHref,
} from "../lib/growth/opportunity-intelligence/growth-home-opportunity-intelligence-api-contract"

const PHASE = "GE-AVA-HOME-OPPORTUNITY-INTELLIGENCE-1A" as const

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

async function main(): Promise<void> {
  console.log(`[${PHASE}] Ava Home opportunity intelligence certification`)

  assert.equal(GROWTH_AVA_HOME_OPPORTUNITY_INTELLIGENCE_1A_QA_MARKER, "ge-ava-home-opportunity-intelligence-1a-v1")
  assert.equal(GROWTH_HOME_AVA_ANALYZE_LEAD_LABEL, "Analyze this lead")
  assert.equal(GROWTH_HOME_AVA_REVIEW_DATAMOON_LABEL, "Review Datamoon imports")
  assert.equal(GROWTH_HOME_AVA_SHOW_INTELLIGENCE_LABEL, "Show opportunity intelligence")

  assert.equal(
    growthHomeOpportunityIntelligenceHref("lead-1"),
    "/api/platform/growth/leads/lead-1/opportunity-intelligence",
  )
  const routePath = "app/api/platform/growth/leads/[leadId]/opportunity-intelligence/route.ts"
  const routeSource = readSource(routePath)
  assert.match(routeSource, /buildOpportunityIntelligenceViewModel/)
  assert.match(routeSource, /fetchLatestGrowthLeadResearchWorkflowSnapshot/)
  assert.match(routeSource, /readOnly:\s*true/)
  assert.doesNotMatch(routeSource, /recomputeGrowthLead|buildProspectQualification|assessGrowthLeadResearchOpportunity/)
  assert.doesNotMatch(routeSource, /enroll|sendEmail|outbound|createGrowthLead|createLeadCandidate/i)

  const recentImportsRoute = readSource("app/api/platform/growth/lead-sources/datamoon/recent-imports/route.ts")
  assert.match(recentImportsRoute, /listRecentDatamoonImportedLeads/)
  assert.match(recentImportsRoute, /readOnly:\s*true/)
  assert.doesNotMatch(recentImportsRoute, /createLeadCandidate|runUnifiedRevenueWorkflowAfterIntake|datamoon-audience-import-service/)

  const sectionSource = readSource(
    "components/growth/workspace/executive-briefing/growth-home-ava-opportunity-intelligence-section.tsx",
  )
  assert.match(sectionSource, /GROWTH_HOME_AVA_ANALYZE_LEAD_LABEL/)
  assert.match(sectionSource, /GROWTH_HOME_AVA_REVIEW_DATAMOON_LABEL/)
  assert.match(sectionSource, /GROWTH_HOME_AVA_SHOW_INTELLIGENCE_LABEL/)
  assert.match(sectionSource, /growthHomeOpportunityIntelligenceHref/)
  assert.match(sectionSource, /GROWTH_HOME_DATAMOON_RECENT_IMPORTS_API_PATH/)
  assert.doesNotMatch(sectionSource, /enroll|sendEmail|createLead|recompute/i)

  const panelSource = readSource(
    "components/growth/workspace/executive-briefing/growth-home-opportunity-intelligence-panel.tsx",
  )
  assert.match(panelSource, /Qualification/)
  assert.match(panelSource, /Revenue readiness/)
  assert.match(panelSource, /Next best action/)
  assert.match(panelSource, /Opportunity assessment/)
  assert.match(panelSource, /Research status/)
  assert.match(panelSource, /Not yet available/)

  const dashboardSource = readSource(
    "components/growth/workspace/executive-briefing/growth-home-executive-briefing-dashboard.tsx",
  )
  assert.match(dashboardSource, /GrowthHomeAvaOpportunityIntelligenceSection/)

  console.log(`[${PHASE}] PASS — Ava Home opportunity intelligence certified (local)`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
