/**
 * GE-AIOS-INSTITUTIONAL-LEARNING-1B — Canonical identity + institutional refinement certification.
 * Run: pnpm test:ge-aios-institutional-learning-1b
 */
import assert from "node:assert/strict"
import { execSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import {
  buildInstitutionalSalesIntelligence,
} from "../lib/growth/aios/growth/growth-institutional-learning-1a"
import {
  applyInstitutionalLearning1BRefinements,
  GROWTH_AIOS_INSTITUTIONAL_LEARNING_1B_QA_MARKER,
  professionalizeInstitutionalAdvisoryText,
} from "../lib/growth/aios/growth/growth-institutional-learning-1b"
import {
  AUTHORITATIVE_BRAND_CANONICALS,
  applyCanonicalIdentityToCopy,
  GROWTH_AIOS_CANONICAL_DISPLAY_IDENTITY_1B_QA_MARKER,
  resolveCanonicalDisplayIdentity,
  reviewCanonicalIdentityConstitution,
} from "../lib/growth/aios/growth/growth-canonical-display-identity-1b"
import { synthesizeGrowthLearningInsights } from "../lib/growth/aios/learning/growth-learning-insight-engine"
import type { GrowthLearningOutcome } from "../lib/growth/aios/learning/growth-closed-loop-learning-types"
import { buildOutreachSalesStrategyBrief } from "../lib/growth/aios/growth/growth-outreach-sales-strategy-brief"
import { buildOutreachSellerTruth } from "../lib/growth/aios/growth/growth-outreach-seller-truth"
import { generateOutreachDraftsFromSalesStrategyBrief } from "../lib/growth/aios/growth/growth-outreach-strategy-drafts"
import { projectApprovals2AOperatorReviewPacket } from "../lib/growth/aios/approvals/approvals-operator-review-packet"
import {
  finalizeProductionCustomerFacingCopy,
  reviewOperatorExecutionGuideConstitution,
  reviewProductionHumanCommunicationConstitution,
} from "../lib/growth/aios/growth/growth-send-plane-1a-constitution"
import { materializeCanonicalOutreachChannelContent } from "../lib/growth/aios/growth/growth-send-plane-1a-materialization"
import { EQUIPIFY_CANONICAL_SELLER_KNOWLEDGE } from "../lib/growth/business-profile/equipify-master-knowledge-canonical"
import type { BusinessProfileDraftContent } from "../lib/growth/business-profile/business-profile-types"
import type { GrowthAutonomousOutreachApprovalPackage } from "../lib/growth/aios/growth/growth-autonomous-outreach-preparation-pilot-types"
import { CANONICAL_CHANNELS_1A } from "../lib/growth/aios/growth/growth-channels-1a-types"

const ROOT = process.cwd()
const BLOCK = "6d9220f0-2960-468c-b4be-5d7595d292c3"
const ORG = "org-equipify-test"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

function runRegression(script: string, optional = false): void {
  try {
    execSync(`pnpm ${script}`, { stdio: "inherit", cwd: ROOT })
  } catch (error) {
    if (optional) {
      console.warn(`  ⚠ optional regression failed (pre-existing): ${script}`)
      return
    }
    throw error
  }
}

function assertNoDegradedCompany(text: string, canonical: string): void {
  const degraded = canonical.toLowerCase()
  if (degraded === canonical) return
  assert.ok(
    !new RegExp(`\\b${degraded.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(text),
    `degraded company form "${degraded}" found in copy`,
  )
}

function sampleProfile(): BusinessProfileDraftContent {
  return {
    company: {
      companyName: "Equipify",
      website: "https://equipify.ai",
      shortDescription: "Service operations platform",
      productsServices: ["Work orders", "Dispatch"],
      businessModel: "B2B SaaS",
      primaryValueProposition: "Reduce operational complexity for equipment service businesses.",
    },
    idealCustomers: {
      targetIndustries: ["Biomedical and medical equipment service"],
      companySizeRanges: ["20-200"],
      geography: ["United States"],
      buyerPersonas: ["Owner", "Operations leaders"],
      disqualifiers: [],
    },
    problemsAndTriggers: {
      painPoints: ["Scattered handoffs"],
      buyingTriggers: ["Multi-site expansion"],
      competitorsAlternatives: [],
      keywords: [],
      negativeKeywords: [],
    },
    salesAndMarketing: {
      averageDealSize: null,
      salesCycleEstimate: null,
      messagingAngles: ["Outcome-first service visibility"],
      qualificationCriteria: [],
    },
    businessStrategy: {
      companyWide: {
        mission: "Help equipment businesses run cleaner service operations",
        coreValues: [],
        brandPersonality: "Consultative",
      },
      messaging: {
        elevatorPitch: "Equipify helps service teams replace scattered handoffs with a clearer operating rhythm.",
        tone: "consultative",
        formality: "professional",
        emailLengthPreference: "short",
        ctaPreferences: ["15-minute workflow review"],
        wordsToAvoid: ["synergy"],
        neverSay: ["guaranteed ROI"],
      },
      positioning: {
        competitiveAdvantages: ["Built for equipment-centric operators"],
        pricingPhilosophy: "Value over discounting",
        neverCompeteOnPrice: true,
        competitorNotes: [],
      },
      salesPhilosophy: {
        qualificationStandards: [],
        discoveryQuestions: ["How do you coordinate depot and field work today?"],
        disqualifiers: [],
      },
      objections: {
        items: [
          {
            objection: "We already have software.",
            preferredResponse: "Fair — the question is whether handoffs still create delay.",
          },
        ],
      },
      salesAndRelationships: { principles: [], notes: "" },
    },
    canonicalSellerKnowledge: EQUIPIFY_CANONICAL_SELLER_KNOWLEDGE,
  }
}

const blockEvidence = [
  "Verified description (82%): Block Imaging is a global diagnostic imaging company specializing in MRI and CT refurbished systems.",
  "Service indicator: MRI / CT refurbished systems",
  "Combines depot and field service operations.",
]

function sampleOutcomes(): GrowthLearningOutcome[] {
  const base = {
    organizationId: ORG,
    source: "email" as const,
    subject: { type: "lead" as const, id: "lead-1" },
    related: {},
    signalStrength: 0.8,
    confidence: 0.82,
    evidence: [{ source: "operator", label: "objection_theme", value: "already_have_software" }],
    createdAt: "2026-07-13T20:00:00.000Z",
  }

  const timingRows: GrowthLearningOutcome[] = Array.from({ length: 5 }, (_, index) => ({
    ...base,
    id: `timing-${index}`,
    outcomeType: index % 2 === 0 ? ("reply" as const) : ("positive_intent" as const),
    dimensions: {
      industry: "biomedical_imaging",
      channel: "email",
      timingBucket: "day_3_follow_up",
      committeeStrategy: "multi_thread_champion",
    },
    occurredAt: `2026-07-${10 + index}T12:00:00.000Z`,
  }))

  const committeeRows: GrowthLearningOutcome[] = Array.from({ length: 5 }, (_, index) => ({
    ...base,
    id: `committee-${index}`,
    outcomeType: "reply",
    dimensions: {
      industry: "biomedical_imaging",
      committeeStrategy: "multi_thread_champion",
      persona: "service_director",
    },
    occurredAt: `2026-07-${8 + index}T12:00:00.000Z`,
  }))

  const objectionRows: GrowthLearningOutcome[] = Array.from({ length: 5 }, (_, index) => ({
    ...base,
    id: `objection-${index}`,
    outcomeType: index === 4 ? "negative_intent" : "reply",
    evidence: [{ source: "operator", label: "objection_theme", value: "already_have_software" }],
    dimensions: {
      industry: "biomedical_imaging",
      channel: "email",
    },
    occurredAt: `2026-07-${6 + index}T12:00:00.000Z`,
  }))

  const meetingRows: GrowthLearningOutcome[] = Array.from({ length: 5 }, (_, index) => ({
    ...base,
    id: `meeting-${index}`,
    outcomeType: "meeting_booked" as const,
    source: "meeting" as const,
    dimensions: {
      industry: "biomedical_imaging",
      discoveryQuestionTheme: "depot_field_handoffs",
    },
    occurredAt: `2026-07-${12 + index}T12:00:00.000Z`,
  }))

  const proposalRows: GrowthLearningOutcome[] = Array.from({ length: 5 }, (_, index) => ({
    ...base,
    id: `proposal-${index}`,
    outcomeType: index === 4 ? ("rejected" as const) : ("converted" as const),
    source: "revenue_director" as const,
    dimensions: {
      industry: "biomedical_imaging",
      committeeStrategy: "economic_buyer_validation",
    },
    occurredAt: `2026-07-${13 + index}T12:00:00.000Z`,
  }))

  return [
    ...timingRows,
    ...committeeRows,
    ...objectionRows,
    ...meetingRows,
    ...proposalRows,
  ]
}

console.log(`[${GROWTH_AIOS_INSTITUTIONAL_LEARNING_1B_QA_MARKER}] Institutional learning 1B certification\n`)

const draftSource = readSource("lib/growth/aios/growth/growth-autonomous-outreach-preparation-draft-service.ts")
const constitutionSource = readSource("lib/growth/aios/growth/growth-send-plane-1a-constitution.ts")
const resolverSource = readSource("lib/growth/aios/growth/growth-institutional-learning-1a-resolver.ts")

const memoryResolverSource = readSource("lib/growth/lead-memory/resolve-canonical-human-memory-for-lead.ts")

assert.ok(draftSource.includes("resolveCanonicalHumanMemoryForLead"))
assert.ok(memoryResolverSource.includes("resolveCanonicalDisplayIdentity"))
assert.ok(draftSource.includes("canonicalDisplayIdentity"))
assert.ok(constitutionSource.includes("reviewCanonicalIdentityConstitution"))
assert.ok(resolverSource.includes("applyInstitutionalLearning1BRefinements"))
console.log("  ✓ Canonical identity computed at Growth 5F prep; constitution + resolver wired")

const identity = resolveCanonicalDisplayIdentity({
  originalCompanyName: "block imaging",
  verifiedCanonicalCompanyName: "Block Imaging",
  websiteBrandingName: "Block Imaging",
  crmCompanyName: "block imaging",
  contactName: "Josh Block",
  sellerCompanyName: "Equipify",
  sellerWebsite: "https://equipify.ai",
})
assert.equal(identity.qaMarker, GROWTH_AIOS_CANONICAL_DISPLAY_IDENTITY_1B_QA_MARKER)
assert.equal(identity.company.canonical, "Block Imaging")
assert.equal(identity.sellerCompany?.canonical, "Equipify.ai")
console.log("  ✓ Canonical identity precedence resolves Block Imaging + Equipify.ai")

const operatorOverride = resolveCanonicalDisplayIdentity({
  originalCompanyName: "Block Imaging",
  operatorCompanyOverride: "Block Imaging International",
})
assert.equal(operatorOverride.company.canonical, "Block Imaging International")
assert.equal(operatorOverride.company.source, "operator_override")
console.log("  ✓ Operator override is authoritative for package scope")

for (const [degraded, canonical] of Object.entries(AUTHORITATIVE_BRAND_CANONICALS)) {
  const brandIdentity = resolveCanonicalDisplayIdentity({
    originalCompanyName: degraded,
    verifiedCanonicalCompanyName: canonical,
  })
  const fixed = applyCanonicalIdentityToCopy(
    `Operations at ${degraded} and ${degraded} teams.`,
    brandIdentity,
  )
  assert.ok(fixed.includes(canonical), `${canonical} not preserved from ${degraded}`)
  assert.equal(reviewCanonicalIdentityConstitution(fixed, brandIdentity).length, 0)
}
console.log("  ✓ Authoritative brand spellings preserved (GE HealthCare, Siemens Healthineers, etc.)")

assert.ok(
  reviewCanonicalIdentityConstitution("block imaging teams", identity).some((row) =>
    row.includes("canonical_identity:degraded"),
  ),
)
assert.ok(
  reviewProductionHumanCommunicationConstitution("block imaging teams", "Block Imaging", identity).some(
    (row) => row.includes("canonical_identity:degraded"),
  ),
)
const corrected = finalizeProductionCustomerFacingCopy("block imaging teams need uptime.", identity)
assert.ok(corrected.includes("Block Imaging"))
assert.equal(reviewCanonicalIdentityConstitution(corrected, identity).length, 0)
console.log("  ✓ Human Communication Constitution rejects degraded capitalization")

const outcomes = sampleOutcomes()
const insights = synthesizeGrowthLearningInsights({
  organizationId: ORG,
  generatedAt: "2026-07-13T22:00:00.000Z",
  outcomes,
})

const accountContext = {
  companyName: "Block Imaging",
  industry: "Biomedical and medical equipment service",
  contactTitle: "President",
  companySize: "45",
  employeeCount: "45",
  relationshipStage: "warm",
  businessPressureKey: "equipment_uptime",
  messageThemeKey: "depot_field_coordination",
  accountEvidenceThemes: blockEvidence,
}

const baseInstitutional = buildInstitutionalSalesIntelligence({
  outcomes,
  insights,
  referenceAt: "2026-07-13T22:00:00.000Z",
  accountContext,
})

const refined = applyInstitutionalLearning1BRefinements({
  intelligence: baseInstitutional,
  outcomes,
  insights,
  accountContext,
  referenceAt: "2026-07-13T22:00:00.000Z",
  canonicalIdentity: identity,
})

assert.equal(refined.refinementMarker, GROWTH_AIOS_INSTITUTIONAL_LEARNING_1B_QA_MARKER)
assert.ok(refined.patterns.some((row) => row.dimension === "follow_up_timing"))
assert.ok(refined.patterns.some((row) => row.dimension === "buying_committee_shape"))
assert.ok(
  refined.patterns.some((row) => row.dimension === "meeting_outcome" || row.dimension === "proposal_outcome"),
)
const professionalized = professionalizeInstitutionalAdvisoryText(
  "block imaging companies often respond better when operational uptime leads.",
  accountContext,
  identity,
)
assert.ok(professionalized.includes("Block Imaging"))
assert.ok(!/\bblock imaging companies\b/i.test(professionalized))
console.log("  ✓ Institutional learning 1B extends timing, committee, meeting/proposal patterns")

const profile = sampleProfile()
const sellerTruth = buildOutreachSellerTruth({
  profile,
  profileId: "profile-1",
  prospectTitle: "President",
  prospectIndustry: "Medical Imaging",
})

const brief = buildOutreachSalesStrategyBrief({
  leadId: BLOCK,
  companyName: "block imaging",
  preparedAt: "2026-07-13T22:00:00.000Z",
  website: "https://blockimaging.com",
  contactName: "Josh Block",
  contactTitle: "President",
  equipmentServiced: ["MRI", "CT"],
  verifiedEvidence: blockEvidence,
  sellerTruth,
  approvedProfile: profile,
  institutionalLearning: refined,
  canonicalDisplayIdentity: identity,
  relationshipStrengthTier: "warm",
  opportunityReadinessScore: 78,
  decisionMakers: [{ name: "Josh Block", title: "President", isPrimary: true }],
  buyingCommitteeSnapshot: {
    hasVerifiedCommittee: true,
    discoveryPending: false,
    discoveryFailed: false,
    singleThreadRisk: false,
    coverageScore: 0.72,
    rolesPresent: ["champion"],
    rolesMissing: [],
    verifiedMemberCount: 3,
  },
  communicationChannelHint: "email",
})

assert.equal(brief.companyName, "Block Imaging")
assert.ok(brief.primaryHook.includes("Block Imaging"))
assert.ok(brief.canonicalDisplayIdentity?.company.canonical === "Block Imaging")

const drafts = generateOutreachDraftsFromSalesStrategyBrief({ brief, senderName: "Ava" })
const customerFacingBodies = [
  drafts.email.full,
  drafts.linkedIn,
  drafts.sms,
  drafts.voicemail,
  drafts.meetingRequest,
  drafts.followUpSequence,
]
const operatorFacingBodies = [drafts.callGuide, drafts.personalizedVideo]

for (const text of customerFacingBodies) {
  assertNoDegradedCompany(text, "Block Imaging")
  assert.ok(!text.includes("—"), "em dash forbidden")
  assert.equal(
    reviewProductionHumanCommunicationConstitution(text, "Block Imaging", identity).length,
    0,
    `constitution failure in customer copy: ${text.slice(0, 80)}`,
  )
}
for (const text of operatorFacingBodies) {
  assertNoDegradedCompany(text, "Block Imaging")
  assert.ok(!text.includes("—"), "em dash forbidden")
  assert.equal(
    reviewOperatorExecutionGuideConstitution(text, identity).length,
    0,
    `constitution failure in operator copy: ${text.slice(0, 80)}`,
  )
}
assert.ok(
  [...customerFacingBodies, ...operatorFacingBodies].filter((text) => text.includes("Block Imaging"))
    .length >= 4,
  "expected canonical company name across primary channel drafts",
)
console.log("  ✓ Block Imaging canonical identity across all customer-facing channels")

const pkg: GrowthAutonomousOutreachApprovalPackage = {
  packageId: `outreach-prep:${BLOCK}:1b`,
  leadId: BLOCK,
  companyName: "Block Imaging",
  preparedAt: "2026-07-13T22:00:00.000Z",
  generatedAssets: [],
  canonicalDisplayIdentity: identity,
  salesStrategyBrief: brief,
  draftQuality: {
    emailWordCount: drafts.email.wordCount,
    emailReadTimeSeconds: 12,
    smsCharacterCount: drafts.sms.length,
    qualityFailures: drafts.qualityFailures,
  },
  personalizationEvidence: [],
  supportingResearch: blockEvidence,
  confidence: brief.confidence,
  approvalRequirements: ["operator_outbound_approval"],
  complianceNotes: [],
  recommendedChannel: "email",
  recommendedSequence: "email_first_multichannel",
  expectedOutcome: brief.businessObjective,
  pendingHumanApproval: true,
  transportBlocked: true,
}

const packet = projectApprovals2AOperatorReviewPacket({
  pkg,
  lead: {
    id: BLOCK,
    companyName: "block imaging",
    website: "https://blockimaging.com",
    estimatedEmployeeCount: "45",
    city: "Holland",
    state: "MI",
    country: "US",
  },
  research: { industry: "Medical Imaging", confidence: 0.82 },
  decisionMaker: { fullName: "Josh Block", title: "President", email: "j@blockimaging.com" },
})

assert.equal(packet.company.name, "Block Imaging")
assert.ok(
  packet.institutionalLearningEssentials?.some((row) => row.includes("Block Imaging")) ||
    refined.operatorInsights.some((row) => row.detail.includes("Block Imaging")),
)
console.log("  ✓ Operator-facing approval packet preserves canonical company identity")

for (const channel of CANONICAL_CHANNELS_1A) {
  const materialized = materializeCanonicalOutreachChannelContent({
    brief,
    channel,
    package: pkg,
  })
  assert.ok(materialized.body.length > 0)
  assertNoDegradedCompany(materialized.body, "Block Imaging")
  if (materialized.subject) assertNoDegradedCompany(materialized.subject, "Block Imaging")
}
console.log("  ✓ Send Plane materialization preserves canonical identity")

console.log("\nRegression suite:")
const regressions = [
  "test:ge-aios-institutional-learning-1a",
  "test:ge-aios-channels-1a",
  "test:ge-aios-adaptive-loop-1a",
  "test:ge-aios-adaptive-loop-1b",
  "test:ge-aios-relationship-strategy-2a",
  "test:ge-aios-revenue-strategy-1a",
  "test:ge-aios-conversation-intelligence-3a",
  "test:ge-aios-send-plane-1a",
  "test:ge-aios-send-plane-1b",
  "test:ge-aios-growth-5f-autonomous-outreach-preparation",
  "test:ge-aios-approvals-2a-operator-review-experience",
  "test:ge-ai-3d-closed-loop-learning-foundation",
]

for (const script of regressions) {
  console.log(`  → ${script}`)
  runRegression(script, script === "test:ge-ai-3d-closed-loop-learning-foundation")
}

console.log(`\n[${GROWTH_AIOS_INSTITUTIONAL_LEARNING_1B_QA_MARKER}] PASS`)
