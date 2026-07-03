/**
 * GE-AIOS-BUSINESS-PROFILE-1A — Business Profile foundation certification.
 * Run: pnpm test:ge-aios-business-profile-1a
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { draftBusinessProfileFromCompanyInput } from "../lib/growth/business-profile/business-profile-draft-generator"
import {
  BUSINESS_PROFILE_APPROVED_LABEL,
  BUSINESS_PROFILE_DRAFT_LABEL,
  GROWTH_AIOS_BUSINESS_PROFILE_1A_QA_MARKER,
  GROWTH_AIOS_BUSINESS_PROFILE_SCHEMA_MIGRATION,
  isBusinessProfileActive,
  type BusinessProfileRecord,
} from "../lib/growth/business-profile/business-profile-types"
import {
  GROWTH_BUSINESS_PROFILE_API_PATH,
  GROWTH_BUSINESS_PROFILE_DRAFT_LABEL,
  GROWTH_BUSINESS_PROFILE_SECTION_TITLE,
} from "../lib/growth/business-profile/business-profile-api-contract"

const PHASE = "GE-AIOS-BUSINESS-PROFILE-1A" as const

const ALLOWED_PATH_PREFIXES = [
  "lib/growth/business-profile/",
  "app/api/platform/growth/business-profile/",
  "components/growth/workspace/executive-briefing/growth-home-business-profile-section.tsx",
  "components/growth/workspace/executive-briefing/growth-home-executive-briefing-dashboard.tsx",
  "supabase/migrations/20271001270000_growth_organization_business_profile_ge_aios_business_profile_1a.sql",
  "scripts/test-ge-aios-business-profile-1a.ts",
  "package.json",
]

const FORBIDDEN_CORE_PATH_FRAGMENTS = [
  "lib/work-orders/",
  "lib/invoices/",
  "lib/quotes/",
  "lib/dispatch/",
  "lib/payments/",
  "components/core/",
]

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

function mockRecord(status: BusinessProfileRecord["status"]): BusinessProfileRecord {
  return {
    id: "profile-1",
    organizationId: "org-1",
    status,
    isActive: status === "approved",
    companyName: "Acme Service Co.",
    website: "https://acme.example",
    input: {
      companyName: "Acme Service Co.",
      website: "https://acme.example",
    },
    profile: {
      company: {
        companyName: "Acme Service Co.",
        website: "https://acme.example",
        shortDescription: "Test",
        productsServices: ["Services"],
        businessModel: "B2B",
        primaryValueProposition: "Value",
      },
      idealCustomers: {
        targetIndustries: ["Services"],
        companySizeRanges: ["11–50"],
        geography: ["United States"],
        buyerPersonas: ["Owner"],
        disqualifiers: ["Bad fit"],
      },
      problemsAndTriggers: {
        painPoints: ["Manual work"],
        buyingTriggers: ["Growth"],
        competitorsAlternatives: ["Spreadsheets"],
        keywords: ["acme"],
        negativeKeywords: ["consumer"],
      },
      salesAndMarketing: {
        averageDealSize: null,
        salesCycleEstimate: "30–90 days",
        messagingAngles: ["Efficiency"],
        qualificationCriteria: ["Industry fit"],
      },
      confidence: {
        score: 0.7,
        assumptions: ["Drafted from inputs"],
        missingInformation: ["Deal size"],
      },
    },
    label: status === "approved" ? BUSINESS_PROFILE_APPROVED_LABEL : BUSINESS_PROFILE_DRAFT_LABEL,
    createdBy: null,
    approvedBy: status === "approved" ? "user-1" : null,
    approvedAt: status === "approved" ? new Date().toISOString() : null,
    rejectedAt: status === "rejected" ? new Date().toISOString() : null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

async function main(): Promise<void> {
  console.log(`[${PHASE}] Business Profile foundation certification`)

  assert.equal(GROWTH_AIOS_BUSINESS_PROFILE_1A_QA_MARKER, "ge-aios-business-profile-1a-v1")
  assert.equal(
    GROWTH_AIOS_BUSINESS_PROFILE_SCHEMA_MIGRATION,
    "20271001270000_growth_organization_business_profile_ge_aios_business_profile_1a.sql",
  )
  assert.equal(GROWTH_BUSINESS_PROFILE_API_PATH, "/api/platform/growth/business-profile")
  assert.equal(GROWTH_BUSINESS_PROFILE_SECTION_TITLE, "Teach Ava About Your Business")
  assert.equal(GROWTH_BUSINESS_PROFILE_DRAFT_LABEL, "Ask Ava to Draft My Business Profile")

  const draft = await draftBusinessProfileFromCompanyInput({
    companyName: "Acme Service Co.",
    website: "acme.example",
  })

  assert.equal(draft.status, "draft")
  assert.equal(draft.isActive, false)
  assert.equal(draft.label, BUSINESS_PROFILE_DRAFT_LABEL)
  assert.equal(draft.input.companyName, "Acme Service Co.")
  assert.match(draft.input.website, /^https:\/\//)

  assert.ok(draft.profile.company.shortDescription.length > 0)
  assert.ok(draft.profile.company.productsServices.length > 0)
  assert.ok(draft.profile.company.businessModel.length > 0)
  assert.ok(draft.profile.company.primaryValueProposition.length > 0)
  assert.ok(draft.profile.idealCustomers.targetIndustries.length > 0)
  assert.ok(draft.profile.idealCustomers.companySizeRanges.length > 0)
  assert.ok(draft.profile.idealCustomers.geography.length > 0)
  assert.ok(draft.profile.idealCustomers.buyerPersonas.length > 0)
  assert.ok(draft.profile.idealCustomers.disqualifiers.length > 0)
  assert.ok(draft.profile.problemsAndTriggers.painPoints.length > 0)
  assert.ok(draft.profile.problemsAndTriggers.buyingTriggers.length > 0)
  assert.ok(draft.profile.problemsAndTriggers.competitorsAlternatives.length > 0)
  assert.ok(draft.profile.problemsAndTriggers.keywords.length > 0)
  assert.ok(draft.profile.problemsAndTriggers.negativeKeywords.length > 0)
  assert.ok(draft.profile.salesAndMarketing.messagingAngles.length > 0)
  assert.ok(draft.profile.salesAndMarketing.qualificationCriteria.length > 0)
  assert.ok(typeof draft.profile.confidence.score === "number")
  assert.ok(Array.isArray(draft.profile.confidence.assumptions))
  assert.ok(Array.isArray(draft.profile.confidence.missingInformation))

  const draftRecord = mockRecord("draft")
  const approvedRecord = mockRecord("approved")
  const rejectedRecord = mockRecord("rejected")

  assert.equal(isBusinessProfileActive(draftRecord), false)
  assert.equal(draftRecord.isActive, false)
  assert.equal(isBusinessProfileActive(approvedRecord), true)
  assert.equal(approvedRecord.isActive, true)
  assert.equal(isBusinessProfileActive(rejectedRecord), false)
  assert.equal(rejectedRecord.isActive, false)

  const migration = readSource(
    `supabase/migrations/${GROWTH_AIOS_BUSINESS_PROFILE_SCHEMA_MIGRATION}`,
  )
  assert.match(migration, /growth\.organization_business_profiles/)
  assert.match(migration, /status text not null default 'draft'/)
  assert.match(migration, /profile_json jsonb/)
  assert.match(migration, /draft_input_json jsonb/)
  assert.match(migration, /service_role/)

  const repository = readSource("lib/growth/business-profile/business-profile-repository.ts")
  assert.match(repository, /status: "draft"/)
  assert.match(repository, /status: "approved"/)
  assert.match(repository, /rejectOtherApprovedBusinessProfiles/)
  assert.match(repository, /getActiveApprovedBusinessProfile/)

  const service = readSource("lib/growth/business-profile/business-profile-service.ts")
  assert.match(service, /draftBusinessProfileWithAiAssistance/)
  assert.match(service, /approveBusinessProfileForOrganization/)
  assert.match(service, /rejectBusinessProfileForOrganization/)
  assertNoForbiddenProviderCalls(service, "business-profile-service")

  const generator = readSource("lib/growth/business-profile/business-profile-draft-generator.ts")
  assert.match(generator, /buildDeterministicProfileContent/)
  assert.match(generator, /draftBusinessProfileFromCompanyInput/)
  assert.match(generator, /generateWithAi/)
  assertNoForbiddenProviderCalls(generator, "draft-generator")

  const routes = [
    "app/api/platform/growth/business-profile/route.ts",
    "app/api/platform/growth/business-profile/draft/route.ts",
    "app/api/platform/growth/business-profile/[profileId]/route.ts",
    "app/api/platform/growth/business-profile/[profileId]/approve/route.ts",
    "app/api/platform/growth/business-profile/[profileId]/reject/route.ts",
  ]

  for (const routePath of routes) {
    const source = readSource(routePath)
    assert.match(source, /requireGrowthEnginePlatformAccess/)
    assert.match(source, /getGrowthEngineAiOrgId/)
    assert.match(source, /\/api\/platform\/growth\/business-profile|GROWTH_BUSINESS_PROFILE_API_PATH|business-profile/)
    assertNoForbiddenProviderCalls(source, routePath)
  }

  const ui = readSource(
    "components/growth/workspace/executive-briefing/growth-home-business-profile-section.tsx",
  )
  assert.match(ui, /data-business-profile-panel="no-profile"/)
  assert.match(ui, /data-business-profile-panel="draft"/)
  assert.match(ui, /data-business-profile-panel="approved"/)
  assert.match(ui, /BUSINESS_PROFILE_DRAFT_LABEL/)
  assert.match(ui, /BUSINESS_PROFILE_APPROVED_LABEL/)
  assert.match(ui, /GROWTH_BUSINESS_PROFILE_DRAFT_LABEL/)
  assert.match(ui, /GROWTH_BUSINESS_PROFILE_UPDATE_LABEL/)
  assert.doesNotMatch(ui, /\bICP\b/)
  assertNoForbiddenProviderCalls(ui, "business-profile-ui")

  const dashboard = readSource(
    "components/growth/workspace/executive-briefing/growth-home-executive-briefing-dashboard.tsx",
  )
  assert.match(dashboard, /GrowthHomeBusinessProfileSection/)

  for (const relativePath of ALLOWED_PATH_PREFIXES) {
    assert.ok(fs.existsSync(path.join(process.cwd(), relativePath)), `Expected file: ${relativePath}`)
  }

  for (const fragment of FORBIDDEN_CORE_PATH_FRAGMENTS) {
    for (const allowed of ALLOWED_PATH_PREFIXES) {
      assert.doesNotMatch(allowed, new RegExp(fragment.replace(/\//g, "\\/")), `Core fragment in ${allowed}`)
    }
  }

  console.log(`[${PHASE}] PASS — Business Profile foundation certified (local)`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
