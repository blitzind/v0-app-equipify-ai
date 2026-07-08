/**
 * GE-AIOS-7C — Ava-led lead discovery UX + customer-specific ICP defaults certification.
 * Run: pnpm test:ge-aios-7c-ava-led-lead-discovery
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  assessLeadDiscoveryProfileReadiness,
  buildAvaLedLeadDiscoveryContext,
  draftUsesEquipifyInternalDefaults,
  EQUIPIFY_INTERNAL_TOPIC_PRESETS,
  GROWTH_AIOS_FIND_LEADS_7C_QA_MARKER,
} from "../lib/growth/ava-home/datamoon/ava-datamoon-lead-discovery-defaults"
import {
  createDefaultAvaDatamoonAudienceDraft,
  createMinimalAvaDatamoonAudienceDraft,
} from "../lib/growth/ava-home/datamoon/ava-datamoon-sourcing-workbench-types"
import {
  GROWTH_AIOS_FIND_LEADS_UX_2A_QA_MARKER,
  GROWTH_HOME_AVA_LED_SEARCH_EXPLAIN_TITLE,
  GROWTH_HOME_AVA_LED_SEARCH_TITLE,
  GROWTH_HOME_DATAMOON_BUSINESS_PROFILE_MISSING_COPY,
  GROWTH_HOME_DATAMOON_CREATE_BUSINESS_PROFILE_LABEL,
  GROWTH_HOME_DATAMOON_PROFILE_INCOMPLETE_COPY,
  GROWTH_HOME_REFINE_SEARCH_LABEL,
  GROWTH_HOME_START_LEAD_SEARCH_LABEL,
} from "../lib/growth/ava-home/datamoon/growth-home-datamoon-sourcing-api-contract"
import type { BusinessProfileDraftContent } from "../lib/growth/business-profile/business-profile-types"

const PHASE = "GE-AIOS-7C" as const

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

const genericCustomerProfile: BusinessProfileDraftContent = {
  company: {
    companyName: "Northstar Logistics",
    website: "https://northstar-logistics.example",
    shortDescription: "Fleet optimization software for regional carriers.",
    productsServices: ["Route planning SaaS"],
    businessModel: "B2B SaaS",
    primaryValueProposition: "Reduce empty miles for regional fleets.",
  },
  idealCustomers: {
    targetIndustries: ["Regional trucking", "Freight brokers"],
    companySizeRanges: ["51–200"],
    geography: ["United States"],
    buyerPersonas: ["VP Operations", "Fleet Director"],
    disqualifiers: ["Owner-operator only"],
  },
  problemsAndTriggers: {
    painPoints: ["Manual dispatch"],
    buyingTriggers: ["Fleet expansion"],
    competitorsAlternatives: ["Spreadsheets"],
    keywords: ["fleet optimization", "route planning"],
    negativeKeywords: ["consumer"],
  },
  salesAndMarketing: {
    averageDealSize: "$25k ACV",
    salesCycleEstimate: "60 days",
    messagingAngles: ["Fewer empty miles"],
    qualificationCriteria: ["Regional carrier focus"],
  },
  confidence: {
    score: 0.9,
    assumptions: [],
    missingInformation: [],
  },
}

async function main(): Promise<void> {
  console.log(`[${PHASE}] Ava-led lead discovery certification`)

  assert.equal(GROWTH_AIOS_FIND_LEADS_7C_QA_MARKER, "ge-aios-find-leads-7c-v1")
  assert.equal(GROWTH_HOME_START_LEAD_SEARCH_LABEL, "Start Lead Search")
  assert.equal(GROWTH_HOME_AVA_LED_SEARCH_EXPLAIN_TITLE, "Why I'm searching this way")
  assert.equal(
    GROWTH_HOME_DATAMOON_BUSINESS_PROFILE_MISSING_COPY,
    "Ava needs a Growth Profile before she can search accurately.",
  )
  assert.equal(GROWTH_HOME_DATAMOON_CREATE_BUSINESS_PROFILE_LABEL, "Update Growth Profile")

  // Default draft must not ship Equipify-internal topics to customer orgs.
  const bareDefault = createDefaultAvaDatamoonAudienceDraft()
  assert.equal(bareDefault.topics.length, 0)
  assert.equal(draftUsesEquipifyInternalDefaults(bareDefault), false)
  for (const topic of EQUIPIFY_INTERNAL_TOPIC_PRESETS) {
    assert.equal(bareDefault.topics.includes(topic), false, `bare default must not include ${topic}`)
  }

  const minimalDefault = createMinimalAvaDatamoonAudienceDraft()
  assert.equal(draftUsesEquipifyInternalDefaults(minimalDefault), false)

  // Profile readiness blocks low-quality searches.
  const missingReadiness = assessLeadDiscoveryProfileReadiness(null)
  assert.equal(missingReadiness.ready, false)
  assert.ok(missingReadiness.missingFields.includes("Approved Growth Profile"))

  const incompleteReadiness = assessLeadDiscoveryProfileReadiness({
    ...genericCustomerProfile,
    idealCustomers: { ...genericCustomerProfile.idealCustomers, targetIndustries: [], buyerPersonas: [] },
  })
  assert.equal(incompleteReadiness.ready, false)
  assert.ok(incompleteReadiness.missingFields.includes("Target industries"))
  assert.ok(incompleteReadiness.missingFields.includes("Buyer personas"))

  // Customer profile drives defaults, narrative, and explainability.
  const context = buildAvaLedLeadDiscoveryContext({
    profile: genericCustomerProfile,
    companyName: "Northstar Logistics",
    missionTitle: "Expand Midwest carrier pipeline",
  })
  assert.equal(context.profileReady, true)
  assert.equal(context.businessProfileUsed, true)
  assert.equal(draftUsesEquipifyInternalDefaults(context.draft), false)
  assert.ok(context.draft.topics.some((topic) => /regional trucking|freight brokers|fleet optimization/i.test(topic)))
  assert.ok(context.draft.jobTitles.some((title) => /vp operations|fleet director/i.test(title)))
  assert.match(context.narrative, /Growth Profile/)
  assert.match(context.narrative, /Expand Midwest carrier pipeline/)
  assert.ok(context.explainability.some((line) => line.source === "approved_business_profile"))
  assert.ok(context.explainability.some((line) => line.source === "mission"))
  assert.ok(context.topicPresets.some((topic) => /regional trucking/i.test(topic)))
  assert.ok(context.jobTitlePresets.some((title) => /vp operations/i.test(title)))

  const workbench = readSource(
    "components/growth/workspace/executive-briefing/growth-home-datamoon-sourcing-workbench-section.tsx",
  )
  assert.match(workbench, /GROWTH_AIOS_FIND_LEADS_7C_QA_MARKER/)
  assert.match(workbench, /GROWTH_AIOS_FIND_LEADS_UX_2A_QA_MARKER/)
  assert.match(workbench, /GROWTH_HOME_START_LEAD_SEARCH_LABEL/)
  assert.match(workbench, /GROWTH_HOME_AVA_LED_SEARCH_EXPLAIN_TITLE/)
  assert.match(workbench, /GROWTH_HOME_REFINE_SEARCH_LABEL/)
  assert.match(workbench, /handleStartAvaLedSearch/)
  assert.match(workbench, /buildAvaLedLeadDiscoveryContext/)
  assert.match(workbench, /topicPresets=\{avaLedContext/)
  assert.match(workbench, /mode === "ava_draft"/)
  assert.match(workbench, /manual_search/)
  assert.match(workbench, /GROWTH_HOME_DATAMOON_PROFILE_INCOMPLETE_COPY/)
  assert.doesNotMatch(workbench, /sendEmail|enrollSequence|launchCampaign|createLeadCandidate|autoImport/i)

  const form = readSource("components/growth/lead-sources/datamoon/datamoon-sourcing-workbench-form.tsx")
  assert.match(form, /topicPresets/)
  assert.match(form, /jobTitlePresets/)
  assert.doesNotMatch(form, /AVA_DATAMOON_TOPIC_PRESETS/)
  assert.doesNotMatch(form, /AVA_DATAMOON_JOB_TITLE_PRESETS/)

  const defaultsLib = readSource("lib/growth/ava-home/datamoon/ava-datamoon-lead-discovery-defaults.ts")
  assert.match(defaultsLib, /EQUIPIFY_INTERNAL_TOPIC_PRESETS/)
  assert.match(defaultsLib, /assessLeadDiscoveryProfileReadiness/)
  assert.match(defaultsLib, /buildAvaLedLeadDiscoveryContext/)

  const typesSource = readSource("lib/growth/ava-home/datamoon/ava-datamoon-sourcing-workbench-types.ts")
  assert.match(typesSource, /createMinimalAvaDatamoonAudienceDraft/)
  assert.match(typesSource, /GE-AIOS-7C/)

  const dashboard = readSource(
    "components/growth/workspace/executive-briefing/growth-home-executive-briefing-dashboard.tsx",
  )
  assert.match(dashboard, /workspace-summary/)
  assert.doesNotMatch(dashboard, /sendEmail|enrollSequence|outboundExecution/i)

  assert.equal(
    GROWTH_HOME_DATAMOON_PROFILE_INCOMPLETE_COPY,
    "Ava needs a few more Growth Profile details before she can run an accurate search.",
  )
  assert.equal(GROWTH_HOME_AVA_LED_SEARCH_TITLE, "Here's how I'll search")
  assert.equal(GROWTH_HOME_REFINE_SEARCH_LABEL, "Refine with a command")
  assert.equal(GROWTH_AIOS_FIND_LEADS_UX_2A_QA_MARKER, "ge-aios-find-leads-ux-2a-v1")

  console.log(`[${PHASE}] PASS — Ava-led lead discovery certified (local)`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
