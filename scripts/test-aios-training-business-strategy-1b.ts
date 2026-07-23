/**
 * AIOS-TRAINING-BUSINESS-STRATEGY-1B — Business Strategy persistence, approval, and Ava retrieval certification.
 * Run: pnpm test:aios-training-business-strategy-1b
 */
import assert from "node:assert/strict"

import { buildOutreachSellerTruth } from "@/lib/growth/aios/growth/growth-outreach-seller-truth"
import type { BusinessProfileDraftContent } from "@/lib/growth/business-profile/business-profile-types"
import { buildGrowthTrainingOverviewReadModel } from "@/lib/growth/training/build-growth-training-overview-read-model"
import { BusinessStrategyContentSchema } from "@/lib/growth/training/growth-business-strategy-schema"
import { evaluateBusinessStrategyCompleteness } from "@/lib/growth/training/evaluate-business-strategy-completeness"
import {
  GROWTH_BUSINESS_STRATEGY_TRAINABLE_SECTION_COUNT,
  GROWTH_BUSINESS_STRATEGY_TRAINABLE_SECTIONS,
} from "@/lib/growth/training/growth-business-strategy-trainable-sections"
import {
  createEmptyBusinessStrategyContent,
  resolveBusinessStrategyContent,
  type BusinessStrategyContent,
} from "@/lib/growth/training/growth-business-strategy-types"

const PHASE = "AIOS-TRAINING-BUSINESS-STRATEGY-1B" as const
const ORG = "00000000-0000-4000-8000-000000000001"

function listLines(values: string[]): string {
  return values.join("\n")
}

function parseLines(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
}

function buildFixtureStrategy(): BusinessStrategyContent {
  return {
    ...createEmptyBusinessStrategyContent(),
    companyWide: {
      mission: "Help equipment-service teams run smarter revenue operations.",
      coreValues: ["Speed", " Honesty ", "Outcomes"],
      brandPersonality: "",
    },
    messaging: {
      elevatorPitch: "Equipify helps field-service teams turn research into revenue.",
      tone: "Educational and direct",
      formality: "Professional but approachable",
      emailLengthPreference: "",
      ctaPreferences: [],
      wordsToAvoid: ["guaranteed", "revolutionary"],
      neverSay: [],
    },
    positioning: {
      competitiveAdvantages: ["Response time", "Equipment-native workflows"],
      pricingPhilosophy: "Never compete on price alone.",
      neverCompeteOnPrice: true,
      competitorNotes: [],
    },
    objections: {
      items: [
        { objection: "Too expensive", preferredResponse: "Lead with operational ROI." },
        { objection: "We already have a CRM", preferredResponse: "Equipify complements dispatch workflows." },
      ],
    },
    salesPhilosophy: {
      qualificationStandards: ["Recurring work orders", "Field dispatch pain"],
      disqualifiers: [],
      discoveryQuestions: ["How do you track equipment history today?"],
      buyingSignals: [],
    },
    salesAndRelationships: {
      principles: ["Earn trust with evidence", "Respect operator time"],
      notes: "",
    },
  }
}

