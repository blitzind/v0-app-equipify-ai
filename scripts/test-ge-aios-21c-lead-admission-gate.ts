/**
 * GE-AIOS-21C — ICP Lead Admission Gate certification.
 * Run: pnpm test:ge-aios-21c-lead-admission-gate
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { normalizeDatamoonAudienceRecord } from "../lib/growth/lead-sources/datamoon/datamoon-audience-import-normalizer"
import {
  resolveDatamoonCompanyName,
  resolveDatamoonCompanyWebsite,
} from "../lib/growth/lead-sources/datamoon/datamoon-audience-import-company-identity"
import {
  evaluateGrowthLeadAdmission,
  resolveCredibleBusinessDomain,
} from "../lib/growth/revenue-workflow/evaluate-growth-lead-admission"
import { GROWTH_LEAD_ADMISSION_21C_QA_MARKER } from "../lib/growth/revenue-workflow/growth-lead-admission-types"
import { normalizeLeadIntakeSource } from "../lib/growth/revenue-workflow/normalize-lead-intake-source"
import { shouldAutoQueueLeadResearch } from "../lib/growth/research/growth-lead-research-readiness"

const PHASE = "GE-AIOS-21C" as const

const SAMPLE_PROFILE = {
  company: {
    companyName: "Equipify",
    website: "https://equipify.example",
    shortDescription: "Field service software",
    productsServices: ["CMMS", "field service"],
    businessModel: "B2B SaaS",
    primaryValueProposition: "Equipment service operations",
  },
  idealCustomers: {
    targetIndustries: ["medical equipment service", "biomedical repair"],
    companySizeRanges: ["11-50", "51-200"],
    geography: ["United States"],
    buyerPersonas: ["Owner", "Operations Manager"],
    disqualifiers: ["retail", "roofing contractor"],
  },
  problemsAndTriggers: {
    painPoints: ["manual dispatch"],
    buyingTriggers: ["equipment downtime"],
    competitorsAlternatives: [],
    keywords: ["medical equipment service"],
    negativeKeywords: ["roofing", "seafood", "promotional marketing"],
  },
  salesAndMarketing: {
    averageDealSize: null,
    salesCycleEstimate: null,
    messagingAngles: [],
    qualificationCriteria: ["service business"],
  },
  confidence: {
    score: 85,
    assumptions: [],
    missingInformation: [],
  },
} as const

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function main(): void {
  console.log(`[${PHASE}] ICP Lead Admission Gate certification`)

  assert.equal(GROWTH_LEAD_ADMISSION_21C_QA_MARKER, "ge-aios-21c-lead-admission-gate-v1")
  console.log("  ✓ 21C QA marker")

  const normalizedYahoo = normalizeDatamoonAudienceRecord(
    {
      first_name: "Kim",
      last_name: "Pulham",
      personal_emails: "kpulham@yahoo.com",
      personal_phone: "555-0100",
      contact_country: "US",
    },
    { providerMode: "ext" },
  )
  assert.equal(normalizedYahoo.company_domain, null)
  assert.equal(normalizedYahoo.email, "kpulham@yahoo.com")
  assert.notEqual(resolveDatamoonCompanyName(normalizedYahoo), "yahoo.com")
  assert.equal(resolveDatamoonCompanyWebsite(normalizedYahoo), null)
  console.log("  ✓ Datamoon normalizer rejects consumer domain as company website")

  const intakeYahoo = normalizeLeadIntakeSource({
    source: "datamoon",
    company: { name: "yahoo.com", website: "https://yahoo.com", domain: "yahoo.com" },
    contact: { name: "Kim Pulham", email: "kpulham@yahoo.com" },
  })
  assert.equal(intakeYahoo.domain, null)
  assert.equal(intakeYahoo.website, null)
  assert.match(intakeYahoo.warnings.join(" "), /consumer_domain_not_used_as_company_website/)
  console.log("  ✓ unified intake strips consumer domain from website")

  const invalidAdmission = evaluateGrowthLeadAdmission(
    {
      companyName: "yahoo.com",
      website: "https://yahoo.com",
      domain: "yahoo.com",
      industry: null,
      email: "kpulham@yahoo.com",
      contactName: "Kim Pulham",
      identityUncertain: false,
      source: "datamoon",
      metadata: { business_email: null },
    },
    { approvedProfile: SAMPLE_PROFILE, activeMissionTitle: "Medical equipment demos" },
  )
  assert.equal(invalidAdmission.state, "invalid")
  assert.equal(invalidAdmission.allowLeadCreation, false)
  assert.equal(invalidAdmission.allowAutoResearch, false)
  assert.equal(invalidAdmission.sanitized.website, null)
  assert.equal(invalidAdmission.sanitized.domain, null)
  assert.notEqual(invalidAdmission.sanitized.companyName, "yahoo.com")
  console.log("  ✓ invalid identity blocked — contact email preserved in intake path")

  const rejectedAdmission = evaluateGrowthLeadAdmission(
    {
      companyName: "Mortensen Roofing",
      website: "https://hawkprecast.com",
      domain: "hawkprecast.com",
      industry: "roofing",
      email: "mortensenroofing@sbcglobal.net",
      contactName: "Mortensen Roofing",
      identityUncertain: false,
      source: "datamoon",
      metadata: { business_email: null },
    },
    { approvedProfile: SAMPLE_PROFILE, activeMissionTitle: "Medical equipment demos" },
  )
  assert.equal(rejectedAdmission.state, "rejected")
  assert.equal(rejectedAdmission.allowLeadCreation, true)
  assert.equal(rejectedAdmission.leadStatus, "disqualified")
  assert.equal(rejectedAdmission.allowAutoResearch, false)
  console.log("  ✓ clear ICP mismatch rejected without auto-research")

  const acceptedAdmission = evaluateGrowthLeadAdmission(
    {
      companyName: "Erickson Aviation Services",
      website: "https://ericksonaviation.com",
      domain: "ericksonaviation.com",
      industry: "medical equipment service",
      email: "ops@ericksonaviation.com",
      contactName: "Alex Erickson",
      identityUncertain: false,
      source: "datamoon",
      metadata: { business_email: "ops@ericksonaviation.com" },
    },
    { approvedProfile: SAMPLE_PROFILE, activeMissionTitle: "Medical equipment demos" },
    {
      operationalKeywordValidation: { pass: true, reason: null },
      prospectSearchIndustryGatePassed: true,
    },
  )
  assert.equal(acceptedAdmission.state, "accepted")
  assert.equal(acceptedAdmission.allowAutoResearch, true)
  console.log("  ✓ credible business identity accepted")

  assert.equal(
    resolveCredibleBusinessDomain({
      domain: "yahoo.com",
      contactEmail: "kpulham@yahoo.com",
      businessEmail: null,
    }),
    null,
  )
  assert.equal(
    resolveCredibleBusinessDomain({
      domain: null,
      businessEmail: "ops@ericksonaviation.com",
      contactEmail: "personal@gmail.com",
    }),
    "ericksonaviation.com",
  )
  console.log("  ✓ credible domain resolution prefers business email")

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
    shouldAutoQueueLeadResearch({
      website: "https://ericksonaviation.com",
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
      website: "https://comcast.net",
      status: "new",
      metadata: {},
      lastProspectResearchedAt: null,
      latestProspectResearchRunId: null,
      lastResearchedAt: null,
      latestResearchRunId: null,
    }),
    false,
  )
  console.log("  ✓ research readiness respects admission + legacy consumer domains")

  const leadResolver = readSource("lib/growth/revenue-workflow/unified-revenue-workflow-lead-resolver.ts")
  assert.match(leadResolver, /evaluateGrowthLeadAdmission/)
  assert.match(leadResolver, /loadGrowthLeadAdmissionContext/)
  console.log("  ✓ unified lead resolver wired to admission gate")

  const datamoonService = readSource("lib/growth/lead-sources/datamoon/datamoon-audience-import-service.ts")
  assert.match(datamoonService, /evaluateGrowthLeadAdmission/)
  assert.match(datamoonService, /Admission invalid/)
  console.log("  ✓ Datamoon import blocks invalid records at preview + commit")

  const executionService = readSource("lib/growth/research/growth-lead-research-execution-service.ts")
  assert.match(executionService, /admission_blocked/)
  console.log("  ✓ research execution backstops admission gate")

  console.log("\n  Edge-case scenarios (21C-4)")

  const scenarioAIntake = normalizeLeadIntakeSource({
    source: "manual",
    company: { name: "ACME Manufacturing" },
    contact: { name: "John Smith", email: "john@yahoo.com" },
  })
  assert.equal(scenarioAIntake.companyName, "acme manufacturing")
  assert.equal(scenarioAIntake.email, "john@yahoo.com")
  assert.equal(scenarioAIntake.website, null)
  assert.equal(scenarioAIntake.domain, null)

  const scenarioA = evaluateGrowthLeadAdmission(
    {
      companyName: scenarioAIntake.companyName,
      website: scenarioAIntake.website,
      domain: scenarioAIntake.domain,
      industry: null,
      email: scenarioAIntake.email,
      contactName: "John Smith",
      identityUncertain: false,
      source: "manual",
      metadata: {},
    },
    { approvedProfile: SAMPLE_PROFILE, activeMissionTitle: "Medical equipment demos" },
  )
  assert.equal(scenarioA.state, "review")
  assert.equal(scenarioA.sanitized.companyName, "acme manufacturing")
  assert.equal(scenarioA.sanitized.website, null)
  assert.equal(scenarioA.allowAutoResearch, false)
  assert.equal(
    shouldAutoQueueLeadResearch({
      website: null,
      status: "new",
      metadata: { admission_state: "review" },
      lastProspectResearchedAt: null,
      latestProspectResearchRunId: null,
      lastResearchedAt: null,
      latestResearchRunId: null,
    }),
    false,
  )
  console.log("  ✓ Scenario A — valid company + consumer contact email → review, no auto-research")

  const scenarioB = evaluateGrowthLeadAdmission(
    {
      companyName: "yahoo.com",
      website: "https://yahoo.com",
      domain: "yahoo.com",
      industry: null,
      email: "john@yahoo.com",
      contactName: "John Smith",
      identityUncertain: false,
      source: "manual",
      metadata: {},
    },
    { approvedProfile: SAMPLE_PROFILE, activeMissionTitle: "Medical equipment demos" },
  )
  assert.equal(scenarioB.state, "invalid")
  assert.equal(scenarioB.allowLeadCreation, false)
  assert.equal(scenarioB.sanitized.website, null)
  console.log("  ✓ Scenario B — consumer domain as company identity → invalid")

  const scenarioC = evaluateGrowthLeadAdmission(
    {
      companyName: "",
      website: null,
      domain: null,
      industry: null,
      email: "john@gmail.com",
      contactName: "John Smith",
      identityUncertain: false,
      source: "manual",
      metadata: {},
    },
    { approvedProfile: SAMPLE_PROFILE, activeMissionTitle: "Medical equipment demos" },
  )
  assert.equal(scenarioC.state, "invalid")
  assert.equal(scenarioC.allowLeadCreation, false)
  assert.equal(scenarioC.allowAutoResearch, false)
  console.log("  ✓ Scenario C — no company identity → invalid")

  const scenarioD = evaluateGrowthLeadAdmission(
    {
      companyName: "ACME Manufacturing",
      website: "https://acmemanufacturing.com",
      domain: "acmemanufacturing.com",
      industry: "medical equipment service",
      email: "john@gmail.com",
      contactName: "John Smith",
      identityUncertain: false,
      source: "manual",
      metadata: {},
    },
    { approvedProfile: SAMPLE_PROFILE, activeMissionTitle: "Medical equipment demos" },
  )
  assert.notEqual(scenarioD.state, "invalid")
  assert.notEqual(scenarioD.state, "rejected")
  assert.equal(scenarioD.sanitized.website, "https://acmemanufacturing.com")
  assert.equal(scenarioD.state, "accepted")
  console.log("  ✓ Scenario D — business domain + consumer contact email → profile-based acceptance")

  console.log(`[${PHASE}] PASS — ICP Lead Admission Gate certified (local)`)
}

main()
