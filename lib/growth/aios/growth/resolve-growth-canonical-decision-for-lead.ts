/**
 * GE-AIOS-DECISION-ENGINE-1B — Canonical server-side decision resolver (server-only).
 */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { detectAdaptiveStrategyChanges } from "@/lib/growth/aios/growth/growth-adaptive-loop-1a"
import { buildGrowthCanonicalNextBestDecision } from "@/lib/growth/aios/growth/growth-canonical-decision-engine-1a"
import type { GrowthCanonicalDecisionInput } from "@/lib/growth/aios/growth/growth-canonical-decision-engine-1a-input"
import { projectCanonicalDecisionOperatorCard } from "@/lib/growth/aios/growth/growth-canonical-decision-engine-1a-operator-card"
import {
  buildCanonicalDecisionSuppressionHints,
  computeGrowthCanonicalDecisionFreshness,
} from "@/lib/growth/aios/growth/growth-canonical-decision-engine-1b-freshness"
import { projectGrowthCanonicalOperatorDecision } from "@/lib/growth/aios/growth/growth-canonical-decision-engine-1b-operator-projection"
import {
  GROWTH_AIOS_CANONICAL_DECISION_ENGINE_1B_QA_MARKER,
  type GrowthCanonicalDecisionResolution,
} from "@/lib/growth/aios/growth/growth-canonical-decision-engine-1b-types"
import type { GrowthAutonomousOutreachApprovalPackage } from "@/lib/growth/aios/growth/growth-autonomous-outreach-preparation-pilot-types"
import { resolveCanonicalOutreachPackageForLead } from "@/lib/growth/aios/growth/growth-send-plane-1a-canonical-loader"
import { buildRelationshipAssessment } from "@/lib/growth/aios/growth/growth-relationship-strategy-2a"
import type { RevenueStrategyRecommendation } from "@/lib/growth/aios/growth/growth-outreach-revenue-strategy-intelligence"
import { loadBuyingCommitteeIntelligenceLeadRollup } from "@/lib/growth/buying-committee-intelligence/buying-committee-intelligence-lead-rollup"
import { loadBuyingCommitteeIntelligenceOperatorStatus } from "@/lib/growth/buying-committee-intelligence/buying-committee-intelligence-operator-status"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import { resolveCanonicalHumanMemoryForLead } from "@/lib/growth/lead-memory/resolve-canonical-human-memory-for-lead"
import { listGrowthMeetingsForLead } from "@/lib/growth/meeting-intelligence/meeting-repository"
import { fetchGrowthLeadEmailEventSummary } from "@/lib/growth/outbound/email-event-summary"
import { listGrowthOutboundRepliesForLead } from "@/lib/growth/outbound/reply-repository"
import { isReplyMaterialForCanonicalDecision } from "@/lib/growth/aios/growth/growth-canonical-decision-engine-1a-reply"
import { extractBuyingStageFromMetadata } from "@/lib/growth/prospect-search/prospect-search-qualification-overlays"
import { fetchGrowthSequenceEnrollmentById } from "@/lib/growth/sequence-enrollment/sequence-enrollment-repository"
import {
  loadLatestStoredCallWorkspacePostCallClosureForLead,
} from "@/lib/growth/aios/growth/growth-canonical-decision-engine-1d-stored-closure"
import { mapStoredClosureToDecisionPostCall } from "@/lib/growth/aios/growth/growth-canonical-decision-engine-1d-stored-closure-map"
import {
  buildMeetingIntelligenceInputForDecisionEngine,
} from "@/lib/growth/meeting-intelligence/growth-canonical-meeting-brief-builder"
import {
  buildStableCanonicalMemoryVersionKey,
  resolveCanonicalDecisionEvaluationInstantMs,
  resolveCanonicalDecisionGeneratedAtBoundary,
} from "@/lib/growth/aios/growth/growth-canonical-decision-engine-1b-resolution-boundary"
import type { CanonicalHumanMemoryBundle } from "@/lib/growth/lead-memory/canonical-human-memory-types"

