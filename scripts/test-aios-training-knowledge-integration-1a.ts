/**
 * AIOS-TRAINING-KNOWLEDGE-INTEGRATION-1A — Canonical organizational knowledge audit certification.
 * Run: pnpm test:aios-training-knowledge-integration-1a
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"

import { buildGrowthAiCopilotOrganizationKnowledgeBlock } from "@/lib/growth/ai-copilot-organization-knowledge"
import {
  buildGrowthAiCopilotSystemPrompt,
  buildGrowthAiCopilotUserPrompt,
} from "@/lib/growth/ai-copilot-prompts"
import { buildOutreachSellerTruth } from "@/lib/growth/aios/growth/growth-outreach-seller-truth"
import type { BusinessProfileDraftContent } from "@/lib/growth/business-profile/business-profile-types"
import { evaluateBusinessStrategyCompleteness } from "@/lib/growth/training/evaluate-business-strategy-completeness"
import { buildGrowthTrainingOverviewReadModel } from "@/lib/growth/training/build-growth-training-overview-read-model"
import { isCanonicalSellerKnowledgeEnriched } from "@/lib/growth/training/canonical-seller-knowledge-onboarding-1a"

const PHASE = "AIOS-TRAINING-KNOWLEDGE-INTEGRATION-1A" as const
const ROOT = process.cwd()

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

function buildApprovedProfile(): BusinessProfileDraftContent {
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
      objections: {
        items: [{ objection: "Too expensive", preferredResponse: "Lead with operational ROI." }],
      },
      salesPhilosophy: {
        qualificationStandards: ["Recurring service work"],
        disqualifiers: [],
        discoveryQuestions: ["How do you track equipment history today?"],
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

function buildStoredCanonicalProfile(): BusinessProfileDraftContent {
  return {
    ...buildApprovedProfile(),
    canonicalSellerKnowledge: {
      version: "equipify-canonical-v1",
      company: {
        mission: "stored canonical mission",
        targetCustomer: "Field service operators",
        differentiators: ["Equipment-native"],
        whenNotToRecommend: ["No field operations"],
        businessOutcomes: ["Cleaner dispatch"],
      },
      products: { platformName: "Equipify", modules: [] },
      industries: [],
      personas: [],
      competitors: [],
      commercial: {
        pricingPhilosophy: "Value over discounting",
        packagingPhilosophy: "",
        budgetConversation: "",
      },
      proof: [],
      buyingPsychology: [],
      postponeTopics: [],
    },
    masterKnowledgeIngestion: {
      contentFingerprint: "fp-1",
      ingestedAt: "2026-07-23T12:00:00.000Z",
      isRuntimeSourceOfTruth: false,
      sources: ["approved_profile"],
    },
  }
}

function main(): void {
  console.log(`[${PHASE}] Canonical organizational knowledge audit certification`)

  const sellerTruthLoader = readSource("lib/growth/aios/growth/growth-outreach-seller-truth-loader.ts")
  assert.match(sellerTruthLoader, /getActiveApprovedBusinessProfile/)
  assert.match(sellerTruthLoader, /loadOutreachSellerTruthForOrganization/)
  assert.match(sellerTruthLoader, /evaluateBusinessStrategyCompleteness/)
  assert.match(sellerTruthLoader, /useApprovedProfileAsIs/)
  console.log("  ✓ single canonical seller-truth loader uses approved profile")

  const copilotGeneration = readSource("lib/growth/run-ai-copilot-generation.ts")
  assert.match(copilotGeneration, /loadOutreachSellerTruthForOrganization/)
  assert.match(copilotGeneration, /buildGrowthAiCopilotOrganizationKnowledgeBlock/)
  assert.doesNotMatch(copilotGeneration, /buildOutreachSellerTruth\(/)
  console.log("  ✓ Growth Copilot loads seller truth through canonical loader")

  const copilotPrompts = readSource("lib/growth/ai-copilot-prompts.ts")
  assert.match(copilotPrompts, /organizationKnowledge/)
  assert.doesNotMatch(copilotPrompts, /You are Equipify Growth Engine AI Communication Copilot\./)
  console.log("  ✓ copilot prompts reference organizationKnowledge instead of hardcoded Equipify role")

  const evidenceProvider = readSource(
    "lib/growth/evidence-engine/providers/approved-profile-evidence-provider.ts",
  )
  assert.match(evidenceProvider, /collectApprovedProfileEvidence/)
  assert.match(evidenceProvider, /business_strategy\./)
  console.log("  ✓ evidence engine reads approved profile facts")

  const strategyBrief = readSource("lib/growth/aios/growth/growth-outreach-sales-strategy-brief.ts")
  assert.match(strategyBrief, /sellerTruth/)
  console.log("  ✓ outreach strategy brief consumes seller truth projection")

  const profile = buildApprovedProfile()
  assert.equal(isCanonicalSellerKnowledgeEnriched(buildStoredCanonicalProfile()), true)

  const approvedSellerTruth = buildOutreachSellerTruth({
    profileId: "profile-1",
    profile,
    sellerCompanyName: profile.company.companyName,
  })
  assert.equal(approvedSellerTruth.source, "approved_business_profile")
  assert.equal(approvedSellerTruth.mission, profile.businessStrategy?.companyWide.mission ?? null)
  assert.equal(approvedSellerTruth.elevatorPitch, profile.businessStrategy?.messaging.elevatorPitch ?? null)
  console.log("  ✓ approved profile precedence over fallback defaults")

  const fallbackSellerTruth = buildOutreachSellerTruth({ profile: null })
  assert.equal(fallbackSellerTruth.source, "fallback_defaults")
  assert.notEqual(fallbackSellerTruth.tonePreference, approvedSellerTruth.tonePreference)
  console.log("  ✓ fallback remains distinct when no approved profile")

  const organizationKnowledge = buildGrowthAiCopilotOrganizationKnowledgeBlock(approvedSellerTruth)
  assert.equal(organizationKnowledge.source, "approved_business_profile")
  assert.equal(organizationKnowledge.mission, approvedSellerTruth.mission)
  assert.ok(organizationKnowledge.objections.length > 0)
  console.log("  ✓ copilot organization knowledge block projects approved strategy")

  const systemPrompt = buildGrowthAiCopilotSystemPrompt(
    "cold_email",
    "default",
    [],
    null,
    organizationKnowledge,
  )
  assert.match(systemPrompt, /Equipify's Growth Engine AI Communication Copilot/)
  assert.match(systemPrompt, /approved organizationKnowledge block/)
  const userPrompt = buildGrowthAiCopilotUserPrompt(
    "cold_email",
    {
      companyName: "Acme Service",
      contactName: "Pat",
      fitScore: 80,
      engagementTier: "warm",
      engagementSummary: "Interested",
      relationshipTier: "engaged",
      relationshipTrend: "up",
      opportunityTier: "ready",
      opportunityBlockers: [],
      opportunityAccelerators: [],
      revenueTier: "medium",
      revenueTrajectory: "up",
      executiveTier: "high",
      executiveRecommendation: "Proceed",
      capacityTier: "ok",
      capacityProtection: "None",
      researchSummary: "Field service operator",
      researchNextAction: "Discovery call",
      decisionMakers: [],
      nextBestAction: "Call",
      nextBestActionReason: "Warm engagement",
      recentOutbound: [],
      replyPreview: null,
      growthSignalScore: null,
      growthSignalTier: null,
      growthSignalRecommendedAction: null,
      topGrowthSignals: [],
      frameworks: { objections: [], buyingSignals: [], commitmentSignals: [] },
      relationshipMemory: { available: false },
    },
    { organizationKnowledge },
  )
  assert.match(userPrompt, /"organizationKnowledge"/)
  assert.match(userPrompt, /Consultative and practical/)
  console.log("  ✓ copilot user prompt embeds approved tone and strategy")

  const completeness = evaluateBusinessStrategyCompleteness(profile.businessStrategy)
  const overview = buildGrowthTrainingOverviewReadModel({
    activeApproved: {
      id: "profile-1",
      organizationId: "org-1",
      status: "approved",
      isActive: true,
      companyName: profile.company.companyName,
      website: profile.company.website,
      input: {},
      profile,
      label: "Approved",
      createdBy: "user-1",
      approvedBy: "user-1",
      approvedAt: "2026-07-23T12:00:00.000Z",
      rejectedAt: null,
      createdAt: "2026-07-01T00:00:00.000Z",
      updatedAt: "2026-07-23T12:00:00.000Z",
    },
    latestDraft: null,
    organizationalKnowledge: null,
    launchSetup: null,
  })
  const strategyArea = overview.areas.find((area) => area.id === "business_strategy")
  assert.equal(strategyArea?.status, "complete")
  assert.equal(completeness.filledSectionCount, completeness.totalSectionCount)
  console.log("  ✓ training overview and completeness align with approved strategy")

  const salesSpecialist = readSource("lib/growth/specialists/execution/execute-sales-workflow-agent.ts")
  assert.doesNotMatch(salesSpecialist, /buildOutreachSellerTruth\(/)
  console.log("  ✓ sales specialist routing does not duplicate seller-truth builder inline")

  const marketingSpecialist = readSource("lib/growth/specialists/specialists/marketing-specialist.ts")
  assert.match(marketingSpecialist, /stub: true/)
  console.log("  ✓ marketing specialist remains stub until domain wiring ships")

  console.log(`[${PHASE}] PASS — Canonical organizational knowledge audit certified (local)`)
}

main()
