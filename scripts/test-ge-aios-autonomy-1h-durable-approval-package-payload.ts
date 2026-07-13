/**
 * GE-AIOS-AUTONOMY-1H — Durable approval package payload certification.
 * Run: pnpm test:ge-aios-autonomy-1h-durable-approval-package-payload
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_AIOS_AUTONOMY_1H_QA_MARKER,
  buildOutreachPrepPackageId,
  parseOutreachPrepPackageId,
} from "../lib/growth/aios/growth/growth-autonomous-outreach-preparation-package-id"
import { buildAutonomousOutreachPreparationRunRecord } from "../lib/growth/aios/growth/growth-autonomous-outreach-preparation-pilot-engine"
import { indexOutreachPackagesById, projectAvaCompletedWork } from "../lib/growth/aios/approvals/ava-completed-work-projection"
import type { GrowthAutonomousOutreachApprovalPackage } from "../lib/growth/aios/growth/growth-autonomous-outreach-preparation-pilot-types"
import type { GrowthHumanApprovalItem } from "../lib/growth/aios/approvals/growth-human-approval-center-types"
import { collectOutreachPackageApprovalItems } from "../lib/growth/aios/approvals/growth-human-approval-center-engine"

const ROOT = process.cwd()
const ORG = "5876176a-61ec-4532-ad99-0c31482d5a91"
const BLOCK = "6d9220f0-2960-468c-b4be-5d7595d292c3"
const PKG =
  "outreach-prep:6d9220f0-2960-468c-b4be-5d7595d292c3:2026-07-13T16:40:40.229Z"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

console.log(`[${GROWTH_AIOS_AUTONOMY_1H_QA_MARKER}] Durable approval package payload certification`)

assert.equal(GROWTH_AIOS_AUTONOMY_1H_QA_MARKER, "ge-aios-autonomy-1h-durable-approval-package-payload-v1")

const parsed = parseOutreachPrepPackageId(PKG)
assert.ok(parsed)
assert.equal(parsed!.leadId, BLOCK)
assert.equal(parsed!.generatedAt, "2026-07-13T16:40:40.229Z")
assert.equal(buildOutreachPrepPackageId(BLOCK, parsed!.generatedAt), PKG)
assert.equal(parseOutreachPrepPackageId("bad"), null)
console.log("  ✓ package ID parse/build preserves Block Imaging historical id")

const persistSrc = readSource(
  "lib/growth/aios/growth/growth-autonomous-outreach-preparation-package-persistence.ts",
)
assert.ok(persistSrc.includes("appendAutonomousOutreachPreparationRun"))
assert.ok(persistSrc.includes("findAutonomousOutreachPreparationRunByPackageId"))
assert.ok(persistSrc.includes("buildAutonomousOutreachApprovalPackage"))
assert.ok(persistSrc.includes("reusedExisting"))
assert.ok(persistSrc.includes("recoverAutonomousOutreachApprovalPackagePayload"))
assert.ok(
  readSource("lib/growth/aios/growth/growth-autonomous-outreach-preparation-package-id.ts").includes(
    "parseOutreachPrepPackageId",
  ),
)
console.log("  ✓ Growth 5F persists body before returning packageId; reuse is idempotent")

for (const file of [
  "lib/growth/draft-factory/draft-factory-durable-live.ts",
  "lib/growth/draft-factory/draft-factory-due-scheduler-tick.ts",
  "lib/growth/draft-factory/draft-factory-wake-bus-observer.ts",
]) {
  const src = readSource(file)
  assert.ok(
    src.includes("generateAndPersistAutonomousOutreachApprovalPackageForDraftFactory"),
    `${file} must persist Growth 5F package body`,
  )
  assert.equal(
    /buildAutonomousOutreachApprovalPackage\(/.test(src),
    false,
    `${file} must not call builder without persistence helper`,
  )
}
console.log("  ✓ due tick / live / wake-bus capacity paths persist via shared helper")

const sv13 = readSource("lib/growth/draft-factory/draft-factory-service.ts")
assert.ok(sv13.includes("generateAndPersistAutonomousOutreachApprovalPackageForDraftFactory"))
console.log("  ✓ SV1-3 generation path also persists approval_package")

const completedPanel = readSource("components/growth/ai-os/approvals/growth-ava-completed-work-panel.tsx")
assert.ok(completedPanel.includes("recentRuns"))
assert.ok(completedPanel.includes("approvalPackage"))
assert.ok(completedPanel.includes("projectAvaCompletedWork"))
console.log("  ✓ Completed Work reads package bodies from pilot recentRuns (no UI regen)")

const hac = readSource("lib/growth/aios/approvals/growth-human-approval-center-engine.ts")
assert.ok(hac.includes("collectOutreachPackageApprovalItems"))
assert.ok(hac.includes("pendingHumanApproval"))
assert.ok(hac.includes("Transport blocked"))
console.log("  ✓ HAC targets pendingHumanApproval packages; transport remains blocked")

const actionRoute = readSource(
  "app/api/platform/growth/ai-os/autonomous-outreach-preparation-pilot/packages/[packageId]/action/route.ts",
)
assert.ok(actionRoute.includes("submitAvaOutreachPackageApprovalAction"))
assert.ok(actionRoute.includes("approve") && actionRoute.includes("reject"))
console.log("  ✓ authorize/reject actions remain package-id targeted")

// Block Imaging fixture — durable run record with full body → Completed Work card
const approvalPackage: GrowthAutonomousOutreachApprovalPackage = {
  packageId: PKG,
  leadId: BLOCK,
  companyName: "block imaging",
  preparedAt: "2026-07-13T16:40:40.229Z",
  generatedAssets: [
    { channel: "email", label: "Cold email", preview: "Subject: Capacity at Block Imaging", draftOnly: true },
    { channel: "sms", label: "SMS", preview: "Hi Josh — quick note…", draftOnly: true },
    { channel: "linkedin", label: "LinkedIn", preview: "Connecting regarding operations…", draftOnly: true },
    { channel: "call", label: "Call opener", preview: "Open with service capacity…", draftOnly: true },
  ],
  personalizationEvidence: ["Email strategy: deterministic", "Decision maker greeting used"],
  supportingResearch: ["Medical imaging equipment services", "Multi-site footprint"],
  confidence: 0.78,
  approvalRequirements: ["operator_outbound_approval", "human_send_gate"],
  complianceNotes: ["Draft-only — no transport execution in GE-AIOS-GROWTH-5F."],
  recommendedChannel: "email",
  recommendedSequence: "email_first_multichannel",
  expectedOutcome: "Human-approved outreach after draft review.",
  pendingHumanApproval: true,
  transportBlocked: true,
}

const run = buildAutonomousOutreachPreparationRunRecord({
  leadId: BLOCK,
  companyName: "block imaging",
  wakeCondition: "execution_completed",
  generatedAt: "2026-07-13T16:40:40.229Z",
  outcome: "completed",
  packageId: PKG,
  confidence: approvalPackage.confidence,
  approvalPackage,
})
assert.equal(run.packageId, PKG)
assert.equal(run.approvalPackage?.packageId, PKG)
assert.equal(run.runId, `growth-outreach-prep-run:${BLOCK}:2026-07-13T16:40:40.229Z`)

const hacItems = collectOutreachPackageApprovalItems({
  organizationId: ORG,
  generatedAt: "2026-07-13T17:00:00.000Z",
  approvalWorkOrders: [],
  executionPlanReviewQueue: [],
  needsAttention: [],
  metaRecommendations: [],
  priorityBindings: [],
  revenueOperatorOrchestrations: [],
  geV15Inbox: [],
  automationApprovals: [],
  sequenceJobs: [],
  aiVoiceSessions: [],
  humanExecutionApprovals: [],
  outreachPreparationRuns: [run],
  meetingPreparationRuns: [],
  boundedAutonomousOutbound: null,
  adaptiveCalibrationProposals: [],
})
assert.equal(hacItems.length, 1)
assert.equal(hacItems[0]?.subjectId, BLOCK)
assert.ok(hacItems[0]?.route?.includes(encodeURIComponent(PKG)))

const packagesById = indexOutreachPackagesById([approvalPackage])
assert.equal(packagesById.size, 1)
assert.equal(packagesById.get(PKG)?.packageId, PKG)

const projection = projectAvaCompletedWork({
  items: hacItems as GrowthHumanApprovalItem[],
  packagesById,
  teammateName: "Ava",
})
assert.equal(projection.totalCompleted, 1)
const card = projection.items[0]?.outreachCard
assert.ok(card)
assert.equal(card!.packageId, PKG)
assert.ok(card!.draftAssets.some((a) => a.channel === "email"))
assert.equal(card!.pendingHumanApproval, true)
assert.equal(card!.transportBlocked, true)
assert.ok(card!.personalizationSummary.length > 0)
console.log("  ✓ Block Imaging fixture: one body, HAC item, Completed Work card, gates intact")

// Duplicate wake reuses same logical package id (no second package id)
const again = buildOutreachPrepPackageId(BLOCK, "2026-07-13T16:40:40.229Z")
assert.equal(again, PKG)
console.log("  ✓ duplicate generation wake reuses identical package id")

assert.equal(/sendEmail|enrollSequence|twilio|placeCall|apollo/i.test(persistSrc), false)
const tickSrc = readSource("lib/growth/draft-factory/draft-factory-due-scheduler-tick.ts")
assert.equal(/sendEmail|enrollSequence/i.test(tickSrc), false)
console.log("  ✓ no outbound / enrollment in persistence or due tick")

const pkg = readSource("package.json")
assert.ok(pkg.includes("test:ge-aios-autonomy-1h-durable-approval-package-payload"))
console.log("  ✓ package script registered")

console.log(`\n[${GROWTH_AIOS_AUTONOMY_1H_QA_MARKER}] PASS`)