function mapPackageState(
  pkg: GrowthAutonomousOutreachApprovalPackage | null,
): GrowthCanonicalDecisionInput["packageState"] {
  if (!pkg) {
    return { packageId: null, status: "none", purpose: null }
  }

  const purpose =
    pkg.approvalRequirements?.find((row) => /checklist|promised|follow-up|workflow/i.test(row)) ??
    pkg.generatedAssets[0]?.label ??
    null

  let status: NonNullable<GrowthCanonicalDecisionInput["packageState"]>["status"] = "draft"
  if (pkg.packageApprovalDecision === "approved") status = "approved"
  else if (pkg.packageApprovalDecision === "rejected") status = "blocked"
  else if (pkg.pendingHumanApproval) status = "pending_approval"

  const promisedInformationPending =
    Boolean(purpose && /checklist|promised|workflow/i.test(String(purpose))) &&
    status !== "sent" &&
    status !== "approved"

  return {
    packageId: pkg.packageId,
    status,
    purpose: typeof purpose === "string" ? purpose : String(purpose ?? ""),
    promisedInformationPending,
    promisedInformationSent: status === "sent" || status === "approved",
  }
}

function extractPostCallFromMemory(input: {
  commitments: string[]
  businessConclusions: string[]
  objections: string[]
  buyingSignals: string[]
  leadFollowUpAt: string | null
  nextBestActionReason: string | null
}): GrowthCanonicalDecisionInput["postCall"] {
  return {
    commitments: input.commitments,
    objections: input.objections,
    buyingSignals: input.buyingSignals,
    businessConclusions: input.businessConclusions,
    meetingBooked: Boolean(
      input.leadFollowUpAt && /meeting/i.test(input.nextBestActionReason ?? ""),
    ),
    timelineDetected: input.businessConclusions.some((row) => /next quarter|q[1-4]/i.test(row)),
    agreedWaitUntil: null,
  }
}

