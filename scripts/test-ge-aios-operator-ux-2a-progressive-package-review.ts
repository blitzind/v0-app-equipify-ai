/**
 * GE-AIOS-OPERATOR-UX-2A — Progressive package review certification.
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  projectApprovals2AOperatorReviewPacket,
  type Approvals2AOperatorReviewPacket,
} from "../lib/growth/aios/approvals/approvals-operator-review-packet"
import { buildOutreachSalesStrategyBrief } from "../lib/growth/aios/growth/growth-outreach-sales-strategy-brief"
import { summarizeStrategyDerivedAssetsForPackage, generateOutreachDraftsFromSalesStrategyBrief } from "../lib/growth/aios/growth/growth-outreach-strategy-drafts"
import { buildLive1bEquipifyCompanyProfileContent } from "../lib/growth/live-operations/ge-aios-live-1b-equipify-company-profile-content"
import {
  formatOperatorConfidenceLabel,
  GROWTH_OPERATOR_PACKAGE_PROGRESSIVE_REVIEW_2A_QA_MARKER,
  projectOperatorPackageChannelReadiness,
  projectOperatorPackageDecisionSummary,
  resolveOperatorOpportunitySummary,
  sanitizeOperatorReviewCopy,
} from "../lib/growth/workspace/ux-2a/review/growth-operator-package-progressive-review-2a"
import { resolvePackageAuthorizationReadiness } from "../lib/growth/workspace/ux-1a/review/growth-operator-package-review-copy-1a"
import type { GrowthAutonomousOutreachApprovalPackage } from "../lib/growth/aios/growth/growth-autonomous-outreach-preparation-pilot-types"

import { evaluateAvaOutreachPackageReadiness } from "../lib/growth/mission-center/growth-ava-outreach-sequence-handoff-1f"

const ROOT = process.cwd()

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

function strongFixturePackage(): GrowthAutonomousOutreachApprovalPackage {
  const profile = buildLive1bEquipifyCompanyProfileContent()
  const brief = buildOutreachSalesStrategyBrief({
    leadId: "lead-1",
    companyName: "Block Imaging",
    preparedAt: "2026-07-19T12:00:00.000Z",
    website: "https://blockimaging.com",
    contactName: "Jordan Lee",
    contactTitle: "Director of Operations",
    contactEmail: "jordan@blockimaging.com",
    industry: "Medical equipment service",
    employees: "200-500",
    equipmentServiced: ["MRI", "CT"],
    verifiedEvidence: ["Depot-to-field coordination described on careers page"],
    approvedProfile: profile,
    sellerCompanyName: "Equipify",
    fitReason: "Medical equipment field service operator.",
    opportunitySummary: "Dispatch-to-cash friction across field teams.",
    researchConfidence: 0.78,
    qualificationConfidence: 0.72,
  })
  const drafts = generateOutreachDraftsFromSalesStrategyBrief({ brief, senderName: "Ava" })
  const assets = summarizeStrategyDerivedAssetsForPackage(drafts)
  return {
    packageId: "outreach-prep:lead-1:2026",
    leadId: "lead-1",
    organizationId: "org-1",
    companyName: "Block Imaging",
    preparedAt: "2026-07-19T12:00:00.000Z",
    pendingHumanApproval: true,
    packageApprovalDecision: null,
    confidence: brief.confidence,
    expectedOutcome: "Book first meeting",
    supportingResearch: brief.evidence.map((row) => row.detail),
    personalizationEvidence: brief.personalizationSignals ?? [],
    approvalRequirements: ["Operator review before send"],
    salesStrategyBrief: brief,
    generatedAssets: assets,
    recommendedChannel: "email",
    recommendedSequence: "consultative_discovery",
  } as GrowthAutonomousOutreachApprovalPackage
}

function basePackage(overrides?: Partial<GrowthAutonomousOutreachApprovalPackage>): GrowthAutonomousOutreachApprovalPackage {
  return {
    ...strongFixturePackage(),
    ...overrides,
  }
}

function packetFromPackage(
  pkg: GrowthAutonomousOutreachApprovalPackage,
  lead?: Parameters<typeof projectApprovals2AOperatorReviewPacket>[0]["lead"],
  decisionMaker?: Parameters<typeof projectApprovals2AOperatorReviewPacket>[0]["decisionMaker"],
): Approvals2AOperatorReviewPacket {
  return projectApprovals2AOperatorReviewPacket({
    pkg,
    teammateName: "Ava",
    lead: lead ?? {
      companyName: "Block Imaging",
      website: "https://blockimaging.com",
      contactName: "Jordan Lee",
      contactEmail: "jordan@blockimaging.com",
      contactPhone: null,
      fieldServiceStackDetected: "MRI / CT service",
    },
    decisionMaker: decisionMaker ?? {
      fullName: "Jordan Lee",
      title: "Director of Operations",
      email: "jordan@blockimaging.com",
      phone: null,
      linkedinUrl: "https://linkedin.com/in/jordan-lee",
      confidence: 0.72,
      verificationStatus: "verified_email",
    },
    research: {
      industry: "Medical imaging services",
      equipmentServiced: ["MRI", "CT"],
      missingEvidence: [],
      potentialRisks: [],
      assumptions: [],
      opportunitySummary: "Strong service footprint",
      confidence: 0.78,
    },
  })
}

console.log("[ge-aios-operator-ux-2a-progressive-package-review-v1] UX-2A certification")

const cardSource = readSource("components/growth/ai-os/approvals/growth-ava-completed-outreach-package-card.tsx")
const layoutSource = readSource("components/growth/ai-os/approvals/growth-ava-package-progressive-review-layout.tsx")
const moduleSource = readSource("lib/growth/workspace/ux-2a/review/growth-operator-package-progressive-review-2a.ts")

assert.match(cardSource, /GrowthAvaPackageProgressiveReviewLayout/)
assert.match(cardSource, /projectOperatorPackageDecisionSummary/)
assert.match(layoutSource, /60-second decision summary/)
assert.match(layoutSource, /View supporting research/)
assert.match(layoutSource, /Advanced details/)
assert.match(layoutSource, /defaultOpen=\{false\}/)
assert.doesNotMatch(cardSource, /Section title="Risk panel"/)
assert.doesNotMatch(cardSource, /variant="outline"[\s\S]{0,120}Archive lead/)
assert.match(cardSource, /DropdownMenuItem onClick=\{\(\) => void runLifecycle\("archive_account"\)\}/)
assert.match(cardSource, /Pause autonomy/)
console.log("  ✓ package card uses progressive layout with collapsed Level 2/3 sections")

assert.equal(
  sanitizeOperatorReviewCopy("Block Imaging looks like unknown (25% confidence)."),
  null,
)
assert.match(
  resolveOperatorOpportunitySummary({
    companyName: "Block Imaging",
    confidence: 0.25,
    executiveSummary: "Block Imaging looks like unknown (25% confidence).",
  }),
  /limited evidence/i,
)
console.log("  ✓ awkward unknown executive summary is sanitized in presentation layer")

const strongPacket = packetFromPackage(
  basePackage({
    generatedAssets: [
      {
        channel: "email",
        label: "Intro email",
        preview: "Hi Jordan — I noticed Block Imaging continues expanding field service coverage.",
        operatorPreview: "Hi Jordan — I noticed Block Imaging continues expanding field service coverage.",
        prepared: true,
      },
      {
        channel: "linkedin",
        label: "LinkedIn note",
        preview: "Jordan — quick note on service coordination for imaging teams.",
        operatorPreview: "Jordan — quick note on service coordination for imaging teams.",
        prepared: true,
      },
    ],
  }),
)
const strongSummary = projectOperatorPackageDecisionSummary({
  packet: strongPacket,
  transportExecutionReady: false,
})
assert.equal(strongSummary.qaMarker, GROWTH_OPERATOR_PACKAGE_PROGRESSIVE_REVIEW_2A_QA_MARKER)
assert.match(strongSummary.recommendedAngle, /Block Imaging|focused conversation/i)
assert.ok(strongSummary.primaryEmailDraft?.prepared)
assert.equal(strongSummary.secondaryPreparedDrafts.length, 1)
assert.match(strongSummary.contentReadySummary, /Email prepared/i)
assert.match(strongSummary.contentReadySummary, /LinkedIn prepared/i)
assert.match(strongSummary.transportSummary, /unavailable|separately gated/i)
console.log("  ✓ strong email + LinkedIn package shows both prepared channels without overstating transport")

const emailOnlyPacket = packetFromPackage(
  basePackage({
    generatedAssets: [
      {
        channel: "email",
        label: "Intro email",
        preview: "Hi Jordan — thanks for leading operations at Block Imaging.",
        operatorPreview: "Hi Jordan — thanks for leading operations at Block Imaging.",
        prepared: true,
      },
    ],
  }),
)
const emailOnlySummary = projectOperatorPackageDecisionSummary({ packet: emailOnlyPacket })
const emailOnlyReadiness = projectOperatorPackageChannelReadiness({ packet: emailOnlyPacket })
assert.ok(emailOnlyReadiness.some((row) => row.channel === "email" && row.content === "prepared"))
assert.ok(emailOnlyReadiness.some((row) => row.channel === "voicemail" && row.content === "missing"))
assert.doesNotMatch(
  emailOnlySummary.contentReadySummary,
  /Voicemail prepared|SMS prepared|Call guide prepared/i,
)
console.log("  ✓ email-only package does not overstate other channels as prepared")

const missingPhoneSummary = projectOperatorPackageDecisionSummary({
  packet: strongPacket,
})
const missingPhoneReadiness = projectOperatorPackageChannelReadiness({ packet: strongPacket })
assert.ok(missingPhoneReadiness.some((row) => row.channel === "call" && row.contact === "contact_missing"))
assert.match(missingPhoneSummary.contactWarning ?? "", /Phone is missing/i)
console.log("  ✓ missing phone number surfaces contact limitation instead of ready phone channel")

const lowConfidenceSummary = projectOperatorPackageDecisionSummary({
  packet: packetFromPackage(basePackage({ confidence: 0.25, salesStrategyBrief: null })),
})
assert.match(lowConfidenceSummary.confidenceLabel, /Limited opportunity confidence/i)
assert.match(lowConfidenceSummary.riskStatement ?? "", /limited|incomplete/i)
console.log("  ✓ low-confidence opportunity shows honest risk in Level 1 summary")

const completeAuth = resolvePackageAuthorizationReadiness({
  packageId: "outreach-prep:lead-1:2026",
  leadId: "lead-1",
  generatedAssetCount: 2,
})
assert.equal(completeAuth.ready, true)
const unresolvedSequence = evaluateAvaOutreachPackageReadiness({
  recommendedSequence: "unknown_custom_cadence",
  recommendedChannel: "email",
  patterns: [{ id: "pat-email-call", key: "email_then_call", isActive: true, confidenceScore: 0 }],
})
assert.equal(unresolvedSequence.approvalReady, true)
assert.equal(unresolvedSequence.executionReady, false)
console.log("  ✓ complete package with unresolved sequence remains authorizable and transport stays separate")

const incompleteAuth = resolvePackageAuthorizationReadiness({
  packageId: "outreach-prep:lead-1:2026",
  leadId: "lead-1",
  generatedAssetCount: 0,
})
assert.equal(incompleteAuth.ready, false)
console.log("  ✓ incomplete package remains authorization-blocked")

assert.match(cardSource, /resolvePackageAuthorizationReadiness/)
assert.match(cardSource, /GROWTH_OPERATOR_PACKAGE_AUTHORIZE_PRE_ACTION/)
assert.match(cardSource, /GROWTH_OPERATOR_PACKAGE_TWO_STEP_LADDER_STEPS/)
assert.doesNotMatch(cardSource, /Authorize is blocked until sequence enrollment readiness/)
console.log("  ✓ authorize semantics and two-step transport explanation preserved")

assert.match(layoutSource, /Primary email draft/)
assert.match(layoutSource, /Other prepared drafts/)
assert.match(layoutSource, /editable/i)
console.log("  ✓ primary and secondary drafts remain readable and editable")

assert.match(moduleSource, /contentReadySummary/)
assert.match(moduleSource, /contactReadySummary/)
assert.match(moduleSource, /transportSummary/)
console.log("  ✓ content, contact, and transport readiness are projected separately")

assert.match(formatOperatorConfidenceLabel(0.82), /Strong opportunity confidence/)
console.log("  ✓ qualification confidence uses operator-facing labels")

console.log("\nPASS — Progressive package review supports a trustworthy 60-second operator decision.")
