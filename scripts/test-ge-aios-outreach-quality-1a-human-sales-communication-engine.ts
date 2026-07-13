/**
 * GE-AIOS-OUTREACH-QUALITY-1A — Human Sales Communication Engine certification.
 * Run: pnpm test:ge-aios-outreach-quality-1a-human-sales-communication-engine
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_AIOS_OUTREACH_QUALITY_1A_QA_MARKER,
  assertOutreachCopyQuality,
  buildOutreachSalesStrategyBrief,
  countWords,
  estimateReadTimeSeconds,
} from "../lib/growth/aios/growth/growth-outreach-sales-strategy-brief"
import {
  generateOutreachDraftsFromSalesStrategyBrief,
  summarizeStrategyDerivedAssetsForPackage,
} from "../lib/growth/aios/growth/growth-outreach-strategy-drafts"
import { projectApprovals2AOperatorReviewPacket } from "../lib/growth/aios/approvals/approvals-operator-review-packet"
import type { GrowthAutonomousOutreachApprovalPackage } from "../lib/growth/aios/growth/growth-autonomous-outreach-preparation-pilot-types"

const ROOT = process.cwd()
const BLOCK = "6d9220f0-2960-468c-b4be-5d7595d292c3"
const PKG =
  "outreach-prep:6d9220f0-2960-468c-b4be-5d7595d292c3:2026-07-13T16:40:40.229Z"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

console.log(
  `[${GROWTH_AIOS_OUTREACH_QUALITY_1A_QA_MARKER}] Human Sales Communication Engine certification`,
)

assert.equal(
  GROWTH_AIOS_OUTREACH_QUALITY_1A_QA_MARKER,
  "ge-aios-outreach-quality-1a-human-sales-communication-engine-v1",
)

const brief = buildOutreachSalesStrategyBrief({
  leadId: BLOCK,
  companyName: "block imaging",
  preparedAt: "2026-07-13T16:40:40.229Z",
  website: "https://example.com/block-imaging",
  contactName: "Josh Block",
  contactTitle: "President",
  contactEmail: "josh@example.com",
  contactPhone: "+15555550100",
  location: "Holt, MI",
  equipmentServiced: ["MRI", "CT"],
  verifiedEvidence: [
    "Company summary: Nationwide depot repair for imaging systems",
    "Service indicator: MRI / CT refurbished systems",
    "Pain point: Aging fleet service opportunities",
    "Hiring biomedical technicians",
  ],
  missingEvidence: [],
  opportunitySummary: "Strong imaging service fit with verified decision maker.",
  fitReason: "Fits approved ICP for imaging service operators",
  qualificationConfidence: 0.78,
  researchConfidence: 0.78,
})

assert.ok(brief.executiveSummary.length > 40)
assert.ok(brief.businessProblems.length >= 1)
assert.ok(brief.evidence.length >= 3)
assert.ok(brief.primaryHook.length > 20)
assert.ok(brief.recommendedConversation.length > 20)
assert.ok(brief.recommendedCta.length > 3)
assert.ok(brief.conversationJustification)
assert.ok(brief.sellerTruth)
assert.ok(brief.prospectTruth)
assert.ok(brief.conversationStrategy)
assert.match(brief.tone, /consultative/i)
assert.ok(!/guess|probably invent/i.test(brief.executiveSummary))
console.log("  ✓ Sales Strategy Brief builds from evidence only")

const drafts = generateOutreachDraftsFromSalesStrategyBrief({
  brief,
  senderName: "Jordan",
})

assert.ok(drafts.email.wordCount <= 150, `email words ${drafts.email.wordCount}`)
assert.ok(drafts.sms.length <= 300, `sms chars ${drafts.sms.length}`)
assert.ok(drafts.linkedIn.includes("?"))
assert.match(drafts.callGuide, /Opening:/)
assert.match(drafts.callGuide, /Conversation objective:/)
assert.match(drafts.callGuide, /Discovery questions:/)
assert.match(drafts.followUpSequence, /Day 3/)
assert.match(drafts.followUpSequence, /Day 7/)
assert.match(drafts.followUpSequence, /Day 14/)
assert.match(drafts.followUpSequence, /Day 21/)
assert.equal(drafts.qualityFailures.length, 0, drafts.qualityFailures.join(", "))
assert.equal(assertOutreachCopyQuality(drafts.email.full).length, 0)
assert.equal(assertOutreachCopyQuality(drafts.linkedIn).length, 0)
assert.ok(!/hope you're doing well|i noticed|wanted to reach out/i.test(drafts.email.full))
assert.ok(!/sendr|growth 5f|draft factory/i.test(drafts.email.full))
assert.ok(!/sendr|growth 5f|draft factory/i.test(drafts.personalizedVideo))
console.log("  ✓ Channel drafts derive from one brief with quality gates")

const assets = summarizeStrategyDerivedAssetsForPackage(drafts)
assert.equal(assets.length, 8)
assert.ok(assets.every((row) => row.draftOnly))
const video = assets.find((row) => row.channel === "sendr")
assert.equal(video?.label, "Personalized Video")
assert.ok(!/sendr/i.test(video?.label ?? ""))
const voicemail = assets.find((row) => row.channel === "voicemail")
assert.equal(voicemail?.label, "Voicemail")
console.log("  ✓ Asset summaries label Personalized Video (not SENDR)")

const pkg: GrowthAutonomousOutreachApprovalPackage = {
  packageId: PKG,
  leadId: BLOCK,
  companyName: "block imaging",
  preparedAt: brief.preparedAt,
  generatedAssets: assets,
  salesStrategyBrief: brief,
  draftQuality: {
    emailWordCount: drafts.email.wordCount,
    emailReadTimeSeconds: estimateReadTimeSeconds(drafts.email.body),
    smsCharacterCount: drafts.sms.length,
    qualityFailures: drafts.qualityFailures,
  },
  personalizationEvidence: [`Primary hook: ${brief.primaryHook}`],
  supportingResearch: brief.evidence.map((row) => row.detail).slice(0, 4),
  confidence: brief.confidence,
  approvalRequirements: ["operator_outbound_approval", "human_send_gate"],
  complianceNotes: ["Draft-only — nothing sends until you authorize."],
  recommendedChannel: "email",
  recommendedSequence: "email_first_multichannel",
  expectedOutcome: brief.businessObjective,
  pendingHumanApproval: true,
  transportBlocked: true,
}

const packet = projectApprovals2AOperatorReviewPacket({
  pkg,
  teammateName: "Jordan",
  lead: {
    companyName: "block imaging",
    website: "https://example.com/block-imaging",
    contactName: "Josh Block",
    contactEmail: "josh@example.com",
    contactPhone: "+15555550100",
  },
  decisionMaker: {
    fullName: "Josh Block",
    title: "President",
    email: "josh@example.com",
    phone: "+15555550100",
  },
})

assert.ok(packet.salesStrategy)
assert.equal(packet.salesStrategy?.primaryHook, brief.primaryHook)
assert.equal(
  packet.drafts.find((d) => d.channel === "sendr")?.label,
  "Personalized Video",
)
assert.equal(packet.transparency.preparationLabel, "Outreach preparation")
assert.ok(!("growth5fVersion" in packet.transparency))
assert.ok((packet.drafts.find((d) => d.channel === "email")?.wordCount ?? 999) <= 150)
console.log("  ✓ Approval packet surfaces strategy before drafts + customer-safe labels")

const draftService = readSource(
  "lib/growth/aios/growth/growth-autonomous-outreach-preparation-draft-service.ts",
)
assert.match(draftService, /buildOutreachSalesStrategyBrief/)
assert.match(draftService, /generateOutreachDraftsFromSalesStrategyBrief/)
assert.match(draftService, /salesStrategyBrief/)
assert.equal(draftService.includes("runOutreachPersonalizationGeneration"), false)
assert.equal(draftService.includes("previewSendrPersonalization"), false)
assert.equal(/sendEmail|executeTransportSend|enrollSequence/i.test(draftService), false)
console.log("  ✓ Growth outreach prep builds strategy first; no parallel draft engine / transport")

const card = readSource(
  "components/growth/ai-os/approvals/growth-ava-completed-outreach-package-card.tsx",
)
assert.match(card, /Conversation strategy/)
assert.match(card, /Personalized Video|draft\.label/)
assert.match(card, /GROWTH_AIOS_OUTREACH_QUALITY_1A_QA_MARKER/)
assert.match(card, /EditableBlock/)
assert.equal(/SENDR|Draft Factory|Growth 5F/i.test(card), false)
assert.equal(countWords(drafts.email.body) <= 150, true)
console.log("  ✓ Approval UI is strategy-first, editable, and free of internal terminology")

const pkgJson = readSource("package.json")
assert.ok(pkgJson.includes("test:ge-aios-outreach-quality-1a-human-sales-communication-engine"))
console.log("  ✓ package script registered")

console.log(`\n[${GROWTH_AIOS_OUTREACH_QUALITY_1A_QA_MARKER}] PASS`)