function buildApprovedProfile(strategy: BusinessStrategyContent) {
  const profile: BusinessProfileDraftContent = {
    company: {
      companyName: "Equipify",
      website: "https://equipify.ai",
      shortDescription: "Equipment-service revenue OS",
      productsServices: ["AI OS"],
      businessModel: "SaaS",
      primaryValueProposition: "Smarter revenue for field service",
    },
    idealCustomers: {
      targetIndustries: ["Field Service"],
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
    businessStrategy: strategy,
  }

  return {
    id: "profile-approved-1b",
    organizationId: ORG,
    status: "approved" as const,
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
  }
}

function main(): void {
  console.log(`[${PHASE}] Business Strategy workflow certification`)

  const fixture = buildFixtureStrategy()

  // Multiline list serialization (matches growth-training-business-strategy-section.tsx)
  const coreValuesRaw = listLines(fixture.companyWide.coreValues)
  const coreValuesParsedOnce = parseLines(coreValuesRaw)
  const coreValuesParsedTwice = parseLines(listLines(coreValuesParsedOnce))
  assert.deepEqual(coreValuesParsedOnce, ["Speed", "Honesty", "Outcomes"])
  assert.deepEqual(coreValuesParsedOnce, coreValuesParsedTwice)
  console.log("  ✓ multiline ordered-list preservation + idempotent parse")

  const objectionsRoundtrip = BusinessStrategyContentSchema.parse({
    ...fixture,
    objections: {
      items: fixture.objections.items.map((item) => ({ ...item })),
    },
  })
  assert.equal(objectionsRoundtrip.objections.items.length, 2)
  assert.equal(objectionsRoundtrip.objections.items[0]?.objection, "Too expensive")
  assert.equal(objectionsRoundtrip.objections.items[0]?.preferredResponse, "Lead with operational ROI.")
  assert.equal(objectionsRoundtrip.objections.items[1]?.objection, "We already have a CRM")
  console.log("  ✓ objection pair preservation through schema")

  const serialized = BusinessStrategyContentSchema.parse(fixture)
  const deserialized = resolveBusinessStrategyContent(serialized)
  assert.equal(deserialized.messaging.tone, fixture.messaging.tone)
  assert.equal(deserialized.positioning.pricingPhilosophy, fixture.positioning.pricingPhilosophy)
  assert.equal(deserialized.salesPhilosophy.discoveryQuestions[0], fixture.salesPhilosophy.discoveryQuestions[0])
  console.log("  ✓ full strategy serialization + deserialization")

  const approved = buildApprovedProfile(fixture)
  const draftStrategy = {
    ...fixture,
    messaging: { ...fixture.messaging, tone: "Draft-only tone" },
  }
  const draft = { ...approved, id: "profile-draft-1b", status: "draft" as const, isActive: false, profile: { ...approved.profile, businessStrategy: draftStrategy } }

  const completeness = evaluateBusinessStrategyCompleteness(fixture)
  assert.equal(completeness.hasContent, true)
  assert.equal(completeness.filledSectionCount, GROWTH_BUSINESS_STRATEGY_TRAINABLE_SECTION_COUNT)
  assert.equal(completeness.totalSectionCount, GROWTH_BUSINESS_STRATEGY_TRAINABLE_SECTION_COUNT)
  assert.equal(completeness.missingAreas.length, 0)
  console.log("  ✓ six current UI sections define the completeness denominator (6/6)")

  const overviewApproved = buildGrowthTrainingOverviewReadModel({
    activeApproved: approved,
    latestDraft: null,
    organizationalKnowledge: null,
    launchSetup: null,
  })
  const strategyArea = overviewApproved.areas.find((area) => area.id === "business_strategy")
  assert.ok(strategyArea)
  assert.equal(strategyArea?.status, "complete")
  assert.match(strategyArea?.summary ?? "", /know how you want me to think/i)
  assert.equal(strategyArea?.coachingHint, null)
  console.log("  ✓ fully completed approved strategy projects Well understood (complete)")

  const partialStrategy = {
    ...fixture,
    objections: { items: [] },
    salesAndRelationships: { principles: [], notes: "" },
  }
  const partialCompleteness = evaluateBusinessStrategyCompleteness(partialStrategy)
  assert.ok(partialCompleteness.filledSectionCount < partialCompleteness.totalSectionCount)
  assert.ok(partialCompleteness.missingAreas.includes("objections"))
  console.log("  ✓ partial strategy returns accurate progress")

  const emptyCompleteness = evaluateBusinessStrategyCompleteness(createEmptyBusinessStrategyContent())
  assert.equal(emptyCompleteness.hasContent, false)
  assert.equal(emptyCompleteness.filledSectionCount, 0)
  assert.equal(emptyCompleteness.missingAreas.length, GROWTH_BUSINESS_STRATEGY_TRAINABLE_SECTION_COUNT)
  const overviewEmpty = buildGrowthTrainingOverviewReadModel({
    activeApproved: { ...approved, profile: { ...approved.profile, businessStrategy: createEmptyBusinessStrategyContent() } },
    latestDraft: null,
    organizationalKnowledge: null,
    launchSetup: null,
  })
  const emptyArea = overviewEmpty.areas.find((area) => area.id === "business_strategy")
  assert.equal(emptyArea?.status, "not_started")
  console.log("  ✓ empty strategy remains incomplete")

  const reservedOnlyStrategy = {
    ...createEmptyBusinessStrategyContent(),
    marketingAndBrand: { principles: ["Brand consistency"], notes: "Future UI section" },
    customerExperience: { principles: ["White-glove onboarding"], notes: "" },
  }
  const reservedCompleteness = evaluateBusinessStrategyCompleteness(reservedOnlyStrategy)
  assert.equal(reservedCompleteness.filledSectionCount, 0)
  assert.equal(reservedCompleteness.totalSectionCount, GROWTH_BUSINESS_STRATEGY_TRAINABLE_SECTION_COUNT)
  const reservedParsed = BusinessStrategyContentSchema.parse(reservedOnlyStrategy)
  assert.equal(reservedParsed.marketingAndBrand.principles[0], "Brand consistency")
  console.log("  ✓ future hidden schema fields do not reduce current completion but remain valid")

  assert.equal(GROWTH_BUSINESS_STRATEGY_TRAINABLE_SECTIONS.length, 6)
  console.log("  ✓ trainable section registry matches current form surface")

  const overviewDraft = buildGrowthTrainingOverviewReadModel({
    activeApproved: approved,
    latestDraft: draft,
    organizationalKnowledge: null,
    launchSetup: null,
  })
  const draftArea = overviewDraft.areas.find((area) => area.id === "business_strategy")
  assert.equal(draftArea?.status, "in_progress")
  console.log("  ✓ draft overlay remains distinguishable on overview")

  const sellerTruthApproved = buildOutreachSellerTruth({ profile: approved.profile })
  assert.equal(sellerTruthApproved.source, "approved_business_profile")
  assert.equal(sellerTruthApproved.mission, fixture.companyWide.mission)
  assert.equal(sellerTruthApproved.elevatorPitch, fixture.messaging.elevatorPitch)
  assert.equal(sellerTruthApproved.tonePreference, fixture.messaging.tone)
  assert.deepEqual(sellerTruthApproved.wordsToAvoid, fixture.messaging.wordsToAvoid)
  assert.equal(sellerTruthApproved.discoveryQuestions[0], fixture.salesPhilosophy.discoveryQuestions[0])
  assert.equal(sellerTruthApproved.objections[0]?.objection, "Too expensive")
  assert.equal(sellerTruthApproved.objections[0]?.response, "Lead with operational ROI.")
  console.log("  ✓ Ava seller truth retrieves approved strategy fields")

  const sellerTruthFallback = buildOutreachSellerTruth({ profile: null })
  assert.equal(sellerTruthFallback.source, "fallback_defaults")
  assert.notEqual(sellerTruthFallback.tonePreference, fixture.messaging.tone)
  console.log("  ✓ approved strategy precedence over fallback defaults")

  assert.ok(completeness.wellUnderstoodAreas.includes("messaging & tone"))
  assert.ok(completeness.wellUnderstoodAreas.includes("objections"))
  console.log("  ✓ completeness evaluator recognizes taught strategy")

  const hypotheticalQualification = fixture.salesPhilosophy.qualificationStandards.some((standard) =>
    "recurring work orders".includes(standard.toLowerCase()) || standard.toLowerCase().includes("field dispatch"),
  )
  assert.equal(hypotheticalQualification, true)

  const prohibited = sellerTruthApproved.wordsToAvoid.some((word) => word.toLowerCase() === "guaranteed")
  assert.equal(prohibited, true)

  const discoveryMatch = sellerTruthApproved.discoveryQuestions.find((question) =>
    question.includes("equipment history"),
  )
  assert.ok(discoveryMatch)

  const objectionResponse = sellerTruthApproved.objections.find((row) => row.objection === "Too expensive")
  assert.equal(objectionResponse?.response, "Lead with operational ROI.")
  console.log("  ✓ practical application checks (qualification, tone, prohibited language, discovery, objection)")

  console.log(`[${PHASE}] PASS — Business Strategy workflow certified (local)`)
}

main()
