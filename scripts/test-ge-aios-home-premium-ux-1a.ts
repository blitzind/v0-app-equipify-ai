/**
 * GE-AIOS-HOME-PREMIUM-UX-1A — Executive briefing flow certification.
 * Run: pnpm test:ge-aios-home-premium-ux-1a
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { GROWTH_BUSINESS_PROFILE_SECTION_TITLE } from "../lib/growth/business-profile/business-profile-api-contract"
import { GROWTH_HOME_FIND_LEADS_SUBTITLE } from "../lib/growth/ava-home/datamoon/growth-home-datamoon-sourcing-api-contract"
import { GROWTH_MISSION_CENTER_ACTIVE_MISSIONS_TITLE } from "../lib/growth/mission-center"
import {
  GROWTH_AIOS_HOME_PREMIUM_UX_1A_QA_MARKER,
  GROWTH_HOME_AVA_ACCOMPLISHED_TITLE,
  GROWTH_HOME_NEEDS_YOUR_DECISION_SUBTITLE,
  GROWTH_HOME_OPERATIONAL_READINESS_TITLE,
  GROWTH_HOME_OPPORTUNITY_BRIEF_TITLE,
} from "../lib/growth/workspace/executive-briefing/growth-home-premium-ux-1a"
import { GROWTH_HOME_NEEDS_YOUR_ATTENTION } from "../lib/growth/workspace/executive-briefing/growth-home-experience-2b"

const PHASE = "GE-AIOS-HOME-PREMIUM-UX-1A" as const

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function indexOfComponent(source: string, needle: string, label: string): number {
  const idx = source.indexOf(needle)
  assert.ok(idx >= 0, `${label} must be present in executive briefing dashboard`)
  return idx
}

function indexOfMount(source: string, needle: string, label: string): number {
  const idx = source.indexOf(`<${needle}`)
  assert.ok(idx >= 0, `${label} must be mounted in executive briefing dashboard`)
  return idx
}

async function main(): Promise<void> {
  console.log(`[${PHASE}] Executive briefing flow certification`)

  assert.equal(GROWTH_AIOS_HOME_PREMIUM_UX_1A_QA_MARKER, "ge-aios-home-premium-ux-1a-v1")
  assert.equal(GROWTH_HOME_NEEDS_YOUR_ATTENTION, "Needs Your Decision")
  assert.equal(GROWTH_HOME_NEEDS_YOUR_DECISION_SUBTITLE, "Ava is waiting on these before work can continue.")
  assert.equal(GROWTH_MISSION_CENTER_ACTIVE_MISSIONS_TITLE, "Ava's Active Missions")
  assert.equal(GROWTH_BUSINESS_PROFILE_SECTION_TITLE, "Growth Profile")
  assert.match(GROWTH_HOME_FIND_LEADS_SUBTITLE, /Growth Profile/)
  assert.doesNotMatch(GROWTH_HOME_FIND_LEADS_SUBTITLE, /Business Profile/)
  assert.equal(GROWTH_HOME_OPPORTUNITY_BRIEF_TITLE, "Opportunity Brief")
  assert.equal(GROWTH_HOME_AVA_ACCOMPLISHED_TITLE, "What Ava Accomplished")
  assert.equal(GROWTH_HOME_OPERATIONAL_READINESS_TITLE, "Operational Readiness")

  const dashboard = readSource(
    "components/growth/workspace/executive-briefing/growth-home-executive-briefing-dashboard.tsx",
  )
  assert.match(dashboard, /GROWTH_AIOS_HOME_PREMIUM_UX_1A_QA_MARKER/)
  assert.match(dashboard, /data-qa-section="home-operational-readiness"/)

  const hero = indexOfMount(dashboard, "GrowthHomeExecutiveBriefingHeroSection", "Hero")
  const needs = indexOfMount(dashboard, "GrowthHomeAiOsWaitingOnYouSection", "Needs Your Decision")
  const mission = indexOfMount(dashboard, "GrowthHomeMissionCenterSection", "Mission Center")
  const profile = indexOfMount(dashboard, "GrowthHomeBusinessProfileSection", "Growth Profile")
  const findLeads = indexOfMount(dashboard, "GrowthHomeDatamoonSourcingWorkbenchSection", "Find Leads")
  const opportunity = indexOfMount(dashboard, "GrowthHomeAvaOpportunityIntelligenceSection", "Opportunity Brief")
  const initiatives = indexOfMount(dashboard, "GrowthHomeMarketingMissionsSection", "Growth Initiatives")
  const customer = indexOfComponent(dashboard, 'data-qa-section="home-customer-growth"', "Customer Growth")
  const timeline = indexOfMount(dashboard, "GrowthHomeTimelineSection", "What Ava Accomplished")
  const operational = indexOfComponent(dashboard, 'data-qa-section="home-operational-readiness"', "Operational Readiness")

  assert.ok(needs > hero, "Needs Your Decision must follow hero")
  assert.ok(mission > needs, "Mission Center must follow Needs Your Decision")
  assert.ok(profile > mission, "Growth Profile must follow Mission Center")
  assert.ok(findLeads > profile, "Find Leads must follow Growth Profile")
  assert.ok(opportunity > findLeads, "Opportunity Brief must follow Find Leads")
  assert.ok(initiatives > opportunity, "Growth Initiatives must follow Opportunity Brief")
  assert.ok(customer > initiatives, "Customer Growth must follow Growth Initiatives")
  assert.ok(timeline > customer, "What Ava Accomplished must follow Customer Growth")
  assert.ok(operational > timeline, "Operational Readiness must follow What Ava Accomplished")

  const opportunitySection = readSource(
    "components/growth/workspace/executive-briefing/growth-home-ava-opportunity-intelligence-section.tsx",
  )
  assert.match(opportunitySection, /GROWTH_HOME_OPPORTUNITY_BRIEF_TITLE/)
  assert.doesNotMatch(opportunitySection, /<h2[^>]*>Opportunity intelligence<\/h2>/)

  const findLeadsSection = readSource(
    "components/growth/workspace/executive-briefing/growth-home-datamoon-sourcing-workbench-section.tsx",
  )
  assert.match(findLeadsSection, /GROWTH_HOME_FIND_LEADS_SUBTITLE/)
  assert.doesNotMatch(findLeadsSection, /<h2[^>]*>Datamoon/i)

  const corePaths = [
    "app/(core)",
    "components/core",
    "lib/core",
  ]
  for (const corePath of corePaths) {
    assert.ok(!fs.existsSync(path.join(process.cwd(), corePath)), `Equipify Core path must not exist: ${corePath}`)
  }

  console.log(`[${PHASE}] PASS — Executive briefing flow certified (local)`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
