/**
 * GE-AIOS-BUSINESS-PROFILE-1B — AI-assisted Business Profile draft certification.
 * Run: pnpm test:ge-aios-business-profile-1b
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { businessProfileAiDraftModelSchema } from "../lib/growth/business-profile/business-profile-ai-draft-schema"
import { mapAiModelToBusinessProfileContent } from "../lib/growth/business-profile/business-profile-ai-draft-mapper"
import { draftBusinessProfileFromCompanyInput } from "../lib/growth/business-profile/business-profile-draft-generator"
import { draftBusinessProfileWithAiAssistance } from "../lib/growth/business-profile/business-profile-ai-draft-service"
import {
  BUSINESS_PROFILE_WEBSITE_CONTEXT_MAX_CHARS,
  capBusinessProfileWebsiteContext,
  sanitizeBusinessProfileWebsiteText,
} from "../lib/growth/business-profile/business-profile-website-context-utils"
import {
  GROWTH_AIOS_BUSINESS_PROFILE_1B_QA_MARKER,
  isBusinessProfileActive,
} from "../lib/growth/business-profile/business-profile-types"
import {
  GROWTH_BUSINESS_PROFILE_DRAFTING_MESSAGE,
  GROWTH_BUSINESS_PROFILE_DRAFT_LABEL,
} from "../lib/growth/business-profile/business-profile-api-contract"

const PHASE = "GE-AIOS-BUSINESS-PROFILE-1B" as const

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

const mockAiModel = {
  company: {
    shortDescription: "Acme provides field service software for maintenance teams.",
    productsServices: ["Field service platform", "Mobile technician app"],
    businessModel: "B2B SaaS subscription",
    primaryValueProposition: "Reduce dispatch chaos and improve first-time fix rates.",
  },
  idealCustomers: {
    targetIndustries: ["Equipment maintenance", "HVAC service"],
    companySizeRanges: ["11–50", "51–200"],
    geography: ["United States"],
    buyerPersonas: ["Owner", "Operations Manager"],
    disqualifiers: ["Consumer-only businesses"],
  },
  problemsAndTriggers: {
    painPoints: ["Manual scheduling", "Missed SLAs"],
    buyingTriggers: ["Team growth", "Legacy tool replacement"],
    competitorsAlternatives: ["Spreadsheets", "Legacy FSM"],
    keywords: ["field service software", "maintenance scheduling"],
    negativeKeywords: ["consumer", "hobby"],
  },
  salesAndMarketing: {
    averageDealSize: "$12k ACV",
    salesCycleEstimate: "45–60 days",
    messagingAngles: ["Fewer missed appointments", "Technician productivity"],
    qualificationCriteria: ["Service business with 10+ technicians"],
  },
  confidence: {
    score: 0.81,
    assumptions: ["Inferred ICP from website context and operator notes."],
    missingInformation: ["Confirm average deal size bands"],
  },
}

async function main(): Promise<void> {
  console.log(`[${PHASE}] AI-assisted Business Profile draft certification`)

  assert.equal(GROWTH_AIOS_BUSINESS_PROFILE_1B_QA_MARKER, "ge-aios-business-profile-1b-v1")
  assert.equal(GROWTH_BUSINESS_PROFILE_DRAFT_LABEL, "Ask Ava to Draft My Business Profile")
  assert.equal(
    GROWTH_BUSINESS_PROFILE_DRAFTING_MESSAGE,
    "Ava is reviewing your website and preparing a draft…",
  )

  const noisy = "  Acme   provides   software\n\nfor service teams.  "
  assert.equal(sanitizeBusinessProfileWebsiteText(noisy), "Acme provides software for service teams.")

  const longText = "word ".repeat(400).trim()
  const capped = capBusinessProfileWebsiteContext(longText)
  assert.ok(capped.length <= BUSINESS_PROFILE_WEBSITE_CONTEXT_MAX_CHARS)
  assert.match(capped, /…$/)

  const malformed = businessProfileAiDraftModelSchema.safeParse({ company: { shortDescription: "x" } })
  assert.equal(malformed.success, false)

  const valid = businessProfileAiDraftModelSchema.safeParse(mockAiModel)
  assert.equal(valid.success, true)

  const mapped = mapAiModelToBusinessProfileContent({
    model: mockAiModel,
    companyInput: {
      companyName: "Acme Service Co.",
      website: "https://acme.example",
    },
    websiteContextSummary: "Acme homepage mentions field service software.",
    draftSource: "ai_assisted",
  })
  assert.equal(mapped.draftSource, "ai_assisted")
  assert.equal(mapped.company.companyName, "Acme Service Co.")
  assert.ok(mapped.confidence.assumptions.length > 0)

  const aiDraft = await draftBusinessProfileWithAiAssistance(
    {
      companyName: "Acme Service Co.",
      website: "https://acme.example",
      notes: "We focus on maintenance contractors.",
    },
    {
      organizationId: "org-test",
      fetchWebsiteContext: async () => ({
        summary: "Acme homepage mentions field service software.",
        fetchStatus: "ok",
        capped: false,
      }),
      runAiDraft: async () => mockAiModel,
    },
  )
  assert.equal(aiDraft.status, "draft")
  assert.equal(aiDraft.isActive, false)
  assert.equal(aiDraft.profile.draftSource, "ai_assisted")
  assert.equal(isBusinessProfileActive({ status: aiDraft.status }), false)

  const aiFallback = await draftBusinessProfileWithAiAssistance(
    {
      companyName: "Acme Service Co.",
      website: "https://acme.example",
    },
    {
      organizationId: "org-test",
      fetchWebsiteContext: async () => ({ summary: null, fetchStatus: "timeout", capped: false }),
      runAiDraft: async () => null,
    },
  )
  assert.equal(aiFallback.profile.draftSource, "ai_fallback")
  assert.ok(
    aiFallback.profile.confidence.assumptions.some((item) => /unavailable or invalid/i.test(item)),
  )

  const deterministic = await draftBusinessProfileWithAiAssistance(
    {
      companyName: "Acme Service Co.",
      website: "https://acme.example",
    },
    {
      organizationId: null,
      fetchWebsiteContext: async () => ({ summary: null, fetchStatus: "skipped", capped: false }),
    },
  )
  assert.equal(deterministic.profile.draftSource, "deterministic")

  const legacyDeterministic = await draftBusinessProfileFromCompanyInput({
    companyName: "Legacy Co.",
    website: "legacy.example",
  })
  assert.equal(legacyDeterministic.status, "draft")
  assert.equal(legacyDeterministic.isActive, false)

  const aiService = readSource("lib/growth/business-profile/business-profile-ai-draft-service.ts")
  assert.match(aiService, /runAiTask/)
  assert.match(aiService, /growth_business_profile_draft/)
  assert.match(aiService, /businessProfileAiDraftModelSchema/)
  assert.match(aiService, /buildFallbackProfile/)
  assertNoForbiddenProviderCalls(aiService, "ai-draft-service")

  const websiteContext = readSource("lib/growth/business-profile/business-profile-website-context.ts")
  assert.match(websiteContext, /fetchLeadWebsite/)
  assert.match(websiteContext, /capBusinessProfileWebsiteContext/)
  assert.doesNotMatch(websiteContext, /puppeteer|playwright|chromium|recursive|crawl/i)

  const service = readSource("lib/growth/business-profile/business-profile-service.ts")
  assert.match(service, /draftBusinessProfileWithAiAssistance/)
  assert.match(service, /approveBusinessProfileForOrganization/)
  assertNoForbiddenProviderCalls(service, "business-profile-service")

  const draftRoute = readSource("app/api/platform/growth/business-profile/draft/route.ts")
  assert.match(draftRoute, /notes/)
  assert.match(draftRoute, /GROWTH_AIOS_BUSINESS_PROFILE_1B_QA_MARKER/)
  assertNoForbiddenProviderCalls(draftRoute, "draft-route")

  const ui = readSource(
    "components/growth/workspace/executive-briefing/growth-home-business-profile-section.tsx",
  )
  assert.match(ui, /GROWTH_BUSINESS_PROFILE_DRAFTING_MESSAGE/)
  assert.match(ui, /data-business-profile-panel="drafting"/)
  assert.match(ui, /Ava's assumptions/)
  assert.match(ui, /Ava wants you to confirm/)
  assert.match(ui, /GROWTH_BUSINESS_PROFILE_DRAFT_LABEL/)
  assertNoForbiddenProviderCalls(ui, "business-profile-ui")

  const tasks = readSource("lib/ai/tasks.ts")
  assert.match(tasks, /growth_business_profile_draft/)

  console.log(`[${PHASE}] PASS — AI-assisted Business Profile draft certified (local)`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
