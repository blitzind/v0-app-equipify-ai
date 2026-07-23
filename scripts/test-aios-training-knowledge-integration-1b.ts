/**
 * AIOS-TRAINING-KNOWLEDGE-INTEGRATION-1B — Prospect research organizational knowledge decoupling certification.
 * Run: pnpm test:aios-training-knowledge-integration-1b
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"

import { buildOutreachSellerTruth } from "@/lib/growth/aios/growth/growth-outreach-seller-truth"
import type { BusinessProfileDraftContent } from "@/lib/growth/business-profile/business-profile-types"
import { buildAiOsProviderMessagesFromContextPackage } from "@/lib/growth/aios/ai-provider-context-prompt"
import {
  buildGrowthProspectResearchOrganizationContextFallback,
  buildGrowthProspectResearchOrganizationContextFromSellerTruth,
  GROWTH_PROSPECT_RESEARCH_AI_FIT_SCORE_KEY,
  GROWTH_PROSPECT_RESEARCH_LEGACY_FIT_SCORE_KEY,
} from "@/lib/growth/research/growth-prospect-research-organization-context"
import {
  buildGrowthProspectResearchSystemPrompt,
  researchPromptContainsHardcodedEquipifyProductFraming,
} from "@/lib/growth/research/growth-prospect-research-prompt-builder"
import {
  buildGrowthLeadResearchSystemPrompt,
  buildGrowthLeadResearchUserPrompt,
} from "@/lib/growth/research-prompt"
import {
  growthLeadResearchModelSchema,
  mapGrowthLeadResearchModelToResult,
  normalizeGrowthLeadResearchModelFieldNames,
} from "@/lib/growth/research-schema"
import type { GrowthLead } from "@/lib/growth/types"

const PHASE = "AIOS-TRAINING-KNOWLEDGE-INTEGRATION-1B" as const
const ROOT = process.cwd()

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

function buildEquipifyProfile(): BusinessProfileDraftContent {
  return {
    company: {
      companyName: "Equipify",
      website: "https://equipify.ai",
      shortDescription: "Operations platform for field service",
      productsServices: ["Work orders", "Dispatch", "Customer portal"],
      businessModel: "B2B SaaS",
      primaryValueProposition: "Unified field-service operations",
    },
    idealCustomers: {
      targetIndustries: ["Field service"],
      companySizeRanges: ["11-50"],
      geography: ["North America"],
      buyerPersonas: ["Operations leader"],
      disqualifiers: ["Pure software vendors"],
    },
    problemsAndTriggers: {
      painPoints: ["Dispatch chaos"],
      buyingTriggers: ["Growth mandate"],
      competitorsAlternatives: ["Spreadsheets"],
      keywords: ["field service"],
      negativeKeywords: [],
    },
    salesAndMarketing: {
      averageDealSize: "$25k",
      salesCycleEstimate: "60 days",
      messagingAngles: ["Operational ROI"],
      qualificationCriteria: ["Has technicians"],
    },
    confidence: { score: 85, assumptions: [], missingInformation: [] },
    businessStrategy: {
      companyWide: {
        mission: "Help field service teams operate with clarity.",
        coreValues: ["Evidence", "Speed"],
        brandPersonality: "",
      },
      messaging: {
        elevatorPitch: "Equipify connects dispatch, assets, and billing in one system.",
        tone: "Consultative and practical",
        formality: "Professional",
        emailLengthPreference: "",
        ctaPreferences: [],
        wordsToAvoid: ["guaranteed"],
        neverSay: [],
      },
      positioning: {
        competitiveAdvantages: ["Equipment-native workflows"],
        pricingPhilosophy: "Value over discounting",
        neverCompeteOnPrice: true,
        competitorNotes: [],
      },
      objections: { items: [] },
      salesPhilosophy: {
        qualificationStandards: ["Recurring service work"],
        disqualifiers: [],
        discoveryQuestions: [],
        buyingSignals: [],
      },
      salesAndRelationships: { principles: [], notes: "" },
      marketingAndBrand: { principles: [], notes: "" },
      customerExperience: { principles: [], notes: "" },
      serviceStandards: { principles: [], notes: "" },
      financialGuidelines: { principles: [], notes: "" },
      confidence: { score: 90, assumptions: [], missingInformation: [] },
    },
  }
}

function buildAcmeProfile(): BusinessProfileDraftContent {
  return {
    ...buildEquipifyProfile(),
    company: {
      companyName: "Acme Industrial Analytics",
      website: "https://acme-analytics.example",
      shortDescription: "Predictive maintenance analytics",
      productsServices: ["Sensor analytics", "Downtime forecasting"],
      businessModel: "B2B SaaS",
      primaryValueProposition: "Reduce unplanned downtime with sensor intelligence",
    },
    idealCustomers: {
      targetIndustries: ["Manufacturing"],
      companySizeRanges: ["51-200"],
      geography: ["Midwest US"],
      buyerPersonas: ["Plant manager"],
      disqualifiers: ["No production equipment"],
    },
    problemsAndTriggers: {
      painPoints: ["Unplanned downtime"],
      buyingTriggers: ["OEE mandate"],
      competitorsAlternatives: ["Legacy SCADA"],
      keywords: ["predictive maintenance"],
      negativeKeywords: [],
    },
    salesAndMarketing: {
      averageDealSize: "$80k",
      salesCycleEstimate: "120 days",
      messagingAngles: ["Downtime ROI"],
      qualificationCriteria: ["Has sensor data"],
    },
    confidence: { score: 80, assumptions: [], missingInformation: [] },
    businessStrategy: {
      ...buildEquipifyProfile().businessStrategy!,
      companyWide: {
        mission: "Help manufacturers avoid surprise downtime.",
        coreValues: ["Reliability"],
        brandPersonality: "",
      },
      messaging: {
        ...buildEquipifyProfile().businessStrategy!.messaging,
        elevatorPitch: "Acme turns sensor noise into downtime prevention.",
      },
      salesPhilosophy: {
        qualificationStandards: ["Has critical assets to monitor"],
        disqualifiers: ["No connected equipment"],
        discoveryQuestions: [],
        buyingSignals: [],
      },
    },
  }
}

function buildSampleLead(): GrowthLead {
  return {
    id: "lead-1",
    organizationId: "org-1",
    companyName: "Prospect HVAC Co.",
    contactName: "Jordan",
    contactEmail: "jordan@example.com",
    contactPhone: null,
    website: "https://prospect.example",
    addressLine1: null,
    addressLine2: null,
    city: "Dallas",
    state: "TX",
    postalCode: null,
    country: "USA",
    sourceKind: "manual",
    sourceDetail: null,
    status: "new",
    notes: "Commercial HVAC",
    score: null,
    researchPriority: "normal",
    createdAt: "2026-07-23T12:00:00.000Z",
    updatedAt: "2026-07-23T12:00:00.000Z",
    createdBy: null,
    assignedTo: null,
    lastResearchedAt: null,
    metadata: {},
  }
}

async function main(): Promise<void> {
  console.log(`[${PHASE}] Prospect research organizational knowledge decoupling certification`)

  const equipifySellerTruth = buildOutreachSellerTruth({
    profileId: "profile-equipify",
    profile: buildEquipifyProfile(),
    sellerCompanyName: "Equipify",
  })
  const equipifyContext = buildGrowthProspectResearchOrganizationContextFromSellerTruth({
    sellerTruth: equipifySellerTruth,
    geography: buildEquipifyProfile().idealCustomers.geography,
    companySizeRanges: buildEquipifyProfile().idealCustomers.companySizeRanges,
    painPoints: buildEquipifyProfile().problemsAndTriggers.painPoints,
  })

  const acmeSellerTruth = buildOutreachSellerTruth({
    profileId: "profile-acme",
    profile: buildAcmeProfile(),
    sellerCompanyName: "Acme Industrial Analytics",
  })
  const acmeContext = buildGrowthProspectResearchOrganizationContextFromSellerTruth({
    sellerTruth: acmeSellerTruth,
    geography: buildAcmeProfile().idealCustomers.geography,
    companySizeRanges: buildAcmeProfile().idealCustomers.companySizeRanges,
    painPoints: buildAcmeProfile().problemsAndTriggers.painPoints,
  })

  const equipifySystemPrompt = buildGrowthProspectResearchSystemPrompt({
    websiteContext: { fetchStatus: "skipped", normalizedUrl: null, excerpt: null },
    organizationContext: equipifyContext,
  })
  assert.equal(equipifyContext.source, "approved_business_profile")
  assert.match(equipifySystemPrompt, /Equipify/)
  assert.match(equipifySystemPrompt, /Work orders/)
  assert.match(equipifySystemPrompt, /Recurring service work/)
  assert.match(equipifySystemPrompt, /organization_fit_score/)
  assert.doesNotMatch(equipifySystemPrompt, /equipify_fit_score/)
  assert.equal(researchPromptContainsHardcodedEquipifyProductFraming(equipifySystemPrompt), false)
  console.log("  ✓ research prompt uses approved organization knowledge dynamically")

  const acmeSystemPrompt = buildGrowthProspectResearchSystemPrompt({
    websiteContext: { fetchStatus: "skipped", normalizedUrl: null, excerpt: null },
    organizationContext: acmeContext,
  })
  assert.match(acmeSystemPrompt, /Acme Industrial Analytics/)
  assert.match(acmeSystemPrompt, /Sensor analytics/)
  assert.doesNotMatch(acmeSystemPrompt, /Equipify connects dispatch/)
  assert.notEqual(equipifySystemPrompt, acmeSystemPrompt)
  console.log("  ✓ second organization context produces different prompt framing")

  const fallbackPrompt = buildGrowthProspectResearchSystemPrompt({
    websiteContext: { fetchStatus: "skipped", normalizedUrl: null, excerpt: null },
    organizationContext: buildGrowthProspectResearchOrganizationContextFallback(),
  })
  assert.match(fallbackPrompt, /approved organization profile is not configured/)
  assert.doesNotMatch(fallbackPrompt, /Equipify/)
  assert.doesNotMatch(fallbackPrompt, /field-service software/)
  console.log("  ✓ generic fallback contains no Equipify knowledge")

  const providerPromptSource = readSource("lib/growth/aios/ai-provider-context-prompt.ts")
  assert.doesNotMatch(providerPromptSource, /equipify_pain_points/)
  assert.doesNotMatch(providerPromptSource, /Equipify is field-service software/)
  assert.doesNotMatch(providerPromptSource, /RESEARCH_COMPANY_SYSTEM_PROMPT/)
  console.log("  ✓ reusable prompt sources contain no hardcoded Equipify product description")

  const providerService = readSource("lib/growth/aios/ai-provider-service.ts")
  assert.match(providerService, /loadOutreachSellerTruthBundle/)
  assert.match(providerService, /researchOrganizationContext/)
  console.log("  ✓ AI OS provider service loads organization research context from canonical bundle")

  const sellerTruthLoader = readSource("lib/growth/aios/growth/growth-outreach-seller-truth-loader.ts")
  assert.match(sellerTruthLoader, /export async function loadOutreachSellerTruthBundle/)
  assert.match(sellerTruthLoader, /loadGrowthProspectResearchOrganizationContextForOrganization/)
  const profileFetchCount = (sellerTruthLoader.match(/await getActiveApprovedBusinessProfile/g) ?? []).length
  assert.equal(profileFetchCount, 1)
  console.log("  ✓ research context loader reuses seller-truth bundle without duplicate profile authority")

  const legacyPrompt = buildGrowthLeadResearchSystemPrompt(
    { fetchStatus: "skipped", normalizedUrl: null, excerpt: null },
    equipifyContext,
  )
  const legacyUserPrompt = buildGrowthLeadResearchUserPrompt(
    buildSampleLead(),
    { fetchStatus: "skipped", normalizedUrl: null, excerpt: null },
    equipifyContext,
  )
  assert.match(legacyPrompt, /Equipify/)
  assert.match(legacyUserPrompt, /"companyName": "Equipify"/)
  console.log("  ✓ legacy research-prompt entry points accept organization context")

  const normalized = normalizeGrowthLeadResearchModelFieldNames({
    company_summary: "Summary",
    recommended_next_action: "Call",
    research_confidence: 0.7,
    [GROWTH_PROSPECT_RESEARCH_AI_FIT_SCORE_KEY]: 72,
    organization_pain_points: ["Manual dispatch"],
  }) as Record<string, unknown>
  assert.equal(normalized[GROWTH_PROSPECT_RESEARCH_LEGACY_FIT_SCORE_KEY], 72)
  const parsed = growthLeadResearchModelSchema.parse(normalized)
  const mapped = mapGrowthLeadResearchModelToResult(parsed)
  assert.equal(mapped.equipifyFitScore, 72)
  assert.deepEqual(mapped.equipifyPainPoints, ["Manual dispatch"])
  console.log("  ✓ fit-score compatibility maps neutral AI keys to legacy persisted fields")

  const legacyParsed = growthLeadResearchModelSchema.parse({
    company_summary: "Legacy row",
    recommended_next_action: "Verify fit",
    equipify_fit_score: 55,
    equipify_pain_points: ["Spreadsheet chaos"],
    research_confidence: 0.6,
  })
  assert.equal(legacyParsed.equipify_fit_score, 55)
  console.log("  ✓ existing research result parsing remains compatible")

  const researchRepository = readSource("lib/growth/research-repository.ts")
  assert.match(researchRepository, /equipify_fit_score/)
  console.log("  ✓ research persistence contract remains on legacy equipify_fit_score column")

  const orchestrator = readSource("lib/growth/research/research-orchestrator.ts")
  assert.match(orchestrator, /runProspectResearch/)
  assert.doesNotMatch(orchestrator, /Equipify is field-service software/)
  console.log("  ✓ canonical deterministic research orchestrator unchanged")

  const admissionSource = readSource("lib/growth/research/growth-lead-research-readiness.ts")
  assert.doesNotMatch(admissionSource, /Equipify is field-service software/)
  console.log("  ✓ admission/readiness modules remain organization-neutral at source level")

  const guardrailConfig = readSource("lib/growth/runtime-guardrails/growth-runtime-guardrail-config.ts")
  assert.match(guardrailConfig, /GROWTH_RUNTIME_DEFAULT_KILL_SWITCHES/)
  console.log("  ✓ outbound kill-switch defaults remain centralized in guardrail config")

  const aiOsMessages = buildAiOsProviderMessagesFromContextPackage({
    purpose: "research_company",
    organizationContext: equipifyContext,
    contextPackage: {
      id: "ctx-1",
      organizationId: "org-1",
      missionId: null,
      workOrderId: null,
      contextVersion: "v1",
      checksum: "abc",
      workOrderContext: null,
      missionContext: null,
      decisionHistory: [],
      memoryReferences: [],
      relatedEvents: [],
      evidenceBundle: [],
      entityMetadata: {},
      sourceKeys: [],
      createdAt: "2026-07-23T12:00:00.000Z",
    },
  })
  const systemMessage = aiOsMessages.find((message) => message.role === "system")
  assert.ok(typeof systemMessage?.content === "string")
  assert.match(systemMessage.content as string, /Equipify/)
  assert.equal(researchPromptContainsHardcodedEquipifyProductFraming(systemMessage.content as string), false)
  console.log("  ✓ AI OS research_company system prompt uses dynamic organization context")

  console.log(`[${PHASE}] PASS — Prospect research organizational knowledge decoupling certified (local)`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
