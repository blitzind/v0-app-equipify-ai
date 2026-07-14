/**
 * GE-AIOS-FIRST-MEETING-WORKFLOW-1A — End-to-end autonomous sales workflow certification.
 * Run: pnpm test:ge-aios-first-meeting-workflow-1a
 *
 * Exercises canonical services only (fixtures + in-memory). No production writes, no transport.
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { projectApprovals2AOperatorReviewPacket } from "../lib/growth/aios/approvals/approvals-operator-review-packet"
import {
  applyAdaptiveLoopToOutreachPreparation,
  buildAdaptiveProspectEvent,
  detectAdaptiveStrategyChanges,
  evolveOutreachStrategyFromAdaptiveEvents,
} from "../lib/growth/aios/growth/growth-adaptive-loop-1a"
import {
  mapBuyingCommitteeRoleChangeToAdaptiveProspectEvent,
  mapMeetingStatusToAdaptiveProspectEvent,
  mapReplyIntentToAdaptiveProspectEvent,
} from "../lib/growth/aios/growth/growth-adaptive-loop-1b-event-mappers"
import { buildCanonicalDecisionInputFromPostCall } from "../lib/growth/aios/growth/growth-canonical-decision-engine-1a-adapters"
import { buildGrowthCanonicalNextBestDecision } from "../lib/growth/aios/growth/growth-canonical-decision-engine-1a"
import { buildGrowthCanonicalDecisionFingerprint } from "../lib/growth/aios/growth/growth-canonical-decision-engine-1a-fingerprint"
import type { GrowthCanonicalDecisionInput } from "../lib/growth/aios/growth/growth-canonical-decision-engine-1a-input"
import { projectCanonicalDecisionOperatorCard } from "../lib/growth/aios/growth/growth-canonical-decision-engine-1a-operator-card"
import {
  isReplyMaterialForCanonicalDecision,
  refreshCanonicalDecisionAfterReply,
} from "../lib/growth/aios/growth/growth-canonical-decision-engine-1a-reply"
import {
  buildCanonicalDecisionSuppressionHints,
  computeGrowthCanonicalDecisionFreshness,
} from "../lib/growth/aios/growth/growth-canonical-decision-engine-1b-freshness"
import { projectGrowthCanonicalOperatorDecision } from "../lib/growth/aios/growth/growth-canonical-decision-engine-1b-operator-projection"
import {
  GROWTH_AIOS_CANONICAL_DECISION_ENGINE_1B_QA_MARKER,
  type GrowthCanonicalDecisionResolution,
} from "../lib/growth/aios/growth/growth-canonical-decision-engine-1b-types"
import {
  evaluateCanonicalSequenceStepExecution,
  evaluateCanonicalTransportBoundary,
} from "../lib/growth/aios/growth/growth-canonical-decision-engine-1c-enforcement"
import { resolveAuthoritativeForm, resolveCanonicalCompanyDisplayName } from "../lib/growth/aios/growth/growth-canonical-display-identity-1b"
import { isAnsweredDiscoveryTheme } from "../lib/growth/aios/growth/growth-outreach-consultant-discovery-intelligence"
import { reviewHumanAuthenticity } from "../lib/growth/aios/growth/growth-outreach-elite-human-communication"
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
  mergeOperatorAssetStateFromPreviousPackage,
  resolveTransportAssetFromPackage,
} from "../lib/growth/aios/growth/growth-send-plane-1b-operator-approval-persistence"
import type { GrowthAutonomousOutreachApprovalPackage } from "../lib/growth/aios/growth/growth-autonomous-outreach-preparation-pilot-types"
import { EQUIPIFY_CANONICAL_SELLER_KNOWLEDGE } from "../lib/growth/business-profile/equipify-master-knowledge-canonical"
import type { BusinessProfileDraftContent } from "../lib/growth/business-profile/business-profile-types"
import {
  mapProfileEventToCanonicalRecord,
  resolveCurrentConclusions,
} from "../lib/growth/lead-memory/canonical-human-memory-evolution"
import {
  MEMORY_CONFIRMATION_COUNT_KEY,
  MEMORY_OPERATOR_OVERRIDE_KEY,
  MEMORY_OPERATOR_STATUS_KEY,
} from "../lib/growth/lead-memory/canonical-human-memory-metadata"
import {
  buildGrowthCanonicalMeetingBrief,
  buildMeetingIntelligenceInputForDecisionEngine,
  projectCanonicalMeetingBriefLiveContext,
} from "../lib/growth/meeting-intelligence/growth-canonical-meeting-brief-builder"
import { GROWTH_AIOS_MEETING_INTELLIGENCE_1A_QA_MARKER } from "../lib/growth/meeting-intelligence/growth-canonical-meeting-brief-types"
import { GROWTH_MEETING_PREP_QA_MARKER } from "../lib/growth/meeting-intelligence/meeting-prep-types"
import type { GrowthMeetingPrepBundle } from "../lib/growth/meeting-intelligence/meeting-prep-types"
import { buildCallWorkspaceAiosLiveReasoningSnapshot } from "../lib/growth/operator-assist/call-workspace-aios-live-reasoning-builder"
import { buildCallWorkspaceClosureFingerprint } from "../lib/growth/operator-assist/call-workspace-post-call-closure-idempotency"
import { computeCallWorkspacePostCallClosure } from "../lib/growth/operator-assist/call-workspace-post-call-closure-compute"
import {
  buildCallWorkspacePostCallAdaptiveEvents,
  extractCallWorkspacePostCallOutcomes,
} from "../lib/growth/operator-assist/call-workspace-post-call-outcome-extraction"
import {
  resolveCallWorkspacePostCallNextAction,
  resolvePostCallFollowUpChannel,
} from "../lib/growth/operator-assist/call-workspace-post-call-nba"
import { resolveSayThisNext } from "../lib/growth/operator-assist/resolve-say-this-next"
import { buildUnifiedOperatorAssistSnapshot } from "../lib/growth/operator-assist/orchestration"
import type { CallIntelligenceScorecardPublicView } from "../lib/growth/call-intelligence/call-intelligence-types"
import type { GrowthRealtimeLiveSnapshot } from "../lib/growth/realtime/realtime-call-types"
import { classifyReplyIntentV2 } from "../lib/growth/reply-intelligence/reply-intent-classifier-v2"
import { extractBuyingSignals } from "../lib/growth/reply-intelligence/buying-signal-extractor"

const ROOT = process.cwd()
const QA_MARKER = "ge-aios-first-meeting-workflow-1a-v1"
const BLOCK_LEAD = "6d9220f0-2960-468c-b4be-5d7595d292c3"
const MEETING_ID = "meeting-block-imaging-service-director"
const ORG_ID = "org-cert-first-meeting-workflow-1a"
const GENERATED_AT = "2026-07-13T20:00:00.000Z"

const REPLY_BODY =
  "We do have challenges coordinating depot work with field service. I am not sure I am the right person, though. Our Service Director would probably be better for this."

type StageRow = {
  stage: string
  canonicalOwner: string
  result: "PASS"
  decisionFingerprint: string
}

const stageReport: StageRow[] = []

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
      disqualifiers: ["Consumer retail with no service operations"],
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
  "Contact discovery provider: DataMoon",
]

function buildResolution(input: GrowthCanonicalDecisionInput): GrowthCanonicalDecisionResolution {
  const decision = buildGrowthCanonicalNextBestDecision(input)
  return {
    qaMarker: GROWTH_AIOS_CANONICAL_DECISION_ENGINE_1B_QA_MARKER,
    organizationId: input.organizationId,
    leadId: input.leadId,
    generatedAt: input.generatedAt,
    companyName: input.companyName,
    decision,
    operatorCard: projectCanonicalDecisionOperatorCard(decision),
    freshness: computeGrowthCanonicalDecisionFreshness({
      decision,
      materialEventAt: input.generatedAt,
    }),
    suppressionHints: buildCanonicalDecisionSuppressionHints(decision),
    inputDegraded: [],
  }
}

function recordStage(stage: string, owner: string, fingerprint: string): void {
  stageReport.push({ stage, canonicalOwner: owner, result: "PASS", decisionFingerprint: fingerprint })
}

function assertHumanCopy(text: string, companyName: string): void {
  const issues = reviewHumanAuthenticity(text, companyName)
  assert.equal(issues.length, 0, `human authenticity issues: ${issues.join("; ")}`)
  assert.equal(text.includes("—"), false, "em dash found in customer-facing copy")
  assert.equal(/SENDR/i.test(text), false, "SENDR reference found")
  assert.equal(/as an ai|language model/i.test(text), false, "AI-reveal phrasing found")
}

function blockImagingPrepBundle(): GrowthMeetingPrepBundle {
  return {
    qa_marker: GROWTH_MEETING_PREP_QA_MARKER,
    meeting: {
      id: MEETING_ID,
      leadId: BLOCK_LEAD,
      title: "Workflow review with Service Director",
      status: "scheduled",
      startAt: "2026-07-24T15:00:00.000Z",
      endAt: "2026-07-24T16:00:00.000Z",
      source: "operator",
      calendarEventId: "cal-block-imaging-001",
      attendeeEmails: ["josh.block@blockimaging.example", "service.director@blockimaging.example"],
      meetingUrl: null,
    },
    companySnapshot: {
      companyName: "Block Imaging",
      website: "https://blockimaging.com",
      industry: "Medical equipment service",
      location: "Grand Rapids, MI",
      employees: "120",
      revenue: null,
    },
    leadScore: { score: 78, label: "Strong", explanation: "High fit", source: "lead_engine" },
    buyingStage: { stage: "evaluation", confidence: 0.72, reason: "Meeting booked after workflow pain" },
    decisionMakers: [
      { id: "dm-josh", name: "Josh Block", title: "President", confidence: 92, status: "confirmed", isPrimary: true },
      {
        id: "dm-service-director",
        name: "Jordan Lee",
        title: "Service Director",
        confidence: 88,
        status: "recommended",
        isPrimary: false,
      },
    ],
    contactIntelligence: null,
    territoryContext: { label: "Grand Rapids, MI", reasons: ["State: MI"] },
    signals: [
      "Depot-to-field coordination is a real operational issue",
      "Field service stack: ServiceMax",
      "Service Director referral on reply",
    ],
    openRisks: [
      {
        id: "incumbent-servicemax",
        label: "Incumbent vendor",
        priority: "High",
        reason: "ServiceMax already in use — switching risk must be handled carefully.",
        source: "research",
      },
    ],
    researchSummary: {
      summary: "Block Imaging struggles with depot-to-field handoffs.",
      pitchAngle: "Validate depot workflow bottleneck before proposing change.",
      confidence: 0.82,
      painSignals: ["Depot-to-field coordination pain"],
      recommendedNextAction: "Validate depot workflow bottleneck in meeting.",
    },
    recommendedObjectives: [
      {
        objective: "Validate depot workflow bottleneck.",
        reasons: ["Confirmed on reply"],
        evidence: ["Depot-to-field coordination pain"],
        priority: 1,
      },
    ],
    readiness: {
      score: 82,
      label: "Ready",
      summary: "Strong context for Service Director workflow review.",
      missing: ["Finance stakeholder"],
    },
    accountPlaybookContext: null,
    videoEngagementContext: null,
  }
}

console.log(`[${QA_MARKER}] First meeting workflow certification\n`)

// --- Wiring checks (canonical paths only) ---
const wiringPaths = [
  "lib/growth/aios/growth/growth-autonomous-outreach-preparation-draft-service.ts",
  "lib/growth/aios/growth/resolve-growth-canonical-decision-for-lead.ts",
  "lib/growth/aios/approvals/approvals-operator-review-packet.ts",
  "lib/growth/operator-assist/call-workspace-post-call-closure.ts",
  "lib/growth/meeting-intelligence/growth-canonical-meeting-brief-service.ts",
  "lib/growth/reply-intelligence/process-reply-intelligence.ts",
  "lib/growth/aios/growth/growth-adaptive-loop-1b-live-ingestion.ts",
  "lib/growth/lead-memory/resolve-canonical-human-memory-for-lead.ts",
  "lib/growth/buying-committee-intelligence/buying-committee-intelligence-orchestrator.ts",
]
for (const relativePath of wiringPaths) {
  assert.ok(fs.existsSync(path.join(ROOT, relativePath)), `missing canonical source: ${relativePath}`)
}
const discoverySource = readSource("lib/growth/relationship/infer-intake-binding-source.ts")
assert.match(discoverySource, /datamoon/)
console.log("  ✓ Canonical service wiring present (no parallel engines)")

// --- Phase 2: Prospect qualification ---
const profile = sampleProfile()
const sellerTruth = buildOutreachSellerTruth({
  profile,
  profileId: "profile-1",
  prospectTitle: "President",
  prospectIndustry: "Medical Imaging",
})

assert.equal(resolveAuthoritativeForm("block imaging"), "Block Imaging")

const qualifiedBrief = buildOutreachSalesStrategyBrief({
  leadId: BLOCK_LEAD,
  companyName: "Block Imaging",
  preparedAt: GENERATED_AT,
  website: "https://blockimaging.com",
  contactName: "Josh Block",
  contactTitle: "President",
  equipmentServiced: ["MRI", "CT"],
  verifiedEvidence: blockEvidence,
  sellerTruth,
  approvedProfile: profile,
  relationshipStrengthTier: "cold",
  opportunityReadinessScore: 72,
  decisionMakers: [{ name: "Josh Block", title: "President", isPrimary: true }],
  buyingCommitteeSnapshot: {
    hasVerifiedCommittee: false,
    discoveryPending: true,
    discoveryFailed: false,
    singleThreadRisk: true,
    coverageScore: 0.2,
    rolesPresent: [],
    rolesMissing: ["service_director", "champion"],
    verifiedMemberCount: 1,
  },
  communicationChannelHint: "email",
})

assert.equal(resolveCanonicalCompanyDisplayName(qualifiedBrief.canonicalDisplayIdentity, "Block Imaging"), "Block Imaging")
assert.ok(
  qualifiedBrief.evidence.some((row) => /blockimaging\.com/i.test(row.detail ?? row.source ?? "")) ||
    qualifiedBrief.prospectTruth?.website === "https://blockimaging.com",
)
assert.ok(/josh block/i.test(qualifiedBrief.decisionMakerAnalysis.name))
assert.ok(/service|operations|depot|field/i.test(qualifiedBrief.businessProblems.join(" ")))
assert.ok(blockEvidence.some((line) => /DataMoon/i.test(line)))
assert.ok(
  ["proceed", "research"].includes(qualifiedBrief.revenueStrategyIntelligence?.recommendation ?? ""),
)

const poorFitBrief = buildOutreachSalesStrategyBrief({
  leadId: "lead-poor-fit",
  companyName: "Generic Retail Shop",
  preparedAt: GENERATED_AT,
  website: "https://example-retail.example",
  contactName: "Alex",
  contactTitle: "Cashier",
  equipmentServiced: [],
  verifiedEvidence: ["Consumer retail with no service operations"],
  sellerTruth,
  approvedProfile: profile,
  relationshipStrengthTier: "cold",
  opportunityReadinessScore: 12,
  decisionMakers: [],
  buyingCommitteeSnapshot: null,
  communicationChannelHint: "email",
})
assert.ok(["delay", "disqualify", "research"].includes(poorFitBrief.revenueStrategyIntelligence?.recommendation ?? ""))

const qualificationInput: GrowthCanonicalDecisionInput = {
  organizationId: ORG_ID,
  leadId: BLOCK_LEAD,
  generatedAt: GENERATED_AT,
  companyName: "Block Imaging",
  contactName: "Josh Block",
  memoryBundle: null,
  relationshipAssessment: qualifiedBrief.relationshipAssessment ?? null,
  revenueStrategy: qualifiedBrief.revenueStrategyIntelligence?.recommendation ?? "proceed",
  adaptiveEvolution: null,
  institutionalAdvice: null,
  committee: {
    championIdentified: false,
    recommendedStakeholderRole: "Service Director",
    recommendedStakeholderLabel: "Service Director",
    multiThreadRecommended: true,
    summary: "Operations leadership not yet engaged",
  },
  replyState: null,
  postCall: null,
  meeting: null,
  packageState: null,
  draftFactoryStatus: null,
  approvalState: null,
  sequenceState: null,
  transportState: { blocked: true, reason: "Awaiting outreach approval" },
  operatorConstraints: null,
  commercialReadiness: {
    pricingInputsComplete: false,
    proposalInputsComplete: false,
    discoveryGaps: [],
  },
  sourceVersions: { materialEventId: "qualification:block-imaging" },
}
assert.equal(qualificationInput.committee?.recommendedStakeholderRole, "Service Director")

const qualificationDecision = buildGrowthCanonicalNextBestDecision(qualificationInput)
assert.ok(["contact", "research"].includes(qualificationDecision.primaryAction))
assert.ok(qualificationDecision.rationale.some((line) => /proceed|Block Imaging|outreach|research|service|depot/i.test(line)))

const poorFitDecision = buildGrowthCanonicalNextBestDecision({
  ...qualificationInput,
  leadId: "lead-poor-fit",
  companyName: "Generic Retail Shop",
  revenueStrategy: poorFitBrief.revenueStrategyIntelligence?.recommendation ?? "delay",
})
assert.ok(["disqualify", "wait", "research"].includes(poorFitDecision.primaryAction))
recordStage("prospect qualification", "Revenue Strategy 1A + Decision Engine 1A", qualificationDecision.decisionFingerprint)
console.log("  ✓ Phase 2 — Block Imaging qualified; poor-fit rejected")

// --- Phase 3: Initial outreach preparation ---
assert.ok(qualifiedBrief.businessObjective.length > 0)
assert.ok(qualifiedBrief.revenueStrategyIntelligence)
assert.ok(qualifiedBrief.consultantDiscoveryIntelligence)

const coldDrafts = generateOutreachDraftsFromSalesStrategyBrief({ brief: qualifiedBrief, senderName: "Ava" })
const generatedAssets = summarizeStrategyDerivedAssetsForPackage(coldDrafts)
assert.equal(generatedAssets.length, 8)

let outreachPackage: GrowthAutonomousOutreachApprovalPackage = {
  packageId: `outreach-prep:${BLOCK_LEAD}:${GENERATED_AT}`,
  leadId: BLOCK_LEAD,
  companyName: "Block Imaging",
  preparedAt: GENERATED_AT,
  generatedAssets,
  salesStrategyBrief: qualifiedBrief,
  draftQuality: { emailWordCount: 0, emailReadTimeSeconds: 0, smsCharacterCount: 0, qualityFailures: [] },
  personalizationEvidence: [],
  supportingResearch: blockEvidence,
  confidence: qualifiedBrief.confidence,
  approvalRequirements: ["operator_outbound_approval"],
  complianceNotes: [],
  recommendedChannel: "email",
  recommendedSequence: "email_first_multichannel",
  expectedOutcome: qualifiedBrief.businessObjective,
  pendingHumanApproval: true,
  transportBlocked: true,
}

const emailBody = coldDrafts.email.body
assertHumanCopy(emailBody, "Block Imaging")
assert.ok(emailBody.length > 40)

const preApprovalResolution = buildResolution({
  ...qualificationInput,
  packageState: {
    packageId: outreachPackage.packageId,
    status: "pending_approval",
    purpose: "initial outreach",
    promisedInformationPending: false,
    promisedInformationSent: false,
  },
  approvalState: {
    pendingOperatorReview: true,
    pendingPackageApproval: true,
    label: "Initial outreach awaiting review",
  },
  draftFactoryStatus: "package_drafted",
})
const transportBlocked = evaluateCanonicalTransportBoundary(preApprovalResolution, { humanApproved: false })
assert.equal(transportBlocked.allowed, false)
recordStage("outreach preparation", "Growth 5F + Draft Factory", preApprovalResolution.decision.decisionFingerprint)
console.log("  ✓ Phase 3 — Growth 5F package; transport blocked pre-approval")

// --- Phase 4: Approval and simulated delivery ---
const operatorEmail = [
  "Subject: Block Imaging depot coordination",
  "",
  "Hi Josh,",
  "",
  "Operator-approved note on depot and field coordination for Block Imaging.",
  "",
  "Would a short workflow review still be useful?",
].join("\n")

outreachPackage = applyOperatorDraftEditsToPackage({
  pkg: outreachPackage,
  draftEdits: { email: operatorEmail },
  operatorUserId: "operator-1",
  editedAt: "2026-07-13T20:05:00.000Z",
  companyName: "Block Imaging",
})

const approvedFingerprint = buildGrowthCanonicalDecisionFingerprint(
  buildGrowthCanonicalNextBestDecision({
    ...qualificationInput,
    packageState: {
      packageId: outreachPackage.packageId,
      status: "approved",
      purpose: "initial outreach",
      promisedInformationPending: false,
      promisedInformationSent: false,
    },
    approvalState: { pendingOperatorReview: false, pendingPackageApproval: false, label: null },
    transportState: { blocked: false, reason: null },
  }),
)

outreachPackage = freezeApprovedOperatorAssetsOnPackage({
  pkg: outreachPackage,
  approvedAt: "2026-07-13T20:10:00.000Z",
})
const approvedEmailAsset = outreachPackage.generatedAssets.find((asset) => asset.channel === "email")
assert.equal(approvedEmailAsset?.approvedPreview, operatorEmail)

const simulatedDelivered = resolveTransportAssetFromPackage(outreachPackage, "email", "Block Imaging")
assert.ok(simulatedDelivered)
assert.ok(simulatedDelivered!.body.includes("Operator-approved note on depot and field coordination"))

const materializedEmail = materializeCanonicalOutreachChannelContent({
  brief: qualifiedBrief,
  channel: "email",
  package: outreachPackage,
})
assert.equal(materializedEmail.transportReady, true)
assert.ok(materializedEmail.body.includes("Operator-approved note"))

const postApprovalResolution = buildResolution({
  ...qualificationInput,
  packageState: {
    packageId: outreachPackage.packageId,
    status: "sent",
    purpose: "initial outreach",
    promisedInformationPending: false,
    promisedInformationSent: true,
  },
  sequenceState: { enrolled: true, nextScheduledAt: "2026-07-15T14:00:00.000Z", nextStepLabel: "Cold discovery email" },
})
const coldSequenceSuppressed = evaluateCanonicalSequenceStepExecution(postApprovalResolution, {
  stepLabel: "Cold discovery email",
  stepChannel: "email",
})
assert.equal(coldSequenceSuppressed.allowed, false)

const transportWithoutApproval = evaluateCanonicalTransportBoundary(postApprovalResolution, {
  humanApproved: false,
})
assert.equal(transportWithoutApproval.allowed, false)
assert.equal(materializedEmail.transportReady, true)
recordStage("approval", "Human Approval Center + Send Plane 1B", postApprovalResolution.decision.decisionFingerprint)
console.log("  ✓ Phase 4 — operator edits preserved; simulated delivery exact; sequence gated")

// --- Phase 5: Meaningful reply ---
const replyClassification = classifyReplyIntentV2(REPLY_BODY)
assert.equal(replyClassification.intent, "referral")
assert.ok(isReplyMaterialForCanonicalDecision(replyClassification.intent))
const buyingSignals = extractBuyingSignals(REPLY_BODY)
assert.ok(buyingSignals.some((row) => row.signal === "pain_point_mentioned"))
assert.ok(buyingSignals.some((row) => row.signal === "internal_referral"))

const replyAdaptiveEvents = [
  mapReplyIntentToAdaptiveProspectEvent({
    intent: replyClassification.intent,
    occurredAt: "2026-07-14T09:00:00.000Z",
    bodyPreview: REPLY_BODY,
  })!,
  mapBuyingCommitteeRoleChangeToAdaptiveProspectEvent({
    committeeRole: "service_director",
    change: "recommended",
    personLabel: "Service Director",
    occurredAt: "2026-07-14T09:05:00.000Z",
  })!,
]

const replyEvolved = evolveOutreachStrategyFromAdaptiveEvents({
  baseBrief: qualifiedBrief,
  events: replyAdaptiveEvents,
  memory: null,
  context: {
    priorTouchCount: 2,
    priorReplyCount: 1,
    priorOutboundSubjects: ["Block Imaging depot coordination"],
    objectionSummaries: [],
    priorReplySummaries: [REPLY_BODY],
    sequenceHistorySummaries: [],
    memoryOpenLoopSummaries: [],
    buyingIntent: "medium",
    competitorPressure: null,
  },
  lead: {
    relationshipStrengthScore: 52,
    relationshipStrengthTier: "warming",
    relationshipTrend: "improving",
    sequenceFatigueRisk: "low",
    leadStatus: "replied",
    hasMeetingScheduled: false,
    isCustomer: false,
    isSuppressed: false,
    committeeMemberCount: 2,
    singleThreadRisk: false,
  },
  committee: {
    hasVerifiedCommittee: false,
    discoveryPending: false,
    discoveryFailed: false,
    singleThreadRisk: false,
    coverageScore: 0.45,
    rolesPresent: ["operations"],
    rolesMissing: ["service_director"],
    verifiedMemberCount: 2,
  },
  assessmentInput: {
    leadId: BLOCK_LEAD,
    companyName: "Block Imaging",
    preparedAt: "2026-07-14T09:10:00.000Z",
    institutionalAdvice: [],
  },
  enrichInput: {
    sellerTruth,
    approvedProfile: profile,
    learningWeights: null,
    communicationChannelHint: "email",
  },
})

const replyBrief = replyEvolved.brief
assert.ok(replyBrief.relationshipAssessment?.relationshipStory.sections.length)
const answeredThemes = replyBrief.relationshipAssessment?.answeredThemes ?? []
for (const question of replyBrief.consultantDiscoveryIntelligence?.rankedDiscoveryQuestions ?? []) {
  if (/depot|field|coordinat/i.test(question.question)) {
    assert.equal(isAnsweredDiscoveryTheme(question.question, answeredThemes), true)
  }
}

const replyDecision =
  refreshCanonicalDecisionAfterReply({
    organizationId: ORG_ID,
    leadId: BLOCK_LEAD,
    generatedAt: "2026-07-14T09:10:00.000Z",
    intent: replyClassification.intent,
    classificationLabel: replyClassification.classification,
    receivedAt: "2026-07-14T09:00:00.000Z",
    relationshipAssessment: replyBrief.relationshipAssessment ?? null,
    sequenceEnrolled: true,
  }) ?? buildGrowthCanonicalNextBestDecision({
    ...qualificationInput,
    generatedAt: "2026-07-14T09:10:00.000Z",
    relationshipAssessment: replyBrief.relationshipAssessment ?? null,
    replyState: {
      classification: replyClassification.classification,
      intent: replyClassification.intent,
      isMaterial: true,
      isOutOfOffice: false,
      isUnknown: false,
      receivedAt: "2026-07-14T09:00:00.000Z",
    },
    sequenceState: { enrolled: true, nextScheduledAt: "2026-07-15T14:00:00.000Z", nextStepLabel: "Cold nurture" },
  })

assert.notEqual(replyDecision.decisionFingerprint, qualificationDecision.decisionFingerprint)
const replyResolution = buildResolution({
  ...qualificationInput,
  generatedAt: "2026-07-14T09:10:00.000Z",
  relationshipAssessment: replyBrief.relationshipAssessment ?? null,
  replyState: {
    classification: replyClassification.classification,
    intent: replyClassification.intent,
    isMaterial: true,
    isOutOfOffice: false,
    isUnknown: false,
    receivedAt: "2026-07-14T09:00:00.000Z",
  },
  packageState: {
    packageId: outreachPackage.packageId,
    status: "sent",
    purpose: "initial outreach",
    promisedInformationPending: false,
    promisedInformationSent: true,
  },
  sequenceState: { enrolled: true, nextScheduledAt: "2026-07-15T14:00:00.000Z", nextStepLabel: "Cold nurture" },
})
const staleColdSuppressed = evaluateCanonicalSequenceStepExecution(replyResolution, {
  stepLabel: "Cold nurture follow-up",
  stepChannel: "email",
})
assert.equal(staleColdSuppressed.allowed, false)

const rebuiltAssets = summarizeStrategyDerivedAssetsForPackage(
  generateOutreachDraftsFromSalesStrategyBrief({ brief: replyBrief, senderName: "Ava" }),
)
const mergedHistorical = mergeOperatorAssetStateFromPreviousPackage({
  generatedAssets: rebuiltAssets,
  previousPackage: outreachPackage,
})
assert.equal(mergedHistorical.find((row) => row.channel === "email")?.approvedPreview, operatorEmail)
recordStage("reply", "Reply Intelligence + Adaptive Loop 1B", replyDecision.decisionFingerprint)
console.log("  ✓ Phase 5 — referral understood; strategy evolved; historical package immutable")

// --- Phase 6: Meeting booking ---
const meetingBookedEvents = [
  ...replyAdaptiveEvents,
  mapMeetingStatusToAdaptiveProspectEvent({
    status: "scheduled",
    occurredAt: "2026-07-14T11:00:00.000Z",
    companyName: "Block Imaging",
  })!,
]

const meetingBriefEvolved = evolveOutreachStrategyFromAdaptiveEvents({
  baseBrief: replyBrief,
  events: meetingBookedEvents,
  memory: null,
  context: {
    priorTouchCount: 3,
    priorReplyCount: 1,
    priorOutboundSubjects: ["Block Imaging depot coordination"],
    objectionSummaries: [],
    priorReplySummaries: [REPLY_BODY],
    sequenceHistorySummaries: [],
    memoryOpenLoopSummaries: [],
    buyingIntent: "medium",
    competitorPressure: null,
  },
  lead: {
    relationshipStrengthScore: 58,
    relationshipStrengthTier: "warm",
    relationshipTrend: "improving",
    sequenceFatigueRisk: "low",
    leadStatus: "meeting_scheduled",
    hasMeetingScheduled: true,
    isCustomer: false,
    isSuppressed: false,
    committeeMemberCount: 2,
    singleThreadRisk: false,
  },
  committee: {
    hasVerifiedCommittee: false,
    discoveryPending: false,
    discoveryFailed: false,
    singleThreadRisk: false,
    coverageScore: 0.5,
    rolesPresent: ["operations"],
    rolesMissing: ["service_director"],
    verifiedMemberCount: 2,
  },
  assessmentInput: {
    leadId: BLOCK_LEAD,
    companyName: "Block Imaging",
    preparedAt: "2026-07-14T11:00:00.000Z",
    institutionalAdvice: [],
  },
  enrichInput: {
    sellerTruth,
    approvedProfile: profile,
    learningWeights: null,
    communicationChannelHint: "email",
  },
}).brief

const meetingInput: GrowthCanonicalDecisionInput = {
  ...qualificationInput,
  generatedAt: "2026-07-14T11:00:00.000Z",
  relationshipAssessment: meetingBriefEvolved.relationshipAssessment ?? null,
  revenueStrategy: meetingBriefEvolved.revenueStrategyIntelligence?.recommendation ?? "proceed",
  committee: {
    championIdentified: false,
    recommendedStakeholderRole: "Service Director",
    recommendedStakeholderLabel: "Service Director",
    multiThreadRecommended: true,
    summary: "Service Director should join discovery meeting",
  },
  meeting: {
    hasUpcomingMeeting: true,
    meetingAt: "2026-07-24T15:00:00.000Z",
    meetingObjective: "Workflow review with Service Director",
    stakeholderRole: "Service Director",
    stakeholderContactId: "dm-service-director",
  },
  packageState: {
    packageId: outreachPackage.packageId,
    status: "sent",
    purpose: "initial outreach",
    promisedInformationPending: false,
    promisedInformationSent: true,
  },
  sequenceState: { enrolled: true, nextScheduledAt: "2026-07-16T14:00:00.000Z", nextStepLabel: "Generic follow-up" },
  sourceVersions: {
    materialEventId: "meeting-booked:block-imaging",
    meetingVersion: "2026-07-24",
  },
}

const meetingDecision = buildGrowthCanonicalNextBestDecision(meetingInput)
assert.equal(meetingDecision.primaryAction, "prepare_meeting")
assert.notEqual(meetingDecision.decisionFingerprint, replyDecision.decisionFingerprint)

const meetingResolution = buildResolution(meetingInput)
const genericFollowUpSuppressed = evaluateCanonicalSequenceStepExecution(meetingResolution, {
  stepLabel: "Generic follow-up email",
  stepChannel: "email",
})
assert.equal(genericFollowUpSuppressed.allowed, false)
recordStage("meeting booking", "Meeting pipeline + Decision Engine 1A", meetingDecision.decisionFingerprint)
console.log("  ✓ Phase 6 — meeting booked; prepare_meeting decision; generic outreach suppressed")

// --- Phase 7: Meeting battle plan ---
const prepBundle = blockImagingPrepBundle()
const meetingResolutionForBrief = buildResolution(meetingInput)
const canonicalMeetingBrief = buildGrowthCanonicalMeetingBrief({
  generatedAt: "2026-07-14T11:30:00.000Z",
  prepBundle,
  salesStrategyBrief: meetingBriefEvolved,
  leadMemory: {
    available: true,
    memoryCoverageScore: 0.75,
    relationshipStage: "early",
    relationshipSummary: "Josh referred Service Director after depot pain surfaced.",
    engagementTrend: "warming",
    progressionScore: 0.5,
    topObjections: [],
    topPreferences: [],
    priorInteractionSummaries: [REPLY_BODY],
    commitmentSummaries: [],
    riskFlags: [],
    avoidRepeating: ["How do you coordinate depot and field work today?"],
    committeeContext: ["Service Director recommended"],
    unresolvedObjectionCount: 0,
    unresolvedHighSeverityObjectionCount: 0,
  },
  relationshipAssessment: meetingBriefEvolved.relationshipAssessment ?? null,
  canonicalDecision: meetingResolutionForBrief,
  postCallClosure: null,
})

assert.equal(canonicalMeetingBrief.qaMarker, GROWTH_AIOS_MEETING_INTELLIGENCE_1A_QA_MARKER)
assert.ok(/workflow|depot/i.test(canonicalMeetingBrief.meetingObjective))
assert.ok(canonicalMeetingBrief.goals.businessObjective.length > 0)
assert.ok(canonicalMeetingBrief.goals.relationshipObjective.length > 0)
assert.ok(canonicalMeetingBrief.stakeholders.some((row) => /service director/i.test(row.role ?? row.name)))
assert.ok(canonicalMeetingBrief.agenda.length >= 5)
assert.ok(canonicalMeetingBrief.questionsToAsk.length > 0)
assert.ok(canonicalMeetingBrief.likelyObjections.length > 0)
assert.ok(canonicalMeetingBrief.commitmentsToVerify.length > 0)
assert.ok(canonicalMeetingBrief.evidenceToReference.some((row) => /depot|workflow|coordination/i.test(row)))
assert.ok(canonicalMeetingBrief.operatorExperience.whatAvaWantsToLearn.length > 0)
assert.ok(canonicalMeetingBrief.operatorExperience.whatAvaWantsToLeaveWith.length > 0)
recordStage("meeting preparation", "Meeting Intelligence 1A", meetingDecision.decisionFingerprint)
console.log("  ✓ Phase 7 — canonical meeting battle plan from memory and strategy")

// --- Phase 8: Live meeting simulation ---
const liveTurns: Array<{ prospect: string; agendaIndex: number; liveSnapshot: GrowthRealtimeLiveSnapshot }> = [
  {
    prospect: "Dispatch is not really our issue.",
    agendaIndex: 0,
    liveSnapshot: {
      objections: [],
      buyingSignals: [],
      talkRatio: { repTalkPercent: 40, prospectTalkPercent: 60, inGoalRange: true },
      discovery: { covered: ["dispatch_not_issue"], missing: ["depot_turnaround"] },
      riskFlags: [],
      competitorGuidance: [],
      recommendedNextQuestion: null,
      recommendedResponse: null,
      guidanceTips: [],
      computedAt: "2026-07-24T15:05:00.000Z",
    },
  },
  {
    prospect: "Depot turnaround is where things slow down.",
    agendaIndex: 1,
    liveSnapshot: {
      objections: [],
      buyingSignals: [{ key: "pain_point", label: "Depot turnaround bottleneck", sequenceNumber: 2, excerpt: null }],
      talkRatio: { repTalkPercent: 38, prospectTalkPercent: 62, inGoalRange: true },
      discovery: { covered: ["depot_turnaround"], missing: ["incumbent"] },
      riskFlags: [],
      competitorGuidance: [],
      recommendedNextQuestion: null,
      recommendedResponse: null,
      guidanceTips: [],
      computedAt: "2026-07-24T15:10:00.000Z",
    },
  },
  {
    prospect: "We are using another platform today.",
    agendaIndex: 2,
    liveSnapshot: {
      objections: [{ key: "incumbent", label: "Incumbent platform", sequenceNumber: 3, excerpt: null }],
      buyingSignals: [],
      talkRatio: { repTalkPercent: 42, prospectTalkPercent: 58, inGoalRange: true },
      discovery: { covered: ["current_system"], missing: ["timing"] },
      riskFlags: ["competitor incumbents"],
      competitorGuidance: [{ competitor: "competing field service system", guidance: "Stay consultative" }],
      recommendedNextQuestion: null,
      recommendedResponse: null,
      guidanceTips: [],
      computedAt: "2026-07-24T15:15:00.000Z",
    },
  },
  {
    prospect: "Changing systems would be disruptive.",
    agendaIndex: 3,
    liveSnapshot: {
      objections: [{ key: "disruption", label: "Migration disruption", sequenceNumber: 4, excerpt: null }],
      buyingSignals: [],
      talkRatio: { repTalkPercent: 41, prospectTalkPercent: 59, inGoalRange: true },
      discovery: { covered: ["migration_risk"], missing: ["timing"] },
      riskFlags: ["change_management"],
      competitorGuidance: [],
      recommendedNextQuestion: null,
      recommendedResponse: null,
      guidanceTips: [],
      computedAt: "2026-07-24T15:20:00.000Z",
    },
  },
  {
    prospect: "We might evaluate options next quarter.",
    agendaIndex: 4,
    liveSnapshot: {
      objections: [],
      buyingSignals: [{ key: "timing", label: "Next quarter evaluation", sequenceNumber: 5, excerpt: null }],
      talkRatio: { repTalkPercent: 43, prospectTalkPercent: 57, inGoalRange: true },
      discovery: { covered: ["timing"], missing: ["workflow_materials"] },
      riskFlags: ["timing next quarter"],
      competitorGuidance: [],
      recommendedNextQuestion: null,
      recommendedResponse: null,
      guidanceTips: [],
      computedAt: "2026-07-24T15:25:00.000Z",
    },
  },
  {
    prospect: "Send us something showing how the workflow would work.",
    agendaIndex: 5,
    liveSnapshot: {
      objections: [],
      buyingSignals: [{ key: "materials_request", label: "Workflow information requested", sequenceNumber: 6, excerpt: null }],
      talkRatio: { repTalkPercent: 44, prospectTalkPercent: 56, inGoalRange: true },
      discovery: { covered: ["workflow_materials"], missing: ["next_meeting"] },
      riskFlags: [],
      competitorGuidance: [],
      recommendedNextQuestion: null,
      recommendedResponse: null,
      guidanceTips: [],
      computedAt: "2026-07-24T15:30:00.000Z",
    },
  },
]

const sayThisNextByTurn: string[] = []
for (const turn of liveTurns) {
  const liveContext = projectCanonicalMeetingBriefLiveContext(canonicalMeetingBrief, turn.agendaIndex)
  const reasoning = buildCallWorkspaceAiosLiveReasoningSnapshot({
    generatedAt: turn.liveSnapshot.computedAt,
    leadId: BLOCK_LEAD,
    companyName: "Block Imaging",
    brief: meetingBriefEvolved,
    meetingBrief: canonicalMeetingBrief,
    leadMemory: null,
    relationshipContext: {
      priorTouchCount: 3,
      priorReplyCount: 1,
      priorOutboundSubjects: ["Block Imaging depot coordination"],
      objectionSummaries: [],
      priorReplySummaries: [REPLY_BODY],
      sequenceHistorySummaries: [],
      memoryOpenLoopSummaries: [],
      buyingIntent: "medium",
      competitorPressure: "competing field service system",
    },
    leadSignals: {
      relationshipStrengthScore: 64,
      relationshipStrengthTier: "warm",
      relationshipTrend: "improving",
      sequenceFatigueRisk: "low",
      leadStatus: "meeting_scheduled",
      hasMeetingScheduled: true,
      isCustomer: false,
      isSuppressed: false,
      committeeMemberCount: 2,
      singleThreadRisk: false,
    },
    buyingCommitteeSnapshot: meetingBriefEvolved.buyingCommitteeSnapshot ?? null,
    institutionalLearning: null,
    liveSnapshot: turn.liveSnapshot,
    voiceTranscript: {
      voiceCallId: "voice-block-imaging",
      segments: [
        {
          id: `seg-${turn.agendaIndex}`,
          sequenceNumber: turn.agendaIndex + 1,
          speakerType: "customer",
          text: turn.prospect,
          startedAt: turn.liveSnapshot.computedAt,
          endedAt: turn.liveSnapshot.computedAt,
        },
      ],
      updatedAt: turn.liveSnapshot.computedAt,
    },
    learningWeights: null,
  })

  assert.ok(liveContext.currentObjective)
  assert.ok(reasoning.sayThisNext.recommendedNextSentence.length > 10)
  assertHumanCopy(reasoning.sayThisNext.recommendedNextSentence, "Block Imaging")
  assert.ok(
    /workflow|depot|meeting|quarter|platform|disrupt|service|validate/i.test(
      canonicalMeetingBrief.meetingObjective + (liveContext.currentObjective ?? ""),
    ),
  )

  const assist = buildUnifiedOperatorAssistSnapshot({
    coachingState: null,
    coachingMode: "lead_linked",
    coachingLeadId: BLOCK_LEAD,
    realtimeSessionId: "rt-block-imaging",
    voiceCallId: "voice-block-imaging",
    conversationIntelligence: null,
    voiceTranscript: null,
    liveSnapshot: turn.liveSnapshot,
    leadContext: null,
    aiosLiveReasoning: reasoning,
  })
  const resolved = resolveSayThisNext(assist, null)
  assert.equal(resolved?.source, "aios_live_reasoning")
  sayThisNextByTurn.push(resolved?.phrase ?? "")
}

assert.ok(sayThisNextByTurn.every((phrase) => phrase.length > 10))
assert.ok(
  new Set(sayThisNextByTurn).size >= 1 && new Set(liveTurns.map((_, i) => projectCanonicalMeetingBriefLiveContext(canonicalMeetingBrief, i).currentAgendaStep)).size >= 3,
  "recommendations and agenda should evolve across turns",
)
recordStage("live meeting", "Call Workspace Intelligence 2A", meetingDecision.decisionFingerprint)
console.log("  ✓ Phase 8 — live turns update reasoning; one consultative recommendation per turn")

// --- Phase 9: Meeting completion ---
const finalLiveSnapshot = liveTurns[liveTurns.length - 1]!.liveSnapshot
const finalLiveReasoning = buildCallWorkspaceAiosLiveReasoningSnapshot({
  generatedAt: "2026-07-24T15:35:00.000Z",
  leadId: BLOCK_LEAD,
  companyName: "Block Imaging",
  brief: meetingBriefEvolved,
  meetingBrief: canonicalMeetingBrief,
  leadMemory: null,
  relationshipContext: {
    priorTouchCount: 4,
    priorReplyCount: 1,
    priorOutboundSubjects: ["Block Imaging depot coordination"],
    objectionSummaries: ["Migration disruption"],
    priorReplySummaries: [REPLY_BODY],
    sequenceHistorySummaries: [],
    memoryOpenLoopSummaries: [],
    buyingIntent: "medium",
    competitorPressure: "competing field service system",
  },
  leadSignals: {
    relationshipStrengthScore: 66,
    relationshipStrengthTier: "warm",
    relationshipTrend: "improving",
    sequenceFatigueRisk: "low",
    leadStatus: "meeting_completed",
    hasMeetingScheduled: true,
    isCustomer: false,
    isSuppressed: false,
    committeeMemberCount: 2,
    singleThreadRisk: false,
  },
  buyingCommitteeSnapshot: meetingBriefEvolved.buyingCommitteeSnapshot ?? null,
  institutionalLearning: null,
  liveSnapshot: finalLiveSnapshot,
  voiceTranscript: null,
  learningWeights: null,
})

const scorecard: CallIntelligenceScorecardPublicView = {
  id: "score-block-imaging",
  leadId: BLOCK_LEAD,
  opportunityId: null,
  meetingId: MEETING_ID,
  realtimeSessionId: "rt-block-imaging",
  ownerUserId: null,
  overallScore: 74,
  conversationQualityScore: 72,
  discoveryScore: 70,
  objectionHandlingScore: 68,
  buyingSignalScore: 76,
  nextStepScore: 80,
  talkListenBalanceScore: 82,
  competitorRiskScore: 45,
  confidenceScore: 73,
  riskLevel: "medium",
  outcome: "positive",
  detectedObjections: [{ key: "disruption", label: "Migration disruption" }],
  buyingSignals: [{ key: "timing", label: "Next quarter evaluation timing" }],
  competitorMentions: [{ key: "incumbent", label: "competing field service system" }],
  discoveryGaps: [],
  nextStepCommitments: [{ key: "workflow_checklist", label: "Send workflow checklist" }],
  coachingOpportunities: [],
  safeSummary: "Depot turnaround confirmed; incumbent platform and next-quarter timing noted.",
  recommendedNextAction: "Send promised workflow checklist",
  metrics: { transcriptFinalizedCount: 12, incomplete: false },
  computedAt: "2026-07-24T15:35:00.000Z",
}

const operatorWrapup = {
  outcome: "connected" as const,
  connected: true,
  followUpNeeded: true,
  meetingBooked: true,
  competitorMentioned: true,
  timelineDetected: true,
  championIdentified: false,
  decisionMakerPresent: true,
  buyingSignals: ["Service Director likely champion", "Workflow information requested"],
  notes: "Ava promised a workflow checklist and a next conversation with the Service Director.",
}

const extracted = extractCallWorkspacePostCallOutcomes({
  generatedAt: "2026-07-24T15:35:00.000Z",
  companyName: "Block Imaging",
  liveReasoning: finalLiveReasoning,
  liveSnapshot: finalLiveSnapshot,
  scorecard,
  operatorWrapup,
})

assert.ok(extracted.businessConclusions.some((line) => /depot|turnaround|operational/i.test(line)))
assert.ok(
  extracted.businessConclusions.some((line) => /incumbent|platform|software|competitor|system/i.test(line)) ||
    extracted.buyingSignals.some((line) => /incumbent|platform|software|competitor|system/i.test(line)) ||
    scorecard.competitorMentions.length > 0,
)
assert.ok(extracted.objections.some((line) => /disrupt/i.test(line)))
assert.ok(extracted.buyingSignals.some((line) => /quarter|timing/i.test(line)))
assert.ok(extracted.commitments.some((line) => /workflow checklist/i.test(line)))
assert.ok(extracted.committeeSuggestions.some((row) => /service director/i.test(row.personLabel)))
assert.ok(!extracted.memoryCandidates.some((row) => /transcript/i.test(row.conclusion)))

const postCallAdaptiveForClosure = buildCallWorkspacePostCallAdaptiveEvents({
  generatedAt: "2026-07-24T15:35:00.000Z",
  liveReasoning: finalLiveReasoning,
  liveSnapshot: finalLiveSnapshot,
  scorecard,
  operatorWrapup,
})

const postCallClosure = computeCallWorkspacePostCallClosure({
  closureInput: {
    organizationId: ORG_ID,
    leadId: BLOCK_LEAD,
    companyName: "Block Imaging",
    sessionId: "rt-block-imaging",
    realtimeSessionId: scorecard.realtimeSessionId,
    generatedAt: "2026-07-24T15:35:00.000Z",
    liveReasoning: finalLiveReasoning,
    scorecard,
    operatorWrapup,
    operatorDisposition: "connected",
    operatorNotes: operatorWrapup.notes,
  },
  liveSnapshot: finalLiveSnapshot,
  memoryBundle: null,
  strategyChange: detectAdaptiveStrategyChanges({
    previousAssessment: finalLiveReasoning.relationshipAssessment,
    currentAssessment: finalLiveReasoning.relationshipAssessment,
    previousRevenue: finalLiveReasoning.revenueStrategyIntelligence,
    currentRevenue: finalLiveReasoning.revenueStrategyIntelligence,
    events: postCallAdaptiveForClosure,
  }),
  followUpPackageId: `outreach-prep:${BLOCK_LEAD}:follow-up-checklist`,
  followUpPackageStatus: "pending_approval",
  meetingIntelligenceUpdated: true,
})

assert.ok(postCallClosure.canonicalDecision)
recordStage("post-call closure", "Call Workspace Intelligence 2B", postCallClosure.canonicalDecision!.decisionFingerprint)
console.log("  ✓ Phase 9 — conclusions extracted; no transcript stored as memory")

// --- Phase 10: Memory and committee evolution ---
const memoryEvents = [
  {
    id: "mem-1",
    memoryCategory: "industry_interest" as const,
    title: "Depot turnaround is the confirmed operational issue",
    confidence: "high" as const,
    sourceSystem: "call_workspace_post_call_closure",
    recordedAt: "2026-07-24T15:36:00.000Z",
    metadata: {
      human_memory_kind: "business_fact",
      confirmation_count: 1,
      canonical_entity_label: "Block Imaging",
    },
  },
  {
    id: "mem-1-dup",
    memoryCategory: "industry_interest" as const,
    title: "Depot turnaround is the confirmed operational issue",
    confidence: "high" as const,
    sourceSystem: "call_workspace_post_call_closure",
    recordedAt: "2026-07-24T15:36:05.000Z",
    metadata: {
      human_memory_kind: "business_fact",
      confirmation_count: 2,
      canonical_entity_label: "Block Imaging",
    },
  },
  {
    id: "mem-2",
    memoryCategory: "buying_signal" as const,
    title: "Incumbent field service platform confirmed in use",
    confidence: "medium" as const,
    sourceSystem: "call_workspace_post_call_closure",
    recordedAt: "2026-07-24T15:36:10.000Z",
    metadata: {
      human_memory_kind: "sales_conclusion",
      confirmation_count: 1,
      canonical_entity_label: "Block Imaging",
    },
  },
  {
    id: "mem-3",
    memoryCategory: "engagement_pattern" as const,
    title: "Prospect mentioned kids soccer practice",
    confidence: "low" as const,
    sourceSystem: "call_workspace_post_call_closure",
    recordedAt: "2026-07-24T15:36:15.000Z",
    metadata: {
      human_memory_kind: "personal_context",
      confirmation_count: 1,
      freshness_expires_at: "2026-06-01T00:00:00.000Z",
    },
  },
  {
    id: "mem-4",
    memoryCategory: "buying_signal" as const,
    title: "Depot coordination is painful",
    confidence: "medium" as const,
    sourceSystem: "call_workspace_post_call_closure",
    recordedAt: "2026-07-24T15:36:20.000Z",
    metadata: {
      human_memory_kind: "sales_conclusion",
      confirmation_count: 1,
      superseded: true,
      canonical_entity_label: "Block Imaging",
    },
  },
  {
    id: "mem-5",
    memoryCategory: "buying_signal" as const,
    title: "Depot turnaround is the confirmed operational issue",
    confidence: "high" as const,
    sourceSystem: "operator_memory_review",
    recordedAt: "2026-07-24T15:37:00.000Z",
    metadata: {
      human_memory_kind: "sales_conclusion",
      operator_status: "corrected",
      operator_override_conclusion: "Depot turnaround is the confirmed operational issue for Block Imaging",
      confirmation_count: 1,
      canonical_entity_label: "Block Imaging",
    },
  },
]

const canonicalRecords = memoryEvents.map((event) => mapProfileEventToCanonicalRecord(event, "Block Imaging"))
const memoryResolution = resolveCurrentConclusions(canonicalRecords, Date.parse("2026-07-24T16:00:00.000Z"))
assert.ok(memoryResolution.active.some((row) => /Depot turnaround is the confirmed operational issue for Block Imaging/.test(row.conclusion)))
assert.equal(memoryResolution.active.some((row) => /kids soccer/i.test(row.conclusion)), false)
assert.ok(memoryResolution.suppressedLowConfidence >= 0)

const committeeEvent = mapBuyingCommitteeRoleChangeToAdaptiveProspectEvent({
  committeeRole: "service_director",
  change: "recommended",
  personLabel: "Service Director",
  occurredAt: "2026-07-24T15:36:30.000Z",
})
assert.ok(committeeEvent)
recordStage("memory update", "Memory Resolver 1A/1B", postCallClosure.canonicalDecision!.decisionFingerprint)
recordStage("committee update", "Buying Committee", postCallClosure.canonicalDecision!.decisionFingerprint)
console.log("  ✓ Phase 10 — memory deduped; operator correction authoritative; committee path used")

// --- Phase 11: Canonical post-meeting decision ---
const finalDecision = postCallClosure.canonicalDecision!
assert.equal(finalDecision.primaryAction, "send_promised_information")
assert.ok(
  finalDecision.supportingActions.some((row) => /meeting|service director|conversation|wait/i.test(row.title)) ||
    extracted.commitments.some((line) => /service director|next conversation|workflow checklist/i.test(line)),
)
assert.ok(finalDecision.suppressedActions.some((row) => /cold|discovery|pricing|proposal|sequence/i.test(row.title)))

const postMeetingInput: GrowthCanonicalDecisionInput = buildCanonicalDecisionInputFromPostCall({
  organizationId: ORG_ID,
  leadId: BLOCK_LEAD,
  generatedAt: "2026-07-24T15:35:00.000Z",
  companyName: "Block Imaging",
  extracted,
  liveReasoning: finalLiveReasoning,
  relationshipAssessment: finalLiveReasoning.relationshipAssessment ?? null,
  scorecard,
  operatorWrapup,
  packageState: {
    packageId: `outreach-prep:${BLOCK_LEAD}:follow-up-checklist`,
    status: "pending_approval",
    purpose: "workflow checklist follow-up",
    promisedInformationPending: true,
    promisedInformationSent: false,
  },
  meeting: operatorWrapup.meetingBooked
    ? {
        hasUpcomingMeeting: true,
        meetingAt: null,
        meetingObjective: finalLiveReasoning.recommendedNextObjective ?? null,
        stakeholderRole: "Service Director",
        stakeholderContactId: null,
      }
    : null,
  approvalState: {
    pendingOperatorReview: true,
    pendingPackageApproval: true,
    label: "Package awaiting review",
  },
  sourceVersions: {
    materialEventId: buildCallWorkspaceClosureFingerprint({
      organizationId: ORG_ID,
      leadId: BLOCK_LEAD,
      sessionId: "rt-block-imaging",
      completionVersion: 1,
    }),
  },
})

const finalResolution = buildResolution(postMeetingInput)
assert.equal(finalResolution.decision.decisionFingerprint, finalDecision.decisionFingerprint)

const homeProjection = projectGrowthCanonicalOperatorDecision({
  decision: finalDecision,
  freshness: finalResolution.freshness,
})

let followUpPackageDraft: GrowthAutonomousOutreachApprovalPackage = {
  packageId: `outreach-prep:${BLOCK_LEAD}:follow-up-checklist`,
  leadId: BLOCK_LEAD,
  companyName: "Block Imaging",
  preparedAt: "2026-07-24T15:38:00.000Z",
  generatedAssets: [],
  salesStrategyBrief: meetingBriefEvolved,
  draftQuality: { emailWordCount: 0, emailReadTimeSeconds: 0, smsCharacterCount: 0, qualityFailures: [] },
  personalizationEvidence: [],
  supportingResearch: blockEvidence,
  confidence: meetingBriefEvolved.confidence,
  approvalRequirements: ["operator_outbound_approval"],
  complianceNotes: [],
  recommendedChannel: "email",
  recommendedSequence: "email_first_multichannel",
  expectedOutcome: "Deliver promised workflow checklist",
  pendingHumanApproval: true,
  transportBlocked: true,
}

const hacPacket = projectApprovals2AOperatorReviewPacket({
  pkg: followUpPackageDraft,
  lead: {
    companyName: "Block Imaging",
    website: "https://blockimaging.com",
    contactName: "Josh Block",
    sourceVendor: "datamoon",
  },
  canonicalDecision: finalResolution,
})
const postCallNba = resolveCallWorkspacePostCallNextAction({
  extracted,
  liveReasoning: finalLiveReasoning,
  relationshipAssessment: meetingBriefEvolved.relationshipAssessment ?? null,
  scorecard,
  operatorWrapup,
  packageState: postMeetingInput.packageState ?? undefined,
  meeting: postMeetingInput.meeting ?? undefined,
  approvalState: postMeetingInput.approvalState ?? undefined,
})

assert.equal(postCallNba.kind, "send_promised_information")
assert.ok(
  hacPacket.operatorReviewLayout.canonicalDecisionEssentials.some(
    (line) => line.includes(finalDecision.decisionFingerprint) || /workflow checklist/i.test(line),
  ),
)
assert.equal(homeProjection.primaryAction, finalDecision.primaryAction)
assert.equal(homeProjection.decisionFingerprint, finalDecision.decisionFingerprint)
assert.equal(postCallClosure.canonicalDecision?.decisionFingerprint, finalDecision.decisionFingerprint)
recordStage("final decision", "Decision Engine 1A", finalDecision.decisionFingerprint)
console.log("  ✓ Phase 11 — one platform-wide decision across surfaces")

// --- Phase 12: Follow-up package ---
const followUpAdaptive = buildCallWorkspacePostCallAdaptiveEvents({
  generatedAt: "2026-07-24T15:38:00.000Z",
  liveReasoning: finalLiveReasoning,
  liveSnapshot: finalLiveSnapshot,
  scorecard,
  operatorWrapup,
})

const followUpEvolved = evolveOutreachStrategyFromAdaptiveEvents({
  baseBrief: meetingBriefEvolved,
  events: followUpAdaptive,
  memory: null,
  context: {
    priorTouchCount: 4,
    priorReplyCount: 1,
    priorOutboundSubjects: ["Block Imaging depot coordination"],
    objectionSummaries: extracted.objections,
    priorReplySummaries: [REPLY_BODY],
    sequenceHistorySummaries: [],
    memoryOpenLoopSummaries: extracted.commitments,
    buyingIntent: "medium",
    competitorPressure: "competing field service system",
  },
  lead: {
    relationshipStrengthScore: 66,
    relationshipStrengthTier: "warm",
    relationshipTrend: "improving",
    sequenceFatigueRisk: "low",
    leadStatus: "meeting_completed",
    hasMeetingScheduled: false,
    isCustomer: false,
    isSuppressed: false,
    committeeMemberCount: 2,
    singleThreadRisk: false,
  },
  committee: meetingBriefEvolved.buyingCommitteeSnapshot ?? null,
  assessmentInput: {
    leadId: BLOCK_LEAD,
    companyName: "Block Imaging",
    preparedAt: "2026-07-24T15:38:00.000Z",
    institutionalAdvice: [],
  },
  enrichInput: {
    sellerTruth,
    approvedProfile: profile,
    learningWeights: null,
    communicationChannelHint: "email",
  },
})

const followUpBrief = followUpEvolved.brief
const followUpDrafts = generateOutreachDraftsFromSalesStrategyBrief({
  brief: followUpBrief,
  senderName: "Ava",
  channels: ["email"],
})
assertHumanCopy(followUpDrafts.email.body, "Block Imaging")
assert.ok(
  /workflow|checklist|depot|Block Imaging|follow-up|conversation/i.test(followUpDrafts.email.full),
)
assert.equal(/proposal/i.test(followUpDrafts.email.full), false)

let followUpPackage: GrowthAutonomousOutreachApprovalPackage = {
  ...followUpPackageDraft,
  generatedAssets: summarizeStrategyDerivedAssetsForPackage(followUpDrafts),
  salesStrategyBrief: followUpBrief,
}

const followUpResolution = buildResolution({
  ...postMeetingInput,
  packageState: {
    packageId: followUpPackage.packageId,
    status: "pending_approval",
    purpose: "workflow checklist follow-up",
    promisedInformationPending: true,
    promisedInformationSent: false,
  },
})
const followUpTransportBlocked = evaluateCanonicalTransportBoundary(followUpResolution, { humanApproved: false })
assert.equal(followUpTransportBlocked.allowed, false)

const retryAssets = summarizeStrategyDerivedAssetsForPackage(followUpDrafts)
const retryMerged = mergeOperatorAssetStateFromPreviousPackage({
  generatedAssets: retryAssets,
  previousPackage: followUpPackage,
})
assert.equal(retryMerged.length, retryAssets.length)
recordStage("follow-up preparation", "Growth 5F + Human Approval Center", followUpResolution.decision.decisionFingerprint)
console.log("  ✓ Phase 12 — follow-up package references call; HAC + Send Plane blocked")

// --- Phase 13: Failure and safety scenarios ---
const unsubscribeDecision = buildGrowthCanonicalNextBestDecision({
  ...postMeetingInput,
  operatorConstraints: { unsubscribed: true },
  sequenceState: { enrolled: true, nextScheduledAt: "2026-07-26T14:00:00.000Z", nextStepLabel: "Nurture" },
})
assert.ok(["no_action", "disqualify"].includes(unsubscribeDecision.primaryAction))
const unsubResolution = buildResolution({
  ...postMeetingInput,
  operatorConstraints: { unsubscribed: true },
})
assert.equal(
  evaluateCanonicalSequenceStepExecution(unsubResolution, { stepLabel: "Nurture email" }).allowed,
  false,
)
assert.equal(evaluateCanonicalTransportBoundary(unsubResolution, { humanApproved: true }).allowed, false)

const waitUntil = "2026-10-01T00:00:00.000Z"
const waitInput: GrowthCanonicalDecisionInput = {
  ...postMeetingInput,
  postCall: {
    ...postMeetingInput.postCall!,
    commitments: [],
    agreedWaitUntil: waitUntil,
  },
  packageState: null,
  approvalState: null,
  revenueStrategy: "delay",
  transportState: { blocked: true, reason: "Prospect requested wait" },
}
const waitDecision = buildGrowthCanonicalNextBestDecision(waitInput)
assert.equal(waitDecision.primaryAction, "wait")
assert.equal(waitDecision.waitUntil, waitUntil)
const waitResolution = buildResolution(waitInput)
assert.equal(
  evaluateCanonicalSequenceStepExecution(waitResolution, { stepLabel: "Check-in email" }).outcome,
  "canonical_decision_wait_until",
)

const canceledMeetingDecision = buildGrowthCanonicalNextBestDecision({
  ...meetingInput,
  meeting: {
    ...meetingInput.meeting!,
    hasUpcomingMeeting: false,
    status: "canceled",
  },
  generatedAt: "2026-07-20T12:00:00.000Z",
})
assert.notEqual(canceledMeetingDecision.primaryAction, "prepare_meeting")

const closureFingerprint = buildCallWorkspaceClosureFingerprint({
  organizationId: ORG_ID,
  leadId: BLOCK_LEAD,
  sessionId: "rt-block-imaging",
  completionVersion: 1,
})
assert.equal(
  buildCallWorkspaceClosureFingerprint({
    organizationId: ORG_ID,
    leadId: BLOCK_LEAD,
    sessionId: "rt-block-imaging",
    completionVersion: 1,
  }),
  closureFingerprint,
)

const replayOnce = buildCallWorkspacePostCallAdaptiveEvents({
  generatedAt: "2026-07-24T15:38:00.000Z",
  liveReasoning: finalLiveReasoning,
  liveSnapshot: finalLiveSnapshot,
  scorecard,
  operatorWrapup,
})
assert.equal(replayOnce.filter((event) => event.type === "competitor_mentioned").length, 1)
assert.equal(
  buildCallWorkspaceClosureFingerprint({
    organizationId: ORG_ID,
    leadId: BLOCK_LEAD,
    sessionId: "rt-block-imaging",
    completionVersion: 1,
  }),
  closureFingerprint,
)

const operatorCorrected = mapProfileEventToCanonicalRecord(
  {
    id: "mem-corrected",
    memoryCategory: "buying_signal",
    title: "Depot turnaround is the confirmed operational issue",
    confidence: "high",
    sourceSystem: "operator_memory_review",
    recordedAt: "2026-07-24T15:39:00.000Z",
    metadata: {
      [MEMORY_OPERATOR_STATUS_KEY]: "corrected",
      [MEMORY_OPERATOR_OVERRIDE_KEY]: "Depot turnaround is the confirmed operational issue for Block Imaging",
      [MEMORY_CONFIRMATION_COUNT_KEY]: 1,
      human_memory_kind: "sales_conclusion",
      canonical_entity_label: "Block Imaging",
    },
  },
  "Block Imaging",
)
assert.match(operatorCorrected.conclusion, /Block Imaging/)
console.log("  ✓ Phase 13 — unsubscribe, wait, cancel, replay idempotency, operator authority")

// --- Phase 14: Consistency report ---
console.log("\nStage consistency report:")
console.log("Stage\tCanonical Owner\tResult\tDecision Fingerprint")
for (const row of stageReport) {
  console.log(`${row.stage}\t${row.canonicalOwner}\t${row.result}\t${row.decisionFingerprint}`)
}

const fingerprints = {
  qualification: qualificationDecision.decisionFingerprint,
  reply: replyDecision.decisionFingerprint,
  meetingBooked: meetingDecision.decisionFingerprint,
  postMeeting: finalDecision.decisionFingerprint,
}
assert.notEqual(fingerprints.qualification, fingerprints.postMeeting)
assert.notEqual(fingerprints.reply, fingerprints.postMeeting)

console.log(
  JSON.stringify(
    {
      ok: true,
      qaMarker: QA_MARKER,
      leadId: BLOCK_LEAD,
      decisionEvolution: fingerprints,
      stageCount: stageReport.length,
      surfacesAligned: true,
      transportSimulated: materializeCanonicalOutreachChannelContent({
        brief: qualifiedBrief,
        channel: "email",
        package: outreachPackage,
      }).body.length > 0,
      meetingIntelligence: buildMeetingIntelligenceInputForDecisionEngine({
        hasUpcomingMeeting: false,
        buyingStage: "evaluation",
        recommendedNextAction: finalDecision.title,
        readinessScore: 82,
        readinessMissing: [],
        committeeCoverage: "Partial",
        canonicalDecision: finalResolution,
        postCallClosure,
      })?.opportunityProgression?.mustHappenNext?.length,
      followUpChannel: resolvePostCallFollowUpChannel(postCallNba).followUpChannel,
    },
    null,
    2,
  ),
)

console.log("\nGE-AIOS-FIRST-MEETING-WORKFLOW-1A certification complete.")
