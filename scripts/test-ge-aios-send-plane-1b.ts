/**
 * GE-AIOS-SEND-PLANE-1B — Canonical operator approval persistence certification.
 * Run: pnpm test:ge-aios-send-plane-1b
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { projectApprovals2AOperatorReviewPacket } from "../lib/growth/aios/approvals/approvals-operator-review-packet"
import { buildOutreachSalesStrategyBrief } from "../lib/growth/aios/growth/growth-outreach-sales-strategy-brief"
import { buildOutreachSellerTruth } from "../lib/growth/aios/growth/growth-outreach-seller-truth"
import {
  generateOutreachDraftsFromSalesStrategyBrief,
  summarizeStrategyDerivedAssetsForPackage,
} from "../lib/growth/aios/growth/growth-outreach-strategy-drafts"
import { materializeCanonicalOutreachChannelContent } from "../lib/growth/aios/growth/growth-send-plane-1a-materialization"
import {
  applyOperatorDraftEditsToPackage,
  freezeApprovedOperatorAssetsOnPackage,
  GROWTH_AIOS_SEND_PLANE_1B_QA_MARKER,
  mergeOperatorAssetStateFromPreviousPackage,
  parseEmailTransportFromAssetPreview,
  resolveTransportAssetFromPackage,
} from "../lib/growth/aios/growth/growth-send-plane-1b-operator-approval-persistence"
import { buildAvaOperatorPackageDraftsApiPath } from "../lib/growth/mission-center/growth-ava-operator-workspace-contract"
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
            preferredResponse: "Fair. The question is whether handoffs still create delay.",
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

console.log(`[${GROWTH_AIOS_SEND_PLANE_1B_QA_MARKER}] Operator approval persistence certification\n`)

const persistenceSource = readSource(
  "lib/growth/aios/growth/growth-send-plane-1b-operator-approval-persistence.ts",
)
const serviceSource = readSource(
  "lib/growth/aios/growth/growth-send-plane-1b-operator-approval-persistence-service.ts",
)
const draftsRouteSource = readSource(
  "app/api/platform/growth/ai-os/autonomous-outreach-preparation-pilot/packages/[packageId]/drafts/route.ts",
)
const cardSource = readSource(
  "components/growth/ai-os/approvals/growth-ava-completed-outreach-package-card.tsx",
)
const materializationSource = readSource(
  "lib/growth/aios/growth/growth-send-plane-1a-materialization.ts",
)

assert.ok(persistenceSource.includes("approvedPreview"))
assert.ok(persistenceSource.includes("freezeApprovedOperatorAssetsOnPackage"))
assert.ok(serviceSource.includes("persistOperatorPackageDraftEdits"))
assert.ok(draftsRouteSource.includes("persistOperatorPackageDraftEdits"))
assert.ok(cardSource.includes("Save draft edits"))
assert.ok(cardSource.includes("Edited by operator"))
assert.ok(materializationSource.includes("resolveTransportAssetFromPackage"))
assert.ok(buildAvaOperatorPackageDraftsApiPath("pkg-1").includes("/drafts"))
assert.ok(!/operator_edit_table|draft_override_store/i.test(persistenceSource))
console.log("  ✓ Persistence wired into existing Growth 5F package — no parallel store")

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
  preparedAt: "2026-07-13T23:00:00.000Z",
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

const drafts = generateOutreachDraftsFromSalesStrategyBrief({ brief, senderName: "Ava" })
const generatedAssets = summarizeStrategyDerivedAssetsForPackage(drafts)

let pkg: GrowthAutonomousOutreachApprovalPackage = {
  packageId: `outreach-prep:${BLOCK}:2026-07-13T23:00:00.000Z`,
  leadId: BLOCK,
  companyName: "Block Imaging",
  preparedAt: "2026-07-13T23:00:00.000Z",
  generatedAssets,
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

const originalEmailGenerated = pkg.generatedAssets.find((a) => a.channel === "email")?.generatedPreview ?? ""
assert.ok(originalEmailGenerated.length > 40)

const operatorEmail = [
  "Subject: Block Imaging operator-approved subject",
  "Preview: Operator-owned preview line",
  "",
  "Hi Josh,",
  "",
  "Operator-owned opening line for Block Imaging service ops.",
  "",
  "When workload spikes, is dispatch usually the bottleneck?",
].join("\n")
const operatorLinkedIn = "Josh, operator LinkedIn note on depot coordination. Still relevant?"
const operatorSms = "Josh, operator SMS on Block Imaging uptime. Reply STOP to opt out."
const operatorVoicemail =
  "Hi Josh. Operator voicemail on MRI and CT service rhythm. Worth a quick reply?"

pkg = applyOperatorDraftEditsToPackage({
  pkg,
  draftEdits: {
    email: operatorEmail,
    linkedin: operatorLinkedIn,
    sms: operatorSms,
    voicemail: operatorVoicemail,
  },
  operatorUserId: "operator-1",
  editedAt: "2026-07-13T23:05:00.000Z",
  companyName: "Block Imaging",
})

const editedEmailAsset = pkg.generatedAssets.find((a) => a.channel === "email")
assert.equal(editedEmailAsset?.versionStatus, "edited")
assert.equal(editedEmailAsset?.operatorPreview, operatorEmail)
assert.ok(editedEmailAsset?.generatedPreview?.length)
assert.ok(editedEmailAsset?.preview?.includes("Operator-owned opening line"))
console.log("  ✓ Operator edits persist into package assets with generated version preserved")

const regeneratedAssets = summarizeStrategyDerivedAssetsForPackage(
  generateOutreachDraftsFromSalesStrategyBrief({ brief, senderName: "Ava" }),
)
const merged = mergeOperatorAssetStateFromPreviousPackage({
  generatedAssets: regeneratedAssets,
  previousPackage: pkg,
})
const mergedEmail = merged.find((a) => a.channel === "email")
assert.equal(mergedEmail?.operatorPreview, operatorEmail)
assert.equal(mergedEmail?.versionStatus, "edited")
console.log("  ✓ Package rebuild preserves operator-edited assets")

pkg = freezeApprovedOperatorAssetsOnPackage({
  pkg,
  approvedAt: "2026-07-13T23:10:00.000Z",
})
const approvedEmail = pkg.generatedAssets.find((a) => a.channel === "email")
assert.equal(approvedEmail?.versionStatus, "approved")
assert.equal(approvedEmail?.approvedPreview, operatorEmail)
console.log("  ✓ Approval freezes operator edits as canonical approved version")

const emailTransport = materializeCanonicalOutreachChannelContent({
  brief,
  channel: "email",
  package: pkg,
})
const linkedInTransport = materializeCanonicalOutreachChannelContent({
  brief,
  channel: "linkedin",
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

assert.equal(emailTransport.transportReady, true)
assert.ok(emailTransport.body.includes("Operator-owned opening line"))
assert.ok(!emailTransport.body.includes("runOutreachPersonalization"))
const parsedApproved = parseEmailTransportFromAssetPreview(operatorEmail)
assert.equal(emailTransport.body.trim(), parsedApproved.body.trim())
assert.equal(linkedInTransport.body, operatorLinkedIn)
assert.equal(smsTransport.body, operatorSms)
assert.equal(vmTransport.body, operatorVoicemail)

const briefOnlyTransport = materializeCanonicalOutreachChannelContent({
  brief,
  channel: "email",
  package: {
    ...pkg,
    generatedAssets: pkg.generatedAssets.map((asset) =>
      asset.channel === "email"
        ? {
            ...asset,
            preview: operatorEmail,
            approvedPreview: operatorEmail,
            versionStatus: "approved" as const,
          }
        : asset,
    ),
  },
})
assert.equal(briefOnlyTransport.body.trim(), parsedApproved.body.trim())
console.log("  ✓ Transport uses approved operator asset — no brief regeneration")

const resolved = resolveTransportAssetFromPackage(pkg, "email", "Block Imaging")
assert.equal(resolved?.source, "approved_operator")
assert.equal(resolved?.versionStatus, "approved")
console.log("  ✓ Transport precedence: approved operator > generated asset")

const packet = projectApprovals2AOperatorReviewPacket({ pkg, teammateName: "Ava" })
const emailDraft = packet.drafts.find((d) => d.channel === "email")
assert.equal(emailDraft?.versionStatus, "approved")
assert.equal(emailDraft?.preview, operatorEmail)
assert.ok(emailDraft?.editedByOperator)
console.log("  ✓ Operator review packet surfaces Generated / Edited / Approved state")

const emDashEdit = applyOperatorDraftEditsToPackage({
  pkg: {
    ...pkg,
    packageApprovalDecision: undefined,
    generatedAssets: pkg.generatedAssets.map((asset) =>
      asset.channel === "linkedin"
        ? { ...asset, versionStatus: "generated", approvedPreview: null, operatorPreview: null }
        : asset,
    ),
  },
  draftEdits: { linkedin: "Something I kept coming back to at Block Imaging." },
  operatorUserId: "operator-1",
  editedAt: "2026-07-13T23:06:00.000Z",
  companyName: "Block Imaging",
})
const warned = emDashEdit.generatedAssets.find((a) => a.channel === "linkedin")
assert.ok((warned?.constitutionWarnings?.length ?? 0) > 0)
console.log("  ✓ Constitution warns on operator edits without rewriting")

console.log("\nGE-AIOS-SEND-PLANE-1B certification passed.")
