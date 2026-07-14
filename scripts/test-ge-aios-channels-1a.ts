/**
 * GE-AIOS-CHANNELS-1A — Canonical channel parity certification.
 * Run: pnpm test:ge-aios-channels-1a
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  applyChannelParityConstitution,
  assertChannelParityCopy,
  CUSTOMER_FACING_CHANNEL_LABELS,
  FORBIDDEN_FOLLOW_UP_PHRASES,
  GROWTH_AIOS_CHANNELS_1A_QA_MARKER,
  materializeAllCanonicalChannelContents,
  validateFollowUpSequenceCopy,
} from "../lib/growth/aios/growth/growth-channels-1a-parity"
import {
  applyOperatorDraftEditsToPackage,
  freezeApprovedOperatorAssetsOnPackage,
} from "../lib/growth/aios/growth/growth-send-plane-1b-operator-approval-persistence"
import { materializeCanonicalOutreachChannelContent } from "../lib/growth/aios/growth/growth-send-plane-1a-materialization"
import { buildOutreachSalesStrategyBrief } from "../lib/growth/aios/growth/growth-outreach-sales-strategy-brief"
import { buildOutreachSellerTruth } from "../lib/growth/aios/growth/growth-outreach-seller-truth"
import { generateOutreachDraftsFromSalesStrategyBrief } from "../lib/growth/aios/growth/growth-outreach-strategy-drafts"
import { buildReplyCopilotAssist } from "../lib/growth/reply-intelligence/reply-copilot-service"
import { buildInboundSmsResponseSuggestions } from "../lib/growth/sms/inbound-sms-response-suggestions"
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

console.log(`[${GROWTH_AIOS_CHANNELS_1A_QA_MARKER}] Canonical channel parity certification\n`)

const paritySource = readSource("lib/growth/aios/growth/growth-channels-1a-parity.ts")
const resolverSource = readSource("lib/growth/aios/growth/growth-channels-1a-canonical-resolver.ts")
const copilotBridgeSource = readSource("lib/growth/aios/growth/growth-send-plane-1a-copilot-bridge.ts")
const materializationSource = readSource("lib/growth/aios/growth/growth-send-plane-1a-materialization.ts")
const callBriefingSource = readSource("lib/growth/call-copilot-briefing.ts")
const nativeDialerSource = readSource("lib/growth/native-dialer/native-dialer-service.ts")
const smsInboxSource = readSource("lib/growth/sms/personalization/sms-inbox-draft-service.ts")
const inboundSmsServiceSource = readSource("lib/growth/sms/inbound-sms-response-suggestion-service.ts")
const replyCopilotSource = readSource("lib/growth/reply-intelligence/reply-copilot-service.ts")
const apolloSource = readSource("lib/growth/apollo/apollo-sequence-personalization-service.ts")
const draftsSource = readSource("lib/growth/aios/growth/growth-outreach-strategy-drafts.ts")

assert.ok(paritySource.includes("materializeAllCanonicalChannelContents"))
assert.ok(resolverSource.includes("resolveCanonicalChannelContentForLead"))
assert.ok(!copilotBridgeSource.includes('channel === "call" || channel === "sendr"'))
assert.ok(materializationSource.includes("call_opening"))
assert.ok(callBriefingSource.includes("resolveCanonicalChannelContentForLead"))
assert.ok(nativeDialerSource.includes("canonicalCallGuide"))
assert.ok(smsInboxSource.includes("resolveCanonicalChannelContentForLead"))
assert.ok(inboundSmsServiceSource.includes("buildReplyCopilotAssist"))
assert.ok(inboundSmsServiceSource.includes("constitutionBoundedReply"))
assert.ok(replyCopilotSource.includes("applyChannelParityConstitution"))
assert.ok(apolloSource.includes('channel: "call"'))
assert.ok(draftsSource.includes("Personalized Video"))
assert.equal(CUSTOMER_FACING_CHANNEL_LABELS.sendr, "Personalized Video")
console.log("  ✓ Production paths wired to canonical resolver — no parallel channel engines")

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

let pkg: GrowthAutonomousOutreachApprovalPackage = {
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

const drafts = generateOutreachDraftsFromSalesStrategyBrief({ brief, senderName: "Ava" })
assert.ok(drafts.callGuide.includes("Opening:"))
assert.ok(drafts.voicemail.length > 20)
assert.ok(drafts.meetingRequest.length > 10)
assert.ok(drafts.personalizedVideo.length > 10)
assert.notEqual(drafts.meetingRequest.trim(), drafts.email.body.trim())
assert.equal(validateFollowUpSequenceCopy(drafts.followUpSequence).length, 0)
for (const phrase of FORBIDDEN_FOLLOW_UP_PHRASES) {
  assert.ok(!drafts.followUpSequence.toLowerCase().includes(phrase), `follow-up contains banned phrase: ${phrase}`)
}
console.log("  ✓ Block Imaging brief generates all canonical channel assets")

const allChannels = materializeAllCanonicalChannelContents({ brief, package: pkg, senderName: "Ava" })
const channelNames = Object.keys(allChannels) as (keyof typeof allChannels)[]
assert.equal(channelNames.length, 8)

for (const channel of channelNames) {
  const materialized = allChannels[channel]
  const parity = assertChannelParityCopy({
    body: materialized.body,
    companyName: "Block Imaging",
    channel,
  })
  assert.equal(
    materialized.transportReady,
    true,
    `${channel}: ${materialized.constitutionFailures.join(", ")} ${parity.followUpFailures.join(", ")}`,
  )
  assert.equal(parity.hasSendrReference, false, `${channel} exposes SENDR`)
  assert.ok(!materialized.body.includes("—"), `${channel} contains em dash`)
  assert.ok(!/—\s*Ava/i.test(materialized.body), `${channel} contains AI signature`)
  assert.ok(!/^Thanks,/im.test(materialized.body), `${channel} contains Thanks,`)
}
console.log("  ✓ All channels pass constitution — no em dashes, signatures, or SENDR references")

pkg = applyOperatorDraftEditsToPackage({
  pkg,
  draftEdits: {
    email: [
      "Subject: Block operator email",
      "",
      "Hi Josh, operator email body for Block Imaging.",
    ].join("\n"),
    linkedin: "Josh, operator LinkedIn for Block Imaging.",
    sms: "Josh, operator SMS for Block Imaging.",
    call: "Opening: Operator call guide for Block Imaging.\nDiscovery questions:\n1. How is depot coordination today?",
    voicemail: "Hi Josh. Operator voicemail script for Block Imaging service ops.",
    sendr: "Opening: Josh. Short note on Block Imaging depot rhythm.\nTalking points (operator):\n• Operator video script",
    follow_up: "Day 3: Operator follow-up angle on Block Imaging depot handoffs.",
    meeting_request: "Hi Josh. Open to a 15-minute workflow review when timing works?",
  },
  operatorUserId: "operator-1",
  editedAt: "2026-07-13T23:05:00.000Z",
  companyName: "Block Imaging",
})
pkg = freezeApprovedOperatorAssetsOnPackage({
  pkg,
  approvedAt: "2026-07-13T23:10:00.000Z",
})

const operatorCall = materializeCanonicalOutreachChannelContent({ brief, channel: "call", package: pkg })
const operatorVideo = materializeCanonicalOutreachChannelContent({ brief, channel: "sendr", package: pkg })
const operatorMeeting = materializeCanonicalOutreachChannelContent({ brief, channel: "meeting_request", package: pkg })
const operatorFollowUp = materializeCanonicalOutreachChannelContent({ brief, channel: "follow_up", package: pkg })

assert.ok(operatorCall.body.includes("Operator call guide"))
assert.ok(operatorVideo.body.includes("Operator video script"))
assert.ok(operatorMeeting.body.includes("workflow review"))
assert.ok(operatorFollowUp.body.includes("Operator follow-up angle"))
assert.equal(operatorCall.body, operatorCall.body.trim())
console.log("  ✓ Operator edit precedence preserved across call, video, meeting, follow-up")

const replyAssist = buildReplyCopilotAssist({
  bodyPreview: "Can you share pricing for a 3-site rollout?",
  companyName: "Block Imaging",
  contactLabel: "Josh",
})
assert.ok(replyAssist.suggestedReplyDraft.length > 10)
assert.ok(!/—\s*Ava/i.test(replyAssist.suggestedReplyDraft))
assert.ok(!/^Best,/im.test(replyAssist.suggestedReplyDraft))
console.log("  ✓ Reply copilot drafts pass channel parity constitution")

const inboundSms = buildInboundSmsResponseSuggestions({
  leadId: BLOCK,
  inboundBody: "Can we talk next week about MRI service coordination?",
  contactName: "Josh Block",
  companyName: "Block Imaging",
  packet: {
    companyName: "Block Imaging",
    contactName: "Josh Block",
    industryLabel: "Medical Imaging",
    hasWebsiteResearch: true,
    researchPainPoints: blockEvidence,
    websiteFindings: [],
    companySummary: blockEvidence[0] ?? "",
    priorReplySummaries: [],
  },
  priorSmsPreviews: [],
  constitutionBoundedReplySeed: replyAssist.suggestedReplyDraft.replace(/\n+/g, " ").slice(0, 200),
  canonicalPackagePresent: true,
})
assert.ok(inboundSms.smsReply.suggestedBody.length > 10)
assert.ok(inboundSms.contextUsed.includes("canonical_outreach_package"))
assert.ok(inboundSms.contextUsed.includes("reply_copilot_constitution"))
assert.ok(!inboundSms.smsReply.suggestedBody.includes("—"))
console.log("  ✓ Inbound SMS suggestions use reply copilot + canonical package context")

const replyBounded = applyChannelParityConstitution(
  "Hi Josh — just checking in on Block Imaging. Best,\nAva",
  "Block Imaging",
)
assert.ok(!replyBounded.body.includes("—"))
assert.ok(!/^Best,/im.test(replyBounded.body))
console.log("  ✓ Constitution strips signatures and em dashes from reply drafts")

console.log("\nGE-AIOS-CHANNELS-1A certification passed.\n")