export async function resolveGrowthCanonicalDecisionForLead(
  admin: SupabaseClient,
  input: {
    organizationId: string
    leadId: string
    generatedAt?: string
    materialEvent?: { id?: string | null; at?: string | null; kind?: string | null } | null
    packageSnapshot?: GrowthAutonomousOutreachApprovalPackage | null
    skipMemoryLoad?: boolean
    preloadedMemoryBundle?: CanonicalHumanMemoryBundle | null
  },
): Promise<GrowthCanonicalDecisionResolution | null> {
  const lead = await fetchGrowthLeadById(admin, input.leadId).catch(() => null)
  if (!lead) return null

  const organizationId = input.organizationId || ""
  if (!organizationId) {
    return null
  }

  const inputDegraded: string[] = []

  const preliminaryGeneratedAt =
    input.generatedAt ??
    resolveCanonicalDecisionGeneratedAtBoundary({
      packagePreparedAt:
        input.packageSnapshot?.preparedAt ?? input.packageSnapshot?.salesStrategyBrief?.preparedAt ?? null,
      latestReplyAt: null,
      latestMeetingAt: null,
      storedClosureAt: null,
      leadUpdatedAt: lead.nextBestActionComputedAt ?? lead.lastResearchedAt ?? null,
      materialEventAt: input.materialEvent?.at ?? null,
    })

  const packagePromise: Promise<GrowthAutonomousOutreachApprovalPackage | null> =
    input.packageSnapshot != null
      ? Promise.resolve(input.packageSnapshot)
      : resolveCanonicalOutreachPackageForLead(admin, {
          organizationId,
          leadId: input.leadId,
        }).catch(() => {
          inputDegraded.push("outreach_package")
          return null
        })

  const [memoryBundle, outreachPackage, emailSummary, meetings, latestReplies, committeeRollup] =
    await Promise.all([
      input.skipMemoryLoad
        ? Promise.resolve(input.preloadedMemoryBundle ?? null)
        : input.preloadedMemoryBundle != null
          ? Promise.resolve(input.preloadedMemoryBundle)
          : packagePromise
              .then((pkg) =>
                resolveCanonicalHumanMemoryForLead(admin, {
                  organizationId,
                  leadId: input.leadId,
                  generatedAt: preliminaryGeneratedAt,
                  companyName: lead.companyName,
                  packageSnapshot: pkg ?? undefined,
                  skipPackageLoad: true,
                }),
              )
              .catch(() => {
                inputDegraded.push("memory_bundle")
                return null
              }),
      packagePromise,
      fetchGrowthLeadEmailEventSummary(admin, input.leadId, lead.contactEmail).catch(() => {
        inputDegraded.push("email_summary")
        return null
      }),
      listGrowthMeetingsForLead(admin, input.leadId, 8).catch(() => {
        inputDegraded.push("meetings")
        return []
      }),
      listGrowthOutboundRepliesForLead(admin, input.leadId, 3).catch(() => {
        inputDegraded.push("reply_state")
        return []
      }),
      loadBuyingCommitteeIntelligenceLeadRollup(admin, input.leadId).catch(() => {
        inputDegraded.push("buying_committee")
        return null
      }),
    ])

  const pkg = outreachPackage ?? input.packageSnapshot ?? null
  const latestReply = latestReplies[0] ?? null
  const storedClosure = await loadLatestStoredCallWorkspacePostCallClosureForLead(admin, {
    leadId: input.leadId,
  }).catch(() => null)

  const generatedAt =
    input.generatedAt ??
    resolveCanonicalDecisionGeneratedAtBoundary({
      packagePreparedAt: pkg?.preparedAt ?? pkg?.salesStrategyBrief?.preparedAt ?? null,
      latestReplyAt: latestReply?.receivedAt ?? null,
      latestMeetingAt:
        meetings.find((row) => row.startAt && row.status !== "cancelled")?.startAt ?? null,
      storedClosureAt: storedClosure?.recordedAt ?? null,
      leadUpdatedAt: lead.nextBestActionComputedAt ?? lead.lastResearchedAt ?? null,
      materialEventAt: input.materialEvent?.at ?? latestReply?.receivedAt ?? null,
    })

  const evaluationInstantMs = resolveCanonicalDecisionEvaluationInstantMs(generatedAt, [
    pkg?.preparedAt ?? pkg?.salesStrategyBrief?.preparedAt ?? null,
    latestReply?.receivedAt ?? null,
    storedClosure?.recordedAt ?? null,
    lead.nextBestActionComputedAt ?? null,
  ])
  const brief = pkg?.salesStrategyBrief ?? memoryBundle?.packageSnapshot ?? null

  const relationshipAssessment =
    brief?.relationshipAssessment ??
    buildRelationshipAssessment({
      leadId: input.leadId,
      companyName: lead.companyName,
      preparedAt: generatedAt,
      memory: memoryBundle?.influence ?? null,
      context: memoryBundle?.relationshipContext ?? {
        priorTouchCount: 0,
        priorReplyCount: 0,
        priorOutboundSubjects: [],
        objectionSummaries: [],
        priorReplySummaries: [],
        sequenceHistorySummaries: [],
        memoryOpenLoopSummaries: [],
      },
      lead: {
        relationshipStrengthTier: lead.relationshipStrengthTier,
        leadStatus: lead.status,
        hasMeetingScheduled: Boolean(
          lead.followUpAt && /meeting/i.test(lead.nextBestActionReason ?? ""),
        ),
        isCustomer: /customer|converted|won/i.test(lead.status),
        isSuppressed: emailSummary?.isSuppressed ?? false,
      },
      refreshReasons: [],
      previousRecommendation: brief?.revenueStrategyIntelligence?.recommendation ?? null,
      institutionalAdvice: memoryBundle?.institutionalAdvice ?? [],
    })

  const revenueStrategy =
    (brief?.revenueStrategyIntelligence?.recommendation as RevenueStrategyRecommendation | undefined) ??
    null

  const adaptiveEvolution =
    brief?.adaptiveLoopEvolution?.strategyChange ??
    (memoryBundle?.liveDeltas?.length
      ? detectAdaptiveStrategyChanges({
          previousAssessment: brief?.relationshipAssessment ?? null,
          currentAssessment: relationshipAssessment,
          previousRevenue: brief?.revenueStrategyIntelligence ?? null,
          currentRevenue: brief?.revenueStrategyIntelligence ?? null,
          events: memoryBundle.liveDeltas,
        })
      : null)

  const commitments = [
    ...(memoryBundle?.actions.records.map((row) => row.conclusion) ?? []),
    ...(memoryBundle?.influence?.commitmentSummaries ?? []),
  ].filter(Boolean)

  const businessConclusions = [
    ...(memoryBundle?.business.records.map((row) => row.conclusion) ?? []),
    ...(memoryBundle?.influence?.relationshipSummary ? [memoryBundle.influence.relationshipSummary] : []),
  ].filter(Boolean)

  const objections = memoryBundle?.influence?.topObjections ?? []
  const buyingSignals = memoryBundle?.influence?.priorInteractionSummaries?.slice(0, 3) ?? []

  const upcomingMeeting =
    meetings.find(
      (row) =>
        row.startAt &&
        Date.parse(row.startAt) > evaluationInstantMs &&
        row.status !== "cancelled" &&
        row.status !== "completed",
    ) ?? null

  let committeeStatus = null
  if (committeeRollup?.company_id) {
    committeeStatus = await loadBuyingCommitteeIntelligenceOperatorStatus(admin, {
      company_id: committeeRollup.company_id,
    }).catch(() => null)
  }

  const missingRole =
    committeeStatus?.roles_missing?.find((role) => /director|executive|operations/i.test(role)) ??
    committeeStatus?.roles_missing?.[0] ??
    null

  const replyIntent = latestReply?.intent ?? latestReply?.classification ?? null
  const replyMaterial =
    replyIntent != null ? isReplyMaterialForCanonicalDecision(String(replyIntent)) : false

  let sequenceState: GrowthCanonicalDecisionInput["sequenceState"] = null
  if (lead.activeSequenceEnrollmentId) {
    const enrollment = await fetchGrowthSequenceEnrollmentById(
      admin,
      lead.activeSequenceEnrollmentId,
    ).catch(() => null)
    sequenceState = {
      enrolled: enrollment?.status === "active" || Boolean(enrollment),
      nextScheduledAt: enrollment?.updatedAt ?? null,
      nextStepLabel: enrollment?.status ?? "active",
    }
  }

  const packageState = mapPackageState(pkg)
  const approvalPending =
    pkg?.pendingHumanApproval === true && pkg?.packageApprovalDecision !== "approved"

  const postCall = storedClosure
    ? mapStoredClosureToDecisionPostCall(storedClosure.closure)
    : extractPostCallFromMemory({
        commitments,
        businessConclusions,
        objections,
        buyingSignals,
        leadFollowUpAt: lead.followUpAt,
        nextBestActionReason: lead.nextBestActionReason,
      })

  const decisionInput: GrowthCanonicalDecisionInput = {
    organizationId,
    leadId: input.leadId,
    generatedAt,
    companyName: lead.companyName,
    contactName: lead.contactName,
    memoryBundle,
    relationshipAssessment,
    revenueStrategy,
    adaptiveEvolution,
    institutionalAdvice: memoryBundle?.institutionalAdvisory ?? null,
    committee: committeeRollup
      ? {
          championIdentified: Boolean(committeeStatus?.roles_present?.some((role) => /champion|owner/i.test(role))),
          recommendedStakeholderRole: missingRole,
          recommendedStakeholderLabel: missingRole,
          multiThreadRecommended: Boolean(committeeStatus?.single_thread_risk),
          summary: committeeStatus?.roles_missing?.length
            ? `Missing roles: ${committeeStatus.roles_missing.slice(0, 2).join(", ")}`
            : null,
        }
      : null,
    replyState: latestReply
      ? {
          classification: latestReply.classification ?? null,
          intent: replyIntent,
          isMaterial: replyMaterial,
          isOutOfOffice: replyIntent === "out_of_office",
          isUnknown: replyIntent === "unknown" || replyIntent === "neutral_acknowledgement",
          receivedAt: latestReply.receivedAt ?? null,
        }
      : null,
    postCall,
    meeting: upcomingMeeting
      ? {
          hasUpcomingMeeting: true,
          meetingAt: upcomingMeeting.startAt,
          meetingObjective: upcomingMeeting.title ?? lead.nextBestActionReason,
          stakeholderRole: missingRole,
          stakeholderContactId: null,
          postMeetingProposalRequested: /proposal/i.test(
            [lead.nextBestActionReason, ...commitments].filter(Boolean).join(" "),
          ),
        }
      : {
          hasUpcomingMeeting: false,
          meetingAt: null,
          meetingObjective: null,
          stakeholderRole: null,
          stakeholderContactId: null,
        },
    packageState,
    draftFactoryStatus: pkg?.expectedOutcome ?? null,
    approvalState: approvalPending
      ? {
          pendingOperatorReview: true,
          pendingPackageApproval: true,
          label: "Package awaiting operator review",
        }
      : null,
    sequenceState,
    transportState: {
      blocked: approvalPending || lead.status === "archived" || emailSummary?.isSuppressed === true,
      reason: approvalPending
        ? "Awaiting Human Approval Center"
        : emailSummary?.isSuppressed
          ? "Suppressed contact"
          : null,
    },
    operatorConstraints: {
      archived: lead.status === "archived",
      disqualified: lead.status === "disqualified",
      unsubscribed: emailSummary?.isSuppressed === true,
      operatorPausedOutreach: /paused/i.test(String(lead.metadata?.operator_outreach_state ?? "")),
      paused: /paused|dormant/i.test(lead.status),
    },
    commercialReadiness: {
      pricingInputsComplete: Boolean(brief?.revenueStrategyIntelligence?.opportunityReadiness?.overall ?? 0 >= 0.55),
      proposalInputsComplete: Boolean(
        (brief?.revenueStrategyIntelligence?.opportunityReadiness?.overall ?? 0) >= 0.65 &&
          !(brief?.missingEvidence?.length ?? 0),
      ),
      discoveryGaps: brief?.missingEvidence?.slice(0, 4) ?? [],
    },
    meetingIntelligence: buildMeetingIntelligenceInputForDecisionEngine({
      hasUpcomingMeeting: Boolean(upcomingMeeting),
      buyingStage:
        extractBuyingStageFromMetadata(
          lead.metadata && typeof lead.metadata === "object" ? lead.metadata : {},
        )?.buying_stage ?? null,
      recommendedNextAction: lead.nextBestActionReason,
      readinessScore: brief?.revenueStrategyIntelligence?.opportunityReadiness?.overall
        ? Math.round((brief.revenueStrategyIntelligence.opportunityReadiness.overall ?? 0) * 100)
        : 55,
      readinessMissing: brief?.missingEvidence?.slice(0, 4) ?? [],
      committeeCoverage: committeeStatus?.roles_missing?.length
        ? committeeStatus.roles_missing.length >= 2
          ? "Weak"
          : "Partial"
        : "Strong",
      canonicalDecision: null,
      postCallClosure: storedClosure?.closure ?? null,
    }),
    sourceVersions: {
      memoryVersion: buildStableCanonicalMemoryVersionKey(memoryBundle),
      relationshipVersion: relationshipAssessment?.relationshipGoal?.current ?? null,
      revenueVersion: revenueStrategy,
      packageVersion: pkg?.packageId ?? null,
      meetingVersion: upcomingMeeting?.startAt ?? null,
      approvalVersion: approvalPending ? "pending" : pkg?.packageApprovalDecision ?? null,
      materialEventId:
        storedClosure?.closureFingerprint ??
        input.materialEvent?.id ??
        latestReply?.id ??
        null,
    },
  }

  const decision = buildGrowthCanonicalNextBestDecision(decisionInput)

  const strategyChangedSincePackage = Boolean(
    adaptiveEvolution?.meaningfulChanges?.length ||
      adaptiveEvolution?.relationshipChangedBecause?.length,
  )

  const freshness = computeGrowthCanonicalDecisionFreshness({
    decision,
    packageSnapshot: pkg,
    materialEventAt: input.materialEvent?.at ?? latestReply?.receivedAt ?? null,
    strategyChangedSincePackage,
  })

  const suppressionHints = buildCanonicalDecisionSuppressionHints(decision)
  const operatorCard = projectCanonicalDecisionOperatorCard(decision)
  projectGrowthCanonicalOperatorDecision({ decision, freshness })

  return {
    qaMarker: GROWTH_AIOS_CANONICAL_DECISION_ENGINE_1B_QA_MARKER,
    organizationId,
    leadId: input.leadId,
    generatedAt,
    companyName: lead.companyName,
    decision,
    operatorCard,
    freshness,
    suppressionHints,
    inputDegraded,
  }
}

export { shouldBlockCompetingOutreachPackageFromDecision } from "@/lib/growth/aios/growth/growth-canonical-decision-engine-1c-enforcement"
