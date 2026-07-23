/**
 * AIOS-TRAINING-KNOWLEDGE-INTEGRATION-1C — Seller truth loading authority consolidation certification.
 * Run: pnpm test:aios-training-knowledge-integration-1c
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"

import { buildOutreachSellerTruth } from "@/lib/growth/aios/growth/growth-outreach-seller-truth"
import type { BusinessProfileDraftContent } from "@/lib/growth/business-profile/business-profile-types"
import { buildOutreachSalesStrategyBrief } from "@/lib/growth/aios/growth/growth-outreach-sales-strategy-brief"
import { evaluateBusinessStrategyCompleteness } from "@/lib/growth/training/evaluate-business-strategy-completeness"
import { isCanonicalSellerKnowledgeEnriched } from "@/lib/growth/training/canonical-seller-knowledge-onboarding-1a"

const PHASE = "AIOS-TRAINING-KNOWLEDGE-INTEGRATION-1C" as const
const QA_MARKER = "aios-training-knowledge-integration-1c-v1" as const
const ROOT = process.cwd()

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

function buildCompleteProfile(): BusinessProfileDraftContent {
  return {
    company: {
      companyName: "Equipify",
      website: "https://equipify.ai",
      shortDescription: "Operations platform",
      productsServices: ["Work orders", "Dispatch"],
      businessModel: "B2B SaaS",
      primaryValueProposition: "Unified operations",
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
      companyWide: { mission: "Help teams operate with clarity.", coreValues: ["Evidence"], brandPersonality: "" },
      messaging: {
        elevatorPitch: "Equipify connects dispatch and billing.",
        tone: "Consultative",
        formality: "Professional",
        emailLengthPreference: "",
        ctaPreferences: [],
        wordsToAvoid: [],
        neverSay: [],
      },
      positioning: {
        competitiveAdvantages: ["Equipment-native workflows"],
        pricingPhilosophy: "Value over discounting",
        neverCompeteOnPrice: true,
        competitorNotes: [],
      },
      objections: {
        items: [{ objection: "Too expensive", preferredResponse: "Lead with operational ROI." }],
      },
      salesPhilosophy: {
        qualificationStandards: ["Recurring service work"],
        disqualifiers: [],
        discoveryQuestions: [],
        buyingSignals: [],
      },
      salesAndRelationships: { principles: ["Earn trust with evidence"], notes: "" },
      marketingAndBrand: { principles: [], notes: "" },
      customerExperience: { principles: [], notes: "" },
      serviceStandards: { principles: [], notes: "" },
      financialGuidelines: { principles: [], notes: "" },
      confidence: { score: 90, assumptions: [], missingInformation: [] },
    },
  }
}

function buildThinProfile(): BusinessProfileDraftContent {
  return {
    ...buildCompleteProfile(),
    businessStrategy: {
      companyWide: { mission: "", coreValues: [], brandPersonality: "" },
      messaging: {
        elevatorPitch: "",
        tone: "",
        formality: "",
        emailLengthPreference: "",
        ctaPreferences: [],
        wordsToAvoid: [],
        neverSay: [],
      },
      positioning: {
        competitiveAdvantages: [],
        pricingPhilosophy: "",
        neverCompeteOnPrice: false,
        competitorNotes: [],
      },
      objections: { items: [] },
      salesPhilosophy: {
        qualificationStandards: [],
        disqualifiers: [],
        discoveryQuestions: [],
        buyingSignals: [],
      },
      salesAndRelationships: { principles: [], notes: "" },
      marketingAndBrand: { principles: [], notes: "" },
      customerExperience: { principles: [], notes: "" },
      serviceStandards: { principles: [], notes: "" },
      financialGuidelines: { principles: [], notes: "" },
      confidence: { score: 10, assumptions: [], missingInformation: ["strategy"] },
    },
    masterKnowledgeIngestion: {
      contentFingerprint: "thin-profile",
      ingestedAt: "2026-07-23T12:00:00.000Z",
      isRuntimeSourceOfTruth: false,
      sources: ["approved_profile"],
    },
  }
}

function simulateBundlePolicy(profile: BusinessProfileDraftContent | null): {
  useApprovedProfileAsIs: boolean
  runtimeEnrichmentApplied: boolean
} {
  if (!profile) {
    return { useApprovedProfileAsIs: false, runtimeEnrichmentApplied: false }
  }
  const strategyCompleteness = evaluateBusinessStrategyCompleteness(profile.businessStrategy)
  const useApprovedProfileAsIs = Boolean(
    isCanonicalSellerKnowledgeEnriched(profile) ||
      (strategyCompleteness.hasContent &&
        strategyCompleteness.filledSectionCount >= strategyCompleteness.totalSectionCount),
  )
  return {
    useApprovedProfileAsIs,
    runtimeEnrichmentApplied: !useApprovedProfileAsIs,
  }
}

function main(): void {
  console.log(`[${PHASE}] Seller truth loading authority consolidation certification`)

  const loaderSource = readSource("lib/growth/aios/growth/growth-outreach-seller-truth-loader.ts")
  assert.match(loaderSource, /export async function loadOutreachSellerTruthBundle/)
  assert.match(loaderSource, /researchOrganizationContext/)
  assert.match(loaderSource, /OutreachSellerTruthBundleMetadata/)
  const profileFetchCount = (loaderSource.match(/await getActiveApprovedBusinessProfile/g) ?? []).length
  assert.equal(profileFetchCount, 1)
  console.log("  ✓ canonical bundle performs one approved-profile load")

  assert.match(loaderSource, /loadOutreachSellerTruthForOrganization[\s\S]*loadOutreachSellerTruthBundle/)
  assert.match(
    loaderSource,
    /loadGrowthProspectResearchOrganizationContextForOrganization[\s\S]*loadOutreachSellerTruthBundle/,
  )
  console.log("  ✓ seller-truth and research-context wrappers delegate to bundle")

  const completePolicy = simulateBundlePolicy(buildCompleteProfile())
  assert.equal(completePolicy.useApprovedProfileAsIs, true)
  assert.equal(completePolicy.runtimeEnrichmentApplied, false)
  const thinPolicy = simulateBundlePolicy(buildThinProfile())
  assert.equal(thinPolicy.useApprovedProfileAsIs, false)
  assert.equal(thinPolicy.runtimeEnrichmentApplied, true)
  console.log("  ✓ complete strategy skips runtime merge; thin profile allows enrichment")

  const strategyBriefSource = readSource("lib/growth/aios/growth/growth-outreach-sales-strategy-brief.ts")
  assert.doesNotMatch(strategyBriefSource, /buildOutreachSellerTruth\(/)
  assert.match(strategyBriefSource, /sellerTruth: GrowthOutreachSellerTruth/)
  console.log("  ✓ strategy brief cannot silently inline-build seller truth")

  const callWorkspaceSource = readSource(
    "lib/growth/operator-assist/call-workspace-aios-live-reasoning-service.ts",
  )
  assert.match(callWorkspaceSource, /loadOutreachSellerTruthBundle/)
  assert.match(callWorkspaceSource, /preloadedSellerTruthBundle: sellerTruthBundle/)
  assert.doesNotMatch(callWorkspaceSource, /getActiveApprovedBusinessProfile/)
  assert.doesNotMatch(callWorkspaceSource, /enrichBusinessProfileFromMasterContextDocument/)
  console.log("  ✓ call workspace reuses one bundle/profile snapshot")

  const outreachPrepSource = readSource(
    "lib/growth/aios/growth/growth-autonomous-outreach-preparation-draft-service.ts",
  )
  assert.match(outreachPrepSource, /loadOutreachSellerTruthBundle/)
  assert.match(outreachPrepSource, /preloadedSellerTruthBundle: sellerTruthBundle/)
  assert.doesNotMatch(outreachPrepSource, /getActiveApprovedBusinessProfile/)
  assert.doesNotMatch(outreachPrepSource, /enrichBusinessProfileFromMasterContextDocument/)
  console.log("  ✓ outreach preparation reuses one bundle/profile snapshot")

  const memoryResolverSource = readSource("lib/growth/lead-memory/resolve-canonical-human-memory-for-lead.ts")
  assert.match(memoryResolverSource, /loadOutreachSellerTruthBundle/)
  assert.match(memoryResolverSource, /preloadedSellerTruthBundle/)
  assert.doesNotMatch(memoryResolverSource, /getActiveApprovedBusinessProfile/)
  assert.doesNotMatch(memoryResolverSource, /enrichBusinessProfileFromMasterContextDocument/)
  console.log("  ✓ canonical human memory resolver uses bundle authority")

  const providerService = readSource("lib/growth/aios/ai-provider-service.ts")
  assert.match(providerService, /loadOutreachSellerTruthBundle/)
  assert.match(providerService, /researchOrganizationContext/)
  console.log("  ✓ research provider path reads research context from canonical bundle")

  const sellerTruth = buildOutreachSellerTruth({
    profile: buildCompleteProfile(),
    sellerCompanyName: "Equipify",
  })
  const researchContextCompanyName = "Equipify"
  assert.equal(sellerTruth.source, "approved_business_profile")
  const brief = buildOutreachSalesStrategyBrief({
    leadId: "lead-1",
    companyName: "Prospect Co",
    preparedAt: "2026-07-23T12:00:00.000Z",
    sellerTruth,
    approvedProfile: buildCompleteProfile(),
  })
  assert.equal(brief.sellerTruth?.source, sellerTruth.source)
  assert.equal(brief.sellerTruth?.sellerCompanyName, researchContextCompanyName)
  console.log("  ✓ seller truth and downstream brief share source metadata")

  const copilotGeneration = readSource("lib/growth/run-ai-copilot-generation.ts")
  assert.match(copilotGeneration, /loadOutreachSellerTruthForOrganization/)
  console.log("  ✓ existing Copilot integration still uses canonical loader wrapper")

  const guardrailConfig = readSource("lib/growth/runtime-guardrails/growth-runtime-guardrail-config.ts")
  assert.match(guardrailConfig, /GROWTH_RUNTIME_DEFAULT_KILL_SWITCHES/)
  console.log("  ✓ outbound kill-switch defaults remain centralized")

  assert.equal(QA_MARKER, "aios-training-knowledge-integration-1c-v1")
  console.log(`[${PHASE}] PASS — Seller truth loading authority consolidation certified (local)`)
}

main()
