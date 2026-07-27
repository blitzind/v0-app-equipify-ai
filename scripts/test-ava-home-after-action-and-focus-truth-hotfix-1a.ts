/**
 * AVA-HOME-AFTER-ACTION-AND-FOCUS-TRUTH-HOTFIX-1A — Certification.
 * Run: pnpm test:ava-home-after-action-and-focus-truth-hotfix-1a
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import type { GrowthAiCopilotGeneration } from "@/lib/growth/ai-copilot-types"
import {
  resolveAvaSupervisedOutboundApprovalPresentation,
} from "@/lib/growth/ava-reasoning/ava-supervised-outbound-approval-state-core"
import { AVA_SUPERVISED_OUTBOUND_1A_QA_MARKER } from "@/lib/growth/ava-reasoning/ava-supervised-outbound-1a-types"
import { fingerprintAvaSupervisedOutboundBody } from "@/lib/growth/ava-reasoning/ava-supervised-outbound-signature-boundary-core"
import {
  buildSupervisedAvaHomeOperatorAttention,
  isSendEligibleSupervisedAvaGeneration,
} from "@/lib/growth/ava-reasoning/equipify-supervised-home-projection-1a"
import { enrichGrowthHomeAvaRecommendationItemNext1d } from "@/lib/growth/ava-home/recommendations/growth-home-ava-recommendation-outcome-next-1d"
import { enrichGrowthHomeAvaRecommendationItemNext1b } from "@/lib/growth/ava-home/recommendations/growth-home-ava-recommendation-presentation-next-1b"
import {
  buildGrowthHomeReviewQueuePresentation,
  filterSelectableRecommendedRows,
} from "@/lib/growth/home/growth-home-review-queue-1b"
import { buildGrowthHomeCurrentFocusPresentation } from "@/lib/growth/home/growth-home-simplification-1a"
import { resolveHomeOperatorEmployeeStatusFromMission } from "@/lib/growth/mission-center/growth-autonomous-lead-discovery-18g"

const QA_MARKER = "ava-home-after-action-and-focus-truth-hotfix-1a-v1" as const
const ROOT = process.cwd()

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

function draftGeneration(overrides: Partial<GrowthAiCopilotGeneration> = {}): GrowthAiCopilotGeneration {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    leadId: "22222222-2222-4222-8222-222222222222",
    generationType: "cold_email",
    promptVersion: "ava-direct-production-cutover-1a-v1",
    promptVariant: "ava_direct_production_cutover_1a",
    inputSnapshot: {
      contactsSupplied: [{ contactId: "c1", name: "Pat", email: "pat@example.com", contactabilityStatus: "contactable" }],
    },
    generatedContent: "Hi Pat,\n\nBody.",
    generatedSubject: "Subject",
    classification: { primary: "pursue", generationMode: "ava_direct_production_cutover_1a" },
    status: "draft",
    sourceReplyId: null,
    inputHash: null,
    playbookInfluenceScore: 0,
    playbookAttribution: {},
    approvedAt: null,
    approvedBy: null,
    sentAt: null,
    createdBy: null,
    createdAt: "2026-07-27T14:00:00.000Z",
    ...overrides,
  }
}

function approvedGeneration(): GrowthAiCopilotGeneration {
  const body = "Hi Pat,\n\nBody."
  const binding = {
    qaMarker: AVA_SUPERVISED_OUTBOUND_1A_QA_MARKER,
    generationId: "11111111-1111-4111-8111-111111111111",
    organizationId: "00757488-1026-44a5-aac4-269533ac21be",
    recipientEmail: "pat@example.com",
    subject: "Subject",
    unsignedBody: body,
    bodyFingerprint: fingerprintAvaSupervisedOutboundBody(body),
    senderAccountId: "sender-1",
    senderEmail: "mike@equipify.com",
    approvedAt: "2026-07-27T14:05:00.000Z",
    approvedBy: "operator-1",
  }
  return draftGeneration({
    status: "approved",
    approvedAt: binding.approvedAt,
    approvedBy: binding.approvedBy,
    classification: {
      primary: "pursue",
      generationMode: "ava_direct_production_cutover_1a",
      avaSupervisedOutboundApproval: binding,
      outboundSendAuthorized: true,
    },
  })
}

async function main() {
  console.log(`[${QA_MARKER}] certification\n`)

  const queueSection = readSource(
    "components/growth/workspace/executive-briefing/growth-home-ava-outreach-review-queue-section.tsx",
  )
  const reviewQueueLib = readSource("lib/growth/home/growth-home-review-queue-1b.ts")
  const projectionSrc = readSource("lib/growth/ava-reasoning/equipify-supervised-home-projection-1a.ts")
  const outcomeSrc = readSource("lib/growth/ava-home/recommendations/growth-home-ava-recommendation-outcome-next-1d.ts")

  assert.match(queueSection, /await onRefresh/)
  assert.match(queueSection, /showSendEmailAction/)
  assert.match(queueSection, /Approving/)
  assert.match(reviewQueueLib, /showApproveEmailAction/)
  assert.match(projectionSrc, /approvedReadyToSend/)
  assert.match(projectionSrc, /isSendEligibleSupervisedAvaGeneration/)
  console.log("  ✓ Home Approve success awaits canonical refresh and uses drawer-aligned actions")

  const draft = draftGeneration()
  const approved = approvedGeneration()
  const draftPresentation = resolveAvaSupervisedOutboundApprovalPresentation(draft)
  const approvedPresentation = resolveAvaSupervisedOutboundApprovalPresentation(approved)
  assert.equal(draftPresentation.showApproveEmailAction, true)
  assert.equal(draftPresentation.showSendEmailAction, false)
  assert.equal(approvedPresentation.sendEligible, true)
  assert.equal(approvedPresentation.showSendEmailAction, true)
  console.log("  ✓ drawer and Home share resolveAvaSupervisedOutboundApprovalPresentation semantics")

  const attention = buildSupervisedAvaHomeOperatorAttention({
    generations: [approved, draft],
    leadsById: new Map([[draft.leadId, "Acme Corp"]]),
  })
  assert.equal(attention.readyForReview.length, 0)
  assert.equal(attention.approvedReadyToSend.length, 1)
  assert.equal(isSendEligibleSupervisedAvaGeneration(approved), true)
  console.log("  ✓ approved send-eligible generations project into approvedReadyToSend")

  const queue = buildGrowthHomeReviewQueuePresentation({
    packages: [
      {
        itemId: `supervised-draft:${approved.id}`,
        packageId: approved.id,
        leadId: approved.leadId,
        companyName: "Acme Corp",
        decisionMaker: "Pat",
        draftCount: 1,
        preparedAt: approved.createdAt,
        preparedAgoLabel: "Prepared 1 minute ago",
        channelLabel: approved.generatedSubject,
        statusLabel: "Approved",
        reviewHref: "/growth/leads/crm?open=22222222-2222-4222-8222-222222222222&focus=ai-copilot",
        packageSource: "supervised_ava_generation",
        operatorDetail: "Approved draft",
      },
    ],
    supervisedReadyByLeadId: new Map([
      [
        approved.leadId,
        {
          generationId: approved.id,
          leadId: approved.leadId,
          companyName: "Acme Corp",
          contactName: "Pat",
          subject: "Subject",
          rationale: null,
          reviewHref: "/growth/leads/crm?open=22222222-2222-4222-8222-222222222222&focus=ai-copilot",
          preparedAt: approved.createdAt,
          outboundSendAuthorized: true,
          messageStatusLabel: "Approved",
          showApproveEmailAction: false,
          showSendEmailAction: true,
          senderEmail: "mike@equipify.com",
        },
      ],
    ]),
  })
  const approvedRow = queue.rows[0]
  assert.equal(approvedRow?.showSendEmailAction, true)
  assert.equal(approvedRow?.showApproveEmailAction, false)
  assert.equal(approvedRow?.senderEmail, "mike@equipify.com")
  assert.equal(filterSelectableRecommendedRows(queue.rows).length, 0)
  console.log("  ✓ Home Approve success changes action to Send Email with assigned sender")

  const awaitingQueue = buildGrowthHomeReviewQueuePresentation({
    packages: [
      {
        itemId: `supervised-draft:${draft.id}`,
        packageId: draft.id,
        leadId: draft.leadId,
        companyName: "Acme Corp",
        decisionMaker: "Pat",
        draftCount: 1,
        preparedAt: draft.createdAt,
        preparedAgoLabel: "Prepared 1 minute ago",
        channelLabel: draft.generatedSubject,
        statusLabel: "Ready for review",
        reviewHref: "/growth/leads/crm?open=22222222-2222-4222-8222-222222222222&focus=ai-copilot",
        packageSource: "supervised_ava_generation",
        operatorDetail: "Draft",
      },
    ],
    supervisedReadyByLeadId: new Map([
      [
        draft.leadId,
        {
          generationId: draft.id,
          leadId: draft.leadId,
          companyName: "Acme Corp",
          contactName: "Pat",
          subject: "Subject",
          rationale: null,
          reviewHref: "/growth/leads/crm?open=22222222-2222-4222-8222-222222222222&focus=ai-copilot",
          preparedAt: draft.createdAt,
          outboundSendAuthorized: false,
          messageStatusLabel: "Awaiting approval",
          showApproveEmailAction: true,
          showSendEmailAction: false,
          senderEmail: null,
        },
      ],
    ]),
  })
  assert.equal(awaitingQueue.rows[0]?.showApproveEmailAction, true)
  console.log("  ✓ approval failure keeps row awaiting approval semantics available")

  assert.doesNotMatch(outcomeSrc, /One buying signal remains/)
  assert.doesNotMatch(outcomeSrc, /A few buying signals still need verification/)
  const researchItem = enrichGrowthHomeAvaRecommendationItemNext1d({
    item: enrichGrowthHomeAvaRecommendationItemNext1b({
      item: {
        id: "rec-1",
        kind: "lead_decision",
        title: "Research mcdonalds usa",
        headline: "Research mcdonalds usa",
        companyName: "mcdonalds usa",
        leadId: "lead-mcd",
        href: "/growth/leads/crm?open=lead-mcd",
        detail: "Research is already 82% complete.",
        supportingLine: "Research is already 82% complete.",
        whyReasons: [],
        employeeHeadline: "Research mcdonalds usa",
        employeeLeadParagraph: null,
        employeeSupportingParagraph: null,
        expectedOutcomeLabel: null,
        executionPathSteps: [],
        outcomeLine: null,
        estimatedEffortLabel: null,
      },
      canonicalHeroDecision: null,
    }),
    canonicalHeroDecision: null,
    missionDiscovery: null,
  })
  assert.doesNotMatch(researchItem.outcomeProjection?.currentProgressNarrative ?? "", /buying signal/i)
  assert.doesNotMatch(researchItem.explanation?.expectedOutcome ?? "", /review-ready outreach package/i)
  assert.match(researchItem.explanation?.expectedOutcome ?? "", /evaluate whether/i)
  console.log("  ✓ research lead does not imply outreach is guaranteed; buying-signal pseudo-gates removed")

  const focus = buildGrowthHomeCurrentFocusPresentation({
    pendingApprovals: 0,
    recommendation: researchItem,
    waitingItem: null,
    runtimeTrust: {
      operatorState: "working",
      operatorStateLabel: "Monitoring pipeline",
      operatorFocusCompanyName: "mcdonalds usa",
      operatorFocusHref: "/growth/leads/crm?open=lead-mcd",
      operatorFocusConfidenceLine: null,
      currentLeadCompanyName: null,
      nextMilestoneLabel: null,
      whatHappensNextLines: [],
      startStatus: { primaryActionHref: null },
    },
  })
  assert.equal(focus?.statusLabel, "Researching")
  assert.match(focus?.nextActionLabel ?? "", /decide whether outreach makes sense/i)
  console.log("  ✓ Current Focus describes research/evaluation, not guaranteed outreach")

  const heroWhileResearching = resolveHomeOperatorEmployeeStatusFromMission({
    readyForOutreachReview: 0,
    missionDiscovery: {
      lifecycleState: "preparing_recommendations",
      activityLabel: "monitoring audience",
      counters: { researchingCount: 1 },
    } as never,
  })
  assert.notEqual(heroWhileResearching?.label, "Preparing outreach")
  console.log("  ✓ Preparing outreach only appears when drafts are actually ready for review")

  console.log(`\nPASS — ${QA_MARKER}`)
}

void main().catch((error) => {
  console.error(error)
  process.exit(1)
})
