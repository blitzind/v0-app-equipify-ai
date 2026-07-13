/**
 * GE-AIOS-APPROVALS-2A — Operator review experience certification.
 * Run: pnpm test:ge-aios-approvals-2a-operator-review-experience
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  APPROVALS_2A_DRAFT_CHANNELS,
  GROWTH_AIOS_APPROVALS_2A_QA_MARKER,
  countPreparedDrafts,
  humanizeCompletedWorkSupportingSummary,
  projectApprovals2AOperatorReviewPacket,
} from "../lib/growth/aios/approvals/approvals-operator-review-packet"
import {
  resolveCompletedWorkOperatorBucket,
  sortCompletedWorkForOperatorPriority,
} from "../lib/growth/aios/approvals/completed-work-operator-ux"
import { projectAvaCompletedWork } from "../lib/growth/aios/approvals/ava-completed-work-projection"
import type { GrowthAutonomousOutreachApprovalPackage } from "../lib/growth/aios/growth/growth-autonomous-outreach-preparation-pilot-types"
import type { GrowthHumanApprovalItem } from "../lib/growth/aios/approvals/growth-human-approval-center-types"
import { resolveAiTeammatePresentation } from "../lib/workspace/ai-teammate-identity"

const ROOT = process.cwd()
const BLOCK = "6d9220f0-2960-468c-b4be-5d7595d292c3"
const PKG =
  "outreach-prep:6d9220f0-2960-468c-b4be-5d7595d292c3:2026-07-13T16:40:40.229Z"
const ORG = "5876176a-61ec-4532-ad99-0c31482d5a91"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

function samplePackage(): GrowthAutonomousOutreachApprovalPackage {
  return {
    packageId: PKG,
    leadId: BLOCK,
    companyName: "block imaging",
    preparedAt: "2026-07-13T16:40:40.229Z",
    generatedAssets: [
      {
        channel: "email",
        label: "Email draft",
        preview: "Subject: Capacity at Block Imaging\n\nHi Josh — …",
        draftOnly: true,
      },
      { channel: "sms", label: "SMS", preview: "Hi Josh — quick note…", draftOnly: true },
      { channel: "linkedin", label: "LinkedIn", preview: "Connecting regarding operations…", draftOnly: true },
      { channel: "call", label: "Call", preview: "Open with service capacity…", draftOnly: true },
      { channel: "sendr", label: "Personalized Video", preview: "Video talking points ready", draftOnly: true },
      { channel: "follow_up", label: "Follow-up", preview: "Schedule human-reviewed follow-up", draftOnly: true },
    ],
    personalizationEvidence: [
      "Mentioned nationwide depot repair",
      "Specializes in refurbished imaging systems",
      "Primary hook: MRI service visibility",
    ],
    supportingResearch: [
      "Services MRI, CT and imaging equipment",
      "Nationwide service coverage",
      "Website summary captured",
      "Hiring biomedical technicians",
    ],
    confidence: 0.78,
    approvalRequirements: ["operator_outbound_approval", "human_send_gate"],
    complianceNotes: ["Draft-only — no transport execution."],
    recommendedChannel: "email",
    recommendedSequence: "email_first_multichannel",
    expectedOutcome: "Human-approved outreach after draft review.",
    pendingHumanApproval: true,
    transportBlocked: true,
  }
}

function sampleItem(overrides: Partial<GrowthHumanApprovalItem> = {}): GrowthHumanApprovalItem {
  return {
    id: "item-1",
    organizationId: ORG,
    source: "outreach_package",
    actionType: "approve_outreach_package",
    channel: "email",
    subjectType: "lead",
    subjectId: BLOCK,
    title: "Outreach package — block imaging",
    summary: "Ready",
    riskLevel: "medium",
    priorityScore: 90,
    status: "needs_review",
    evidence: [],
    policy: { requiresHumanApproval: true, enforcementSource: "test" },
    route: `/growth/os/pilot/lead-research/${BLOCK}?packageId=${encodeURIComponent(PKG)}`,
    createdAt: "2026-07-13T16:40:40.229Z",
    ...overrides,
  }
}

console.log(`[${GROWTH_AIOS_APPROVALS_2A_QA_MARKER}] Operator review experience certification`)

assert.equal(GROWTH_AIOS_APPROVALS_2A_QA_MARKER, "ge-aios-approvals-2a-operator-review-experience-v1")

const teammate = resolveAiTeammatePresentation("Jordan")
const packet = projectApprovals2AOperatorReviewPacket({
  pkg: samplePackage(),
  teammateName: teammate.name,
  now: "2026-07-13T18:00:00.000Z",
  lead: {
    companyName: "block imaging",
    website: "https://example.com/block-imaging",
    city: "Holt",
    state: "MI",
    country: "US",
    contactName: "Josh Block",
    contactEmail: "josh@example.com",
    contactPhone: "+15555550100",
    estimatedEmployeeCount: "51-200",
    estimatedAnnualRevenue: "$10M–$50M",
    fieldServiceStackDetected: "MRI / CT imaging service",
    lastResearchedAt: "2026-07-13T15:00:00.000Z",
    sourceVendor: "datamoon",
    decisionMakerStatus: "verified_contactable",
  },
  decisionMaker: {
    fullName: "Josh Block",
    title: "President",
    email: "josh@example.com",
    phone: "+15555550100",
    linkedinUrl: "https://linkedin.com/in/example",
    confidence: 0.9,
    verificationStatus: "confirmed",
    discoveredAt: "2026-07-13T14:00:00.000Z",
    source: "datamoon",
  },
  research: {
    updatedAt: "2026-07-13T15:00:00.000Z",
    confidence: 0.78,
    industry: "Medical equipment service",
    equipmentServiced: ["MRI", "CT"],
    missingEvidence: [],
    potentialRisks: ["Verify bounce risk before send"],
    assumptions: ["Revenue range estimated from public signals"],
    opportunitySummary: "Strong imaging service fit with verified decision maker.",
  },
})

assert.equal(packet.qaMarker, GROWTH_AIOS_APPROVALS_2A_QA_MARKER)
assert.equal(packet.company.name, "block imaging")
assert.ok(packet.company.website)
assert.equal(packet.decisionMaker.name, "Josh Block")
assert.ok(packet.decisionMaker.email)
assert.ok(packet.decisionMaker.phone)
assert.ok(packet.whySelected.length >= 3)
assert.ok(
  packet.operatorReviewLayout.researchSummary.length > 0 ||
    packet.whySelected.some((line) => /imaging|equipment|decision maker/i.test(line)),
)
assert.ok(packet.evidenceCards.some((card) => card.id === "website" && card.present))
assert.ok(packet.evidenceCards.some((card) => card.id === "decision_maker" && card.present))
assert.equal(packet.drafts.length, APPROVALS_2A_DRAFT_CHANNELS.length)
assert.ok(packet.drafts.some((d) => d.channel === "voicemail" && !d.prepared && d.preview === null))
assert.ok(packet.drafts.some((d) => d.channel === "email" && d.prepared))
assert.ok(countPreparedDrafts(packet) >= 5)
assert.equal(packet.pendingHumanApproval, true)
assert.equal(packet.transportBlocked, true)
assert.ok(packet.risk.autonomousSendBlockedReasons.includes("transportBlocked"))
assert.ok(packet.explainability.whyPursue.length > 10)
assert.ok(packet.transparency.packageVersion.includes(BLOCK))
assert.equal(packet.teammateName, "Jordan")
console.log("  ✓ Block Imaging-style packet exposes company, DM, drafts, evidence, risk, transparency")

const items = [
  sampleItem(),
  sampleItem({
    id: "meeting-1",
    source: "meeting_prep",
    actionType: "approve_meeting_prep",
    title: "Meeting prep",
    priorityScore: 70,
  }),
  sampleItem({
    id: "follow-1",
    source: "automation",
    actionType: "approve_automation",
    title: "Follow-up",
    priorityScore: 60,
  }),
  sampleItem({
    id: "cal-1",
    source: "adaptive_calibration",
    actionType: "review_recommendation",
    title: "Calibration: Objective progress signals",
    summary: "204 recent customer interactions scored",
    priorityScore: 20,
  }),
]
const sorted = sortCompletedWorkForOperatorPriority(
  projectAvaCompletedWork({ items, teammateName: "Jordan" }).items,
)
assert.equal(resolveCompletedWorkOperatorBucket(sorted[0]!.item), "ready_outreach")
assert.equal(resolveCompletedWorkOperatorBucket(sorted[1]!.item), "ready_meeting")
assert.equal(resolveCompletedWorkOperatorBucket(sorted[2]!.item), "ready_follow_up")
assert.equal(resolveCompletedWorkOperatorBucket(sorted[3]!.item), "supporting_calibration")
console.log("  ✓ priority order: outreach → meeting → follow-up → calibration")

const human = humanizeCompletedWorkSupportingSummary(
  {
    title: "Calibration: Objective progress signals",
    summary: "204 recent customer interactions scored",
    source: "adaptive_calibration",
  },
  "Jordan",
)
assert.match(human, /Jordan analyzed 204/)
assert.match(human, /recalibrating/)
console.log("  ✓ supporting summaries use human language with teammate identity")

const panel = readSource("components/growth/ai-os/approvals/growth-ava-completed-work-panel.tsx")
assert.ok(panel.includes("Ready for your review"))
assert.ok(panel.includes("Supporting activity"))
assert.ok(panel.includes("humanizeCompletedWorkSupportingSummary"))
assert.ok(panel.includes("GROWTH_AIOS_OPERATOR_UX_1A_QA_MARKER"))
console.log("  ✓ Completed Work keeps outreach primary and calibration collapsed")

const card = readSource(
  "components/growth/ai-os/approvals/growth-ava-completed-outreach-package-card.tsx",
)
assert.ok(card.includes("Company summary"))
assert.ok(card.includes("Decision maker"))
assert.ok(card.includes("Conversation strategy"))
assert.ok(card.includes("GrowthCollapsibleEngineCard"))
assert.ok(card.includes("Research summary"))
assert.ok(card.includes("Risk panel"))
assert.ok(card.includes("Strategy detail"))
assert.ok(card.includes("Transparency & metadata"))
assert.ok(card.includes("Authorize"))
assert.ok(card.includes("Needs revision"))
assert.ok(card.includes("Archive lead"))
assert.ok(card.includes("Pause autonomy"))
assert.ok(card.includes("View lead"))
assert.ok(card.includes("Open research"))
assert.ok(card.includes("Not prepared"))
assert.ok(card.includes("GROWTH_AIOS_APPROVALS_2A_QA_MARKER"))
assert.equal(/sendEmail|enrollSequence|twilio|placeCall|apollo/i.test(card), false)
assert.equal(/SENDR|Growth 5F|Draft Factory/i.test(card), false)
console.log("  ✓ package card is a complete SDR work product with lifecycle actions")

const api = readSource(
  "app/api/platform/growth/ai-os/completed-work/packages/[packageId]/route.ts",
)
assert.ok(api.includes("loadApprovals2AOperatorReviewPacket"))
assert.ok(api.includes("transportBlocked: true"))
assert.ok(api.includes("pendingHumanApproval: true"))
console.log("  ✓ read-only package review API composes existing stores")

const service = readSource("lib/growth/aios/approvals/approvals-operator-review-service.ts")
assert.ok(service.includes("findAutonomousOutreachPreparationRunByPackageId"))
assert.ok(service.includes("fetchGrowthLeadById"))
assert.ok(service.includes("listGrowthLeadDecisionMakers"))
assert.ok(service.includes("fetchLatestGrowthLeadResearchWorkflowSnapshot"))
assert.equal(/insert\(|createTable|new approval store/i.test(service), false)
console.log("  ✓ no parallel store; reuses Growth 5F + lead + DM + research")

assert.ok(card.includes("cancel_work"))
assert.ok(
  readSource("lib/growth/aios/approvals/completed-work-lifecycle-propagation.ts").includes(
    "pauseDraftFactoryWorkForLead",
  ),
)
console.log("  ✓ reject/pause autonomy reuses Draft Factory stop path")

const pkgJson = readSource("package.json")
assert.ok(pkgJson.includes("test:ge-aios-approvals-2a-operator-review-experience"))
console.log("  ✓ package script registered")

console.log(`\n[${GROWTH_AIOS_APPROVALS_2A_QA_MARKER}] PASS`)
