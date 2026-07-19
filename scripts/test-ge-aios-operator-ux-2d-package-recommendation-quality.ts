/**
 * GE-AIOS-OPERATOR-UX-2D — Package recommendation quality certification.
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  projectApprovals2AOperatorReviewPacket,
  type Approvals2AOperatorReviewPacket,
} from "../lib/growth/aios/approvals/approvals-operator-review-packet"
import { buildOutreachSalesStrategyBrief } from "../lib/growth/aios/growth/growth-outreach-sales-strategy-brief"
import {
  generateOutreachDraftsFromSalesStrategyBrief,
  summarizeStrategyDerivedAssetsForPackage,
} from "../lib/growth/aios/growth/growth-outreach-strategy-drafts"
import { buildLive1bEquipifyCompanyProfileContent } from "../lib/growth/live-operations/ge-aios-live-1b-equipify-company-profile-content"
import { projectOperatorPackageDecisionSummary } from "../lib/growth/workspace/ux-2a/review/growth-operator-package-progressive-review-2a"
import {
  GROWTH_OPERATOR_PACKAGE_RECOMMENDATION_2D_QA_MARKER,
  projectOperatorPackageRecommendation2D,
  sanitizeOperatorRecommendationCopy,
} from "../lib/growth/workspace/ux-2d/review/growth-operator-package-recommendation-2d"
import { resolvePackageAuthorizationReadiness } from "../lib/growth/workspace/ux-1a/review/growth-operator-package-review-copy-1a"
import type { GrowthAutonomousOutreachApprovalPackage } from "../lib/growth/aios/growth/growth-autonomous-outreach-preparation-pilot-types"

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

function project2D(packet: Approvals2AOperatorReviewPacket) {
  const summary = projectOperatorPackageDecisionSummary({ packet })
  return projectOperatorPackageRecommendation2D({ packet, summary })
}

console.log("[ge-aios-operator-ux-2d-package-recommendation-quality-v1] UX-2D certification")

const layoutSource = readSource("components/growth/ai-os/approvals/growth-ava-package-progressive-review-layout.tsx")
const cardSource = readSource("components/growth/ai-os/approvals/growth-ava-completed-outreach-package-card.tsx")
const moduleSource = readSource("lib/growth/workspace/ux-2d/review/growth-operator-package-recommendation-2d.ts")

assert.match(layoutSource, /Executive recommendation/)
assert.match(layoutSource, /Why this account/)
assert.match(layoutSource, /Why now/)
assert.match(layoutSource, /Recommended buyer/)
assert.match(layoutSource, /Recommended angle/)
assert.match(layoutSource, /First-conversation strategy/)
assert.match(layoutSource, /Evidence and uncertainty/)
assert.match(layoutSource, /Draft alignment/)
assert.match(cardSource, /projectOperatorPackageRecommendation2D/)
assert.doesNotMatch(moduleSource, /openai|anthropic|generateText|llm/i)
console.log("  ✓ Level 1 exposes recommendation sections without new LLM authority")

assert.equal(
  sanitizeOperatorRecommendationCopy("Block Imaging looks like unknown (25% confidence)."),
  null,
)
assert.equal(sanitizeOperatorRecommendationCopy("appears to be unknown"), null)
assert.doesNotMatch(
  sanitizeOperatorRecommendationCopy("Research from DataMoon shows field service growth.") ?? "",
  /datamoon/i,
)
console.log("  ✓ recommendation copy sanitization removes unknown/provider jargon")

const strongPacket = packetFromPackage({
  ...strongFixturePackage(),
  generatedAssets: [
    {
      channel: "email",
      label: "Intro email",
      preview:
        "Hi Jordan — I noticed Block Imaging coordinates depot-to-field service across imaging teams.",
      operatorPreview:
        "Hi Jordan — I noticed Block Imaging coordinates depot-to-field service across imaging teams.",
      prepared: true,
    },
    {
      channel: "linkedin",
      label: "LinkedIn note",
      preview: "Jordan — quick note on field service coordination for imaging teams.",
      operatorPreview: "Jordan — quick note on field service coordination for imaging teams.",
      prepared: true,
    },
  ],
})
const strong = project2D(strongPacket)
assert.equal(strong.qaMarker, GROWTH_OPERATOR_PACKAGE_RECOMMENDATION_2D_QA_MARKER)
assert.match(strong.executiveRecommendation, /Block Imaging|strong fit|recommend/i)
assert.ok(strong.whyThisAccount.length >= 2)
assert.match(strong.recommendedBuyer.roleRationale, /./)
assert.ok(strong.primaryAngle.label.length > 0)
assert.match(strong.firstConversation.openingPremise, /./)
assert.ok(strong.evidenceAndUncertainty.verified.length > 0)
assert.doesNotMatch(strong.executiveRecommendation, /looks like unknown|datamoon/i)
console.log("  ✓ strong-evidence package produces clear recommendation")

const noTimingPacket = packetFromPackage({
  ...strongFixturePackage(),
  supportingResearch: ["Depot-to-field coordination described on company website."],
  salesStrategyBrief: buildOutreachSalesStrategyBrief({
    leadId: "lead-1",
    companyName: "Block Imaging",
    preparedAt: "2026-07-19T12:00:00.000Z",
    website: "https://blockimaging.com",
    contactName: "Jordan Lee",
    contactTitle: "Director of Operations",
    contactEmail: "jordan@blockimaging.com",
    industry: "Medical equipment service",
    equipmentServiced: ["MRI", "CT"],
    verifiedEvidence: ["Depot-to-field coordination described on company website."],
    approvedProfile: buildLive1bEquipifyCompanyProfileContent(),
    sellerCompanyName: "Equipify",
    fitReason: "Medical equipment field service operator.",
    opportunitySummary: "Dispatch-to-cash friction across field teams.",
    researchConfidence: 0.78,
    qualificationConfidence: 0.72,
  }),
})
const noTiming = project2D(noTimingPacket)
assert.equal(noTiming.whyNowHasTrigger, false)
assert.match(noTiming.whyNow, /fit-based opportunity/i)
assert.doesNotMatch(noTiming.executiveRecommendation, /urgent|buying now/i)
console.log("  ✓ no timing evidence avoids false urgency")

const withTiming = project2D(strongPacket)
assert.equal(withTiming.whyNowHasTrigger, true)
assert.doesNotMatch(withTiming.whyNow, /fit-based opportunity rather than a trigger-based opportunity/)
console.log("  ✓ verified hiring evidence can surface timing without inventing urgency")

const weakPacket = packetFromPackage(
  {
    ...strongFixturePackage(),
    confidence: 0.28,
    salesStrategyBrief: null,
    supportingResearch: [],
    generatedAssets: [],
  },
  undefined,
  {
    fullName: null,
    title: null,
    email: null,
    phone: null,
    linkedinUrl: null,
    confidence: 0.2,
    verificationStatus: "unverified",
  },
)
const weak = project2D(weakPacket)
assert.match(weak.weakEvidenceIntro ?? "", /not yet have enough evidence|limited/i)
assert.equal(weak.recommendedBuyer.weakContact, true)
assert.equal(weak.qualityState, "limited_evidence")
console.log("  ✓ weak-evidence package states uncertainty honestly")

const misalignedPacket = packetFromPackage({
  ...strongFixturePackage(),
  generatedAssets: [
    {
      channel: "email",
      label: "Intro email",
      preview: "Hi there — generic ERP modernization pitch with no service context.",
      operatorPreview: "Hi there — generic ERP modernization pitch with no service context.",
      prepared: true,
    },
  ],
})
const misaligned = project2D(misalignedPacket)
assert.equal(misaligned.draftAlignment.aligned, false)
assert.ok(misaligned.draftAlignment.warnings.length > 0)
console.log("  ✓ draft misalignment is flagged rather than silently rewritten")

const authReady = resolvePackageAuthorizationReadiness({
  packageId: "outreach-prep:lead-1:2026",
  leadId: "lead-1",
  generatedAssetCount: 2,
})
assert.equal(authReady.ready, true)
console.log("  ✓ authorization readiness remains independent of recommendation quality state")

const incompleteAuth = resolvePackageAuthorizationReadiness({
  packageId: "outreach-prep:lead-1:2026",
  leadId: "lead-1",
  generatedAssetCount: 0,
})
assert.equal(incompleteAuth.ready, false)
console.log("  ✓ incomplete package authorization rules unchanged")

console.log("\nPASS — Package recommendations are clear, evidence-grounded, and action-oriented.")
