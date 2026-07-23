/**
 * AIOS-TRAINING-KNOWLEDGE-INTEGRATION-1D — Outreach personalization and playbook decoupling certification.
 * Run: pnpm test:aios-training-knowledge-integration-1d
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"

import { buildOutreachSellerTruth } from "@/lib/growth/aios/growth/growth-outreach-seller-truth"
import type { BusinessProfileDraftContent } from "@/lib/growth/business-profile/business-profile-types"
import {
  buildOutreachRefinementSystemPrompt,
  buildOutreachRefinementUserPrompt,
} from "@/lib/growth/outreach/personalization/ai-refinement-prompts"
import {
  AIOS_TRAINING_KNOWLEDGE_INTEGRATION_1D_QA_MARKER,
  buildGrowthOutreachPersonalizationOrganizationKnowledgeBlock,
  outreachPersonalizationPromptContainsHardcodedEquipifyBranding,
} from "@/lib/growth/outreach/personalization/growth-outreach-personalization-organization-knowledge"
import type { OutreachPersonalizationDraft } from "@/lib/growth/outreach/personalization/personalization-types"
import {
  buildGrowthIndustryContext,
  buildIndustryContextEmailParagraphs,
  buildIndustryContextSmsDraft,
} from "@/lib/growth/playbooks/growth-industry-context"
import { normalizeIndustryPlaybookModuleLabel } from "@/lib/growth/playbooks/industry-capability-normalization"

const PHASE = "AIOS-TRAINING-KNOWLEDGE-INTEGRATION-1D" as const
const ROOT = process.cwd()

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

function buildProfile(companyName: string, products: string[], pitch: string): BusinessProfileDraftContent {
  return {
    company: {
      companyName,
      website: `https://${companyName.toLowerCase().replace(/\s+/g, "")}.example`,
      shortDescription: "Operations platform",
      productsServices: products,
      businessModel: "B2B SaaS",
      primaryValueProposition: `${companyName} unified operations`,
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
      companyWide: { mission: `${companyName} helps teams operate with clarity.`, coreValues: ["Evidence"], brandPersonality: "" },
      messaging: {
        elevatorPitch: pitch,
        tone: "Consultative",
        formality: "Professional",
        emailLengthPreference: "",
        ctaPreferences: [],
        wordsToAvoid: ["cheap", "discount"],
        neverSay: ["guaranteed ROI"],
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

function buildSterlingIndustryContext(
  organizationKnowledge?: ReturnType<typeof buildGrowthOutreachPersonalizationOrganizationKnowledgeBlock> | null,
) {
  return buildGrowthIndustryContext({
    companyName: "Sterling Biomedical",
    industryLabel: "biomedical equipment service",
    description: "Field service and biomedical support provider",
    naics: ["621999"],
    verifiedFacts: ["provides field service and biomedical support for medical equipment organizations"],
    organizationKnowledge,
  })
}

function sampleDraft(): OutreachPersonalizationDraft {
  return {
    subject: "Sterling Biomedical workflow",
    body: "Hi Jordan, many teams often struggle with PM due dates. We noticed Sterling Biomedical provides field service support.",
    wordCount: 18,
  }
}

function main(): void {
  console.log(`[${PHASE}] Outreach personalization and playbook decoupling certification`)

  const refinementSource = readSource("lib/growth/outreach/personalization/ai-refinement-prompts.ts")
  const industryContextSource = readSource("lib/growth/playbooks/growth-industry-context.ts")
  const packetBuilderSource = readSource("lib/growth/outreach/personalization/context-packet-builder.ts")

  assert.equal(
    outreachPersonalizationPromptContainsHardcodedEquipifyBranding(refinementSource),
    false,
    "refinement prompts must not contain reusable Equipify branding",
  )
  assert.equal(
    outreachPersonalizationPromptContainsHardcodedEquipifyBranding(industryContextSource),
    false,
    "industry context projection must not contain reusable Equipify branding",
  )
  assert.match(packetBuilderSource, /loadOutreachSellerTruthBundle/)
  assert.match(packetBuilderSource, /buildGrowthOutreachPersonalizationOrganizationKnowledgeBlock/)
  console.log("  ✓ active generation paths load canonical seller truth and avoid hardcoded Equipify branding")

  const equipifyProfile = buildProfile(
    "Equipify",
    ["Work orders", "Dispatch"],
    "Equipify connects dispatch and billing.",
  )
  const acmeProfile = buildProfile(
    "Acme Ops",
    ["Service routing", "Asset registry"],
    "Acme Ops unifies routing and asset history.",
  )
  const equipifyTruth = buildOutreachSellerTruth({ profile: equipifyProfile, sellerCompanyName: "Equipify" })
  const acmeTruth = buildOutreachSellerTruth({ profile: acmeProfile, sellerCompanyName: "Acme Ops" })
  const equipifyOrg = buildGrowthOutreachPersonalizationOrganizationKnowledgeBlock(equipifyTruth, equipifyProfile)
  const acmeOrg = buildGrowthOutreachPersonalizationOrganizationKnowledgeBlock(acmeTruth, acmeProfile)

  assert.equal(equipifyOrg.companyName, "Equipify")
  assert.deepEqual(equipifyOrg.productsServices, ["Work orders", "Dispatch"])
  assert.equal(equipifyOrg.primaryValueProposition, "Equipify unified operations")
  assert.equal(equipifyOrg.tone, "Consultative")
  assert.equal(equipifyOrg.formality, "Professional")
  assert.deepEqual(equipifyOrg.wordsToAvoid, ["cheap", "discount"])
  console.log("  ✓ personalization organization block projects approved Training fields")

  const equipifySystem = buildOutreachRefinementSystemPrompt(120, null, equipifyOrg)
  const acmeSystem = buildOutreachRefinementSystemPrompt(120, null, acmeOrg)
  assert.match(equipifySystem, /Equipify's Growth Engine/)
  assert.match(acmeSystem, /Acme Ops's Growth Engine/)
  assert.doesNotMatch(equipifySystem, /Equipify Growth Engine\./)
  console.log("  ✓ refinement system prompt uses dynamic organization name")

  const context = buildSterlingIndustryContext()
  const userPrompt = buildOutreachRefinementUserPrompt({
    draft: sampleDraft(),
    blocks: [],
    allowedFacts: ["provides field service and biomedical support for medical equipment organizations"],
    industryContext: context,
    organizationKnowledge: equipifyOrg,
    maxWords: 120,
  })
  assert.match(userPrompt, /"organizationKnowledge"/)
  assert.match(userPrompt, /"Equipify"/)
  assert.match(userPrompt, /"Work orders"/)
  assert.match(userPrompt, /"cheap"/)
  assert.match(userPrompt, /Capability mapping \(how the organization helps/)
  assert.doesNotMatch(userPrompt, /Equipify helps…/)
  console.log("  ✓ refinement user prompt includes approved organization knowledge and neutral capability framing")

  const acmePrompt = buildOutreachRefinementUserPrompt({
    draft: sampleDraft(),
    blocks: [],
    allowedFacts: ["provides field service and biomedical support for medical equipment organizations"],
    industryContext: buildSterlingIndustryContext(acmeOrg),
    organizationKnowledge: acmeOrg,
    maxWords: 120,
  })
  assert.match(acmePrompt, /Acme Ops/)
  assert.match(acmePrompt, /Service routing/)
  assert.doesNotMatch(acmePrompt, /"Equipify"/)
  console.log("  ✓ synthetic second organization produces different prompt context")

  const neutralContext = buildSterlingIndustryContext(null)
  const neutralParagraphs = buildIndustryContextEmailParagraphs(neutralContext, "Sterling Biomedical")
  assert.match(neutralParagraphs.industryParagraph ?? "", /often/i)
  assert.doesNotMatch(neutralParagraphs.capabilityParagraph ?? "", /Equipify/)
  assert.match(neutralParagraphs.capabilityParagraph ?? "", /Many teams centralize/)
  console.log("  ✓ industry enrichment remains without organization branding in fallback projection")

  const brandedParagraphs = buildIndustryContextEmailParagraphs(
    buildSterlingIndustryContext(equipifyOrg),
    "Sterling Biomedical",
  )
  assert.match(brandedParagraphs.capabilityParagraph ?? "", /Equipify helps teams centralize/)
  assert.match(brandedParagraphs.capabilityParagraph ?? "", /Work orders/)
  console.log("  ✓ approved Training overrides playbook capability branding")

  const smsNeutral = buildIndustryContextSmsDraft(neutralContext)
  assert.match(smsNeutral ?? "", /Teams often centralize/)
  assert.doesNotMatch(smsNeutral ?? "", /Equipify/)
  const smsBranded = buildIndustryContextSmsDraft(buildSterlingIndustryContext(equipifyOrg))
  assert.match(smsBranded ?? "", /Equipify centralizes/)
  console.log("  ✓ SMS capability lines respect organization authority precedence")

  assert.equal(normalizeIndustryPlaybookModuleLabel("Equipify Work Orders + Dispatch"), "Work Orders + Dispatch")
  assert.doesNotMatch(
    neutralContext.capabilityMappings.map((entry) => entry.industryFraming).join(" "),
    /Equipify/,
  )
  console.log("  ✓ playbook module labels normalized at projection time")

  const guardrailConfig = readSource("lib/growth/runtime-guardrails/growth-runtime-guardrail-config.ts")
  assert.match(guardrailConfig, /GROWTH_RUNTIME_DEFAULT_KILL_SWITCHES/)
  console.log("  ✓ outbound kill-switch defaults remain centralized")

  assert.equal(QA_MARKER, "aios-training-knowledge-integration-1d-v1")
  console.log(`[${PHASE}] PASS — Outreach personalization and playbook decoupling certified (local)`)
}

const QA_MARKER = AIOS_TRAINING_KNOWLEDGE_INTEGRATION_1D_QA_MARKER

main()
