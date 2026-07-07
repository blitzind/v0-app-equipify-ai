/**
 * GE-AIOS-BUSINESS-PROFILE-1C — Business Profile → lead discovery projection certification.
 * Run: pnpm test:ge-aios-business-profile-1c-lead-discovery-projection
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { parseAvaDatamoonSourcingCommand } from "../lib/growth/ava-home/datamoon/ava-datamoon-sourcing-command-parser"
import {
  GROWTH_HOME_DATAMOON_BUSINESS_PROFILE_MISSING_COPY,
  GROWTH_HOME_DATAMOON_CREATE_BUSINESS_PROFILE_LABEL,
  GROWTH_HOME_DATAMOON_USING_BUSINESS_PROFILE_LABEL,
} from "../lib/growth/ava-home/datamoon/growth-home-datamoon-sourcing-api-contract"
import {
  GROWTH_AIOS_BUSINESS_PROFILE_1C_QA_MARKER,
  projectApprovedBusinessProfileToLeadDiscovery,
} from "../lib/growth/business-profile/business-profile-lead-discovery-projection"
import type { BusinessProfileDraftContent } from "../lib/growth/business-profile/business-profile-types"

const PHASE = "GE-AIOS-BUSINESS-PROFILE-1C" as const

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function assertNoForbiddenProviderCalls(source: string, label: string): void {
  assert.doesNotMatch(
    source,
    /buildAudience|fetchAudience|startDatamoonAudienceImportRun|datamoon-client|importDatamoon|prospectSearch|createGrowthLead|sendEmail|enrollSequence|launchCampaign|outboundExecution/i,
    `${label} must not call downstream providers`,
  )
}

const sampleApprovedProfile: BusinessProfileDraftContent = {
  company: {
    companyName: "Acme HVAC",
    website: "https://acme-hvac.example",
    shortDescription: "Acme provides HVAC service software.",
    productsServices: ["HVAC dispatch software"],
    businessModel: "B2B SaaS",
    primaryValueProposition: "Help HVAC contractors run smarter service teams.",
  },
  idealCustomers: {
    targetIndustries: ["HVAC contractors", "Mechanical service"],
    companySizeRanges: ["11–50", "51–200"],
    geography: ["United States"],
    buyerPersonas: ["Owner", "Operations Manager", "Service Manager"],
    disqualifiers: ["Residential-only handymen"],
  },
  problemsAndTriggers: {
    painPoints: ["Manual dispatch", "Missed maintenance visits"],
    buyingTriggers: ["Seasonal hiring", "Fleet expansion"],
    competitorsAlternatives: ["Spreadsheets", "Legacy FSM"],
    keywords: ["hvac software", "hvac dispatch", "mechanical service"],
    negativeKeywords: ["consumer", "diy"],
  },
  salesAndMarketing: {
    averageDealSize: "$15k ACV",
    salesCycleEstimate: "45 days",
    messagingAngles: ["Fewer missed appointments"],
    qualificationCriteria: ["Commercial HVAC focus"],
  },
  confidence: {
    score: 0.84,
    assumptions: ["Approved profile"],
    missingInformation: [],
  },
  draftSource: "ai_assisted",
}

async function main(): Promise<void> {
  console.log(`[${PHASE}] Business Profile lead discovery projection certification`)

  assert.equal(GROWTH_AIOS_BUSINESS_PROFILE_1C_QA_MARKER, "ge-aios-business-profile-1c-v1")

  const projection = projectApprovedBusinessProfileToLeadDiscovery(sampleApprovedProfile, "Acme HVAC")
  assert.ok(projection.topics.length > 0)
  assert.ok(projection.topics.some((topic) => /hvac/i.test(topic)))
  assert.ok(projection.industries.includes("HVAC contractors"))
  assert.ok(projection.jobTitles.includes("operations manager"))
  assert.equal(projection.geography.country, "US")
  assert.equal(projection.companySize, "11-50")
  assert.ok(projection.keywords.length > 0)
  assert.ok(projection.negativeKeywords.includes("consumer"))
  assert.ok(projection.intentLevels.includes("high"))
  assert.equal(projection.lookbackDays, 7)
  assert.ok(projection.assumptions.length > 0)

  const withProfile = parseAvaDatamoonSourcingCommand("Find buyers in Texas", {
    profileProjection: projection,
  })
  assert.equal(withProfile.businessProfileUsed, true)
  assert.equal(withProfile.businessProfileStatus, "approved")
  assert.ok(withProfile.audienceDraft.topics.some((topic) => /hvac/i.test(topic)))
  assert.equal(withProfile.audienceDraft.geography.state, "TX")
  assert.ok(withProfile.explanation.includes("approved Business Profile"))

  const overrideDraft = parseAvaDatamoonSourcingCommand("Find roofing companies in Florida", {
    profileProjection: projection,
  })
  assert.ok(overrideDraft.audienceDraft.topics.some((topic) => /roofing/i.test(topic)))
  assert.equal(overrideDraft.audienceDraft.geography.state, "FL")
  assert.ok(overrideDraft.overrides.some((item) => /topic changed/i.test(item)))

  const missingProfile = parseAvaDatamoonSourcingCommand("Find buyers in Texas")
  assert.equal(missingProfile.businessProfileUsed, false)
  assert.equal(missingProfile.businessProfileStatus, "missing")
  assert.doesNotMatch(
    missingProfile.assumptions.join(" "),
    /Defaulted to equipment maintenance software/i,
  )
  assert.ok(missingProfile.explanation.includes("don't know your ideal customer yet"))

  const commandSpecific = parseAvaDatamoonSourcingCommand("Find equipment maintenance software buyers")
  assert.ok(commandSpecific.audienceDraft.topics.includes("equipment maintenance software"))

  const draftRoute = readSource("app/api/platform/growth/ava/datamoon-sourcing/draft/route.ts")
  assert.match(draftRoute, /getActiveApprovedBusinessProfile/)
  assert.match(draftRoute, /projectApprovedBusinessProfileToLeadDiscovery/)
  assert.match(draftRoute, /parseAvaDatamoonSourcingCommand/)
  assertNoForbiddenProviderCalls(draftRoute, "datamoon-sourcing-draft-route")

  const ui = readSource(
    "components/growth/workspace/executive-briefing/growth-home-datamoon-sourcing-workbench-section.tsx",
  )
  assert.match(ui, /GROWTH_HOME_DATAMOON_USING_BUSINESS_PROFILE_LABEL/)
  assert.match(ui, /GROWTH_HOME_DATAMOON_BUSINESS_PROFILE_MISSING_COPY/)
  assert.match(ui, /GROWTH_HOME_DATAMOON_CREATE_BUSINESS_PROFILE_LABEL/)
  assert.match(ui, /GROWTH_HOME_DATAMOON_CONTINUE_MANUALLY_LABEL/)
  assert.equal(GROWTH_HOME_DATAMOON_USING_BUSINESS_PROFILE_LABEL, "Using approved Growth Profile")
  assert.equal(GROWTH_HOME_DATAMOON_CREATE_BUSINESS_PROFILE_LABEL, "Create Business Profile")

  const serviceSource = readSource("lib/growth/business-profile/business-profile-lead-discovery-projection.ts")
  assert.match(serviceSource, /targetIndustries/)
  assert.match(serviceSource, /buyerPersonas/)
  assert.match(serviceSource, /negativeKeywords/)
  assertNoForbiddenProviderCalls(serviceSource, "lead-discovery-projection")

  console.log(`[${PHASE}] PASS — Business Profile lead discovery projection certified (local)`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
