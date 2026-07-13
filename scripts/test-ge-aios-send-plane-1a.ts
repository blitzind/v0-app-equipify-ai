/**
 * GE-AIOS-SEND-PLANE-1A — Canonical draft materialization certification.
 * Run: pnpm test:ge-aios-send-plane-1a
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_AIOS_SEND_PLANE_1A_QA_MARKER,
  finalizeProductionCustomerFacingCopy,
  reviewProductionHumanCommunicationConstitution,
  stripAiGeneratedSignatureContent,
} from "../lib/growth/aios/growth/growth-send-plane-1a-constitution"
import {
  materializeCanonicalOutreachChannelContent,
  materializeCanonicalOutreachDrafts,
} from "../lib/growth/aios/growth/growth-send-plane-1a-materialization"
import { buildOutreachSalesStrategyBrief } from "../lib/growth/aios/growth/growth-outreach-sales-strategy-brief"
import { buildOutreachSellerTruth } from "../lib/growth/aios/growth/growth-outreach-seller-truth"
import { EQUIPIFY_CANONICAL_SELLER_KNOWLEDGE } from "../lib/growth/business-profile/equipify-master-knowledge-canonical"
import type { BusinessProfileDraftContent } from "../lib/growth/business-profile/business-profile-types"
import type { GrowthAutonomousOutreachApprovalPackage } from "../lib/growth/aios/growth/growth-autonomous-outreach-preparation-pilot-types"

const ROOT = process.cwd()
const BLOCK = "6d9220f0-2960-468c-b4be-5d7595d292c3"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
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

console.log(`[${GROWTH_AIOS_SEND_PLANE_1A_QA_MARKER}] Send plane certification\n`)

const constitutionSource = readSource("lib/growth/aios/growth/growth-send-plane-1a-constitution.ts")
const materializationSource = readSource("lib/growth/aios/growth/growth-send-plane-1a-materialization.ts")
const copilotSource = readSource("lib/growth/aios/growth/growth-send-plane-1a-copilot-bridge.ts")
const runCopilotSource = readSource("lib/growth/run-ai-copilot-generation.ts")
const smsBuilderSource = readSource("lib/growth/sequences/execution/sequence-sms-send-builder.ts")
const apolloSource = readSource("lib/growth/apollo/apollo-sequence-personalization-service.ts")
const draftsSource = readSource("lib/growth/aios/growth/growth-outreach-strategy-drafts.ts")
const signatureRuntimeSource = readSource("lib/growth/signatures/outbound-signature-runtime.ts")

assert.ok(constitutionSource.includes("reviewProductionHumanCommunicationConstitution"))
assert.ok(materializationSource.includes("materializeCanonicalOutreachChannelContent"))
assert.ok(copilotSource.includes("tryMaterializeCanonicalCopilotGeneration"))
assert.ok(runCopilotSource.includes("tryMaterializeCanonicalCopilotGeneration"))
assert.ok(smsBuilderSource.includes("resolveCanonicalOutreachPackageForLead"))
assert.ok(apolloSource.includes("resolveCanonicalOutreachPackageForLead"))
assert.ok(apolloSource.includes('channel: "voicemail"'))
assert.ok(draftsSource.includes("voicemail"))
assert.ok(draftsSource.includes("meetingRequest"))
assert.ok(!/createTable|new personalization engine/i.test(materializationSource))
assert.ok(signatureRuntimeSource.includes("appendSignatureToOutboundBody"))
console.log("  ✓ Canonical send plane wired — no duplicate engines")

assert.equal(
  reviewProductionHumanCommunicationConstitution("Something I kept coming back to at Block Imaging.", "Block Imaging").length,
  1,
)
assert.equal(
  reviewProductionHumanCommunicationConstitution("Hope this finds you well.", "Block Imaging").length,
  1,
)
assert.equal(
  reviewProductionHumanCommunicationConstitution("A game-changing platform.", "Block Imaging").length,
  1,
)
assert.ok(!finalizeProductionCustomerFacingCopy("Hi — quick note.").includes("—"))
console.log("  ✓ Production constitution rejects AI phrasing, marketing, em dashes")

const stripped = stripAiGeneratedSignatureContent("Hi Josh,\n\nBody here.\n\n— Ava\n\nThanks,")
assert.ok(!/—\s*Ava/i.test(stripped))
assert.ok(!/^Thanks,/im.test(stripped))
console.log("  ✓ Signature content stripped from AI body")

const profile = sampleProfile()
const sellerTruth = buildOutreachSellerTruth({
  profile,
  profileId: "profile-1",
  prospectTitle: "President",
  prospectIndustry: "Medical Imaging",
})

const brief = buildOutreachSalesStrategyBrief({
  leadId: BLOCK,
  companyName: "Block Imaging",
  preparedAt: "2026-07-13T22:00:00.000Z",
  website: "https://blockimaging.com",
  contactName: "Josh Block",
  contactTitle: "President",
  equipmentServiced: ["MRI", "CT"],
  verifiedEvidence: blockEvidence,
  sellerTruth,
  approvedProfile: profile,
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

const pkg: GrowthAutonomousOutreachApprovalPackage = {
  packageId: `outreach-prep:${BLOCK}:2026-07-13T22:00:00.000Z`,
  leadId: BLOCK,
  companyName: "Block Imaging",
  preparedAt: "2026-07-13T22:00:00.000Z",
  generatedAssets: [],
  salesStrategyBrief: brief,
  draftQuality: { emailWordCount: 0, emailReadTimeSeconds: 0, smsCharacterCount: 0, qualityFailures: [] },
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

const drafts = materializeCanonicalOutreachDrafts({ brief, senderName: "Ava" })
assert.ok(drafts.voicemail.length > 20)
assert.ok(drafts.meetingRequest.length > 10)
assert.ok(!drafts.email.body.includes("—"))
assert.ok(!/—\s*Ava/i.test(drafts.email.body))
assert.ok(!/^Thanks,/im.test(drafts.email.body))
assert.ok(!/^Best,/im.test(drafts.email.body))
console.log("  ✓ Block Imaging drafts — no em dashes or AI signatures in body")

const emailTransport = materializeCanonicalOutreachChannelContent({
  brief,
  channel: "email",
  package: pkg,
})
const smsTransport = materializeCanonicalOutreachChannelContent({
  brief,
  channel: "sms",
  package: pkg,
})
const vmTransport = materializeCanonicalOutreachChannelContent({
  brief,
  channel: "voicemail",
  package: pkg,
})

assert.equal(emailTransport.transportReady, true, emailTransport.constitutionFailures.join(", "))
assert.equal(smsTransport.transportReady, true, smsTransport.constitutionFailures.join(", "))
assert.equal(vmTransport.transportReady, true, vmTransport.constitutionFailures.join(", "))
assert.ok(emailTransport.subject)
assert.ok(!emailTransport.body.includes("—"))
assert.ok(!emailTransport.body.includes("runOutreachPersonalization"))
console.log("  ✓ Transport materialization passes constitution for email/SMS/voicemail")

const operatorPreview = drafts.email.full
const persistedBody = emailTransport.body
assert.ok(operatorPreview.includes(persistedBody.slice(0, 40)))
console.log("  ✓ Operator preview aligns with transport body")

console.log("\nGE-AIOS-SEND-PLANE-1A certification passed.")
