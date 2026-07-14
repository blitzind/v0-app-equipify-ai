/** GE-AIOS-CALL-WORKSPACE-INTELLIGENCE-2B — Canonical post-call closure (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  applyAdaptiveLoopToOutreachPreparation,
  detectAdaptiveStrategyChanges,
} from "@/lib/growth/aios/growth/growth-adaptive-loop-1a"
import { ingestLiveRelationshipEvent } from "@/lib/growth/aios/growth/growth-adaptive-loop-1b-live-ingestion"
import { isRelationshipMaterialChange } from "@/lib/growth/aios/growth/growth-adaptive-loop-1b-material-change"
import { generateAndPersistAutonomousOutreachApprovalPackageForDraftFactory } from "@/lib/growth/aios/growth/growth-autonomous-outreach-preparation-package-persistence"
import { buildRevenueStrategyIntelligence } from "@/lib/growth/aios/growth/growth-outreach-revenue-strategy-intelligence"
import { loadOutreachSellerTruthForOrganization } from "@/lib/growth/aios/growth/growth-outreach-seller-truth-loader"
import { resolveCanonicalOutreachPackageForLead } from "@/lib/growth/aios/growth/growth-send-plane-1a-canonical-loader"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import { writeCanonicalLeadMemoryAndRebuild } from "@/lib/growth/lead-memory/canonical-human-memory-write"
import { resolveCanonicalHumanMemoryForLead } from "@/lib/growth/lead-memory/resolve-canonical-human-memory-for-lead"
import { fetchLatestCallIntelligenceScorecardForLead } from "@/lib/growth/call-intelligence/call-intelligence-repository"
import type { CallIntelligenceScorecardPublicView } from "@/lib/growth/call-intelligence/call-intelligence-types"
import { applyCallWorkspaceCommitteeSuggestions } from "@/lib/growth/operator-assist/call-workspace-post-call-committee"
import {
  buildCallWorkspaceClosureFingerprint,
  CALL_WORKSPACE_CLOSURE_FINGERPRINT_METADATA_KEY,
} from "@/lib/growth/operator-assist/call-workspace-post-call-closure-idempotency"
import {
  GROWTH_CALL_WORKSPACE_POST_CALL_CLOSURE_QA_MARKER,
  GROWTH_CALL_WORKSPACE_POST_CALL_CLOSURE_SOURCE_SYSTEM,
  type CallWorkspacePostCallClosureInput,
  type CallWorkspacePostCallClosureResult,
  type GrowthCallWorkspacePostCallClosure,
} from "@/lib/growth/operator-assist/call-workspace-post-call-closure-types"
import { bridgeCallWorkspaceClosureToMeetingIntelligence } from "@/lib/growth/operator-assist/call-workspace-post-call-meeting-bridge"
import {
  resolveCallWorkspacePostCallNextAction,
  resolvePostCallFollowUpChannel,
} from "@/lib/growth/operator-assist/call-workspace-post-call-nba"
import { extractCallWorkspacePostCallOutcomes } from "@/lib/growth/operator-assist/call-workspace-post-call-outcome-extraction"
export { computeCallWorkspacePostCallClosure } from "@/lib/growth/operator-assist/call-workspace-post-call-closure-compute"
import type { GrowthRealtimeLiveSnapshot } from "@/lib/growth/realtime/realtime-call-types"
import { fetchGrowthRealtimeCallSession } from "@/lib/growth/realtime/realtime-call-repository"
import { logGrowthEngine } from "@/lib/growth/access"

function eventsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("lead_memory_events")
}

async function loadExistingClosureRecord(
  admin: SupabaseClient,
  fingerprint: string,
  leadId: string,
): Promise<GrowthCallWorkspacePostCallClosure | null> {
  const { data } = await eventsTable(admin)
    .select("metadata")
    .eq("lead_id", leadId)
    .eq("source_system", GROWTH_CALL_WORKSPACE_POST_CALL_CLOSURE_SOURCE_SYSTEM)
    .contains("metadata", { [CALL_WORKSPACE_CLOSURE_FINGERPRINT_METADATA_KEY]: fingerprint })
    .maybeSingle()

  const metadata = (data as { metadata?: Record<string, unknown> } | null)?.metadata
  const closure = metadata?.closure as GrowthCallWorkspacePostCallClosure | undefined
  return closure?.qaMarker === GROWTH_CALL_WORKSPACE_POST_CALL_CLOSURE_QA_MARKER ? closure : null
}

async function persistClosureRecord(
  admin: SupabaseClient,
  input: {
    leadId: string
    companyName: string | null
    fingerprint: string
    closure: GrowthCallWorkspacePostCallClosure
    sessionId: string
  },
): Promise<void> {
  const lead = await fetchGrowthLeadById(admin, input.leadId)
  if (!lead) return

  const { data: existing } = await eventsTable(admin)
    .select("id")
    .eq("lead_id", input.leadId)
    .eq("source_system", GROWTH_CALL_WORKSPACE_POST_CALL_CLOSURE_SOURCE_SYSTEM)
    .contains("metadata", { [CALL_WORKSPACE_CLOSURE_FINGERPRINT_METADATA_KEY]: input.fingerprint })
    .maybeSingle()

  if (existing?.id) return

  await eventsTable(admin).insert({
    lead_id: input.leadId,
    lead_label: lead.companyName ?? input.companyName ?? "Lead",
    memory_category: "engagement_pattern",
    confidence: "verified",
    title: "Call workspace post-call closure",
    evidence_snippet: input.closure.meetingSummary.slice(0, 500),
    source_system: GROWTH_CALL_WORKSPACE_POST_CALL_CLOSURE_SOURCE_SYSTEM,
    source_event_id: input.sessionId,
    metadata: {
      qa_marker: GROWTH_CALL_WORKSPACE_POST_CALL_CLOSURE_QA_MARKER,
      [CALL_WORKSPACE_CLOSURE_FINGERPRINT_METADATA_KEY]: input.fingerprint,
      closure: input.closure,
    },
  })

  const { invalidateCanonicalDecisionCacheForLead } = await import(
    "@/lib/growth/aios/growth/growth-canonical-decision-engine-1c-cache"
  )
  invalidateCanonicalDecisionCacheForLead(input.leadId, "stored_post_call_closure")
}

export async function executeCallWorkspacePostCallClosure(
  admin: SupabaseClient,
  closureInput: CallWorkspacePostCallClosureInput,
): Promise<CallWorkspacePostCallClosureResult> {
  const fingerprint = buildCallWorkspaceClosureFingerprint({
    organizationId: closureInput.organizationId,
    leadId: closureInput.leadId,
    sessionId: closureInput.sessionId,
    completionVersion: closureInput.completionVersion,
  })

  const existing = await loadExistingClosureRecord(admin, fingerprint, closureInput.leadId)
  if (existing) {
    return {
      closure: existing,
      sideEffects: {
        memoryWrites: 0,
        memoryDeduped: 0,
        memoryReviewPrepared: existing.memoryReviewItems.length,
        adaptiveEventsEmitted: 0,
        committeeSuggestionsQueued: 0,
        strategyRefreshScheduled: false,
        idempotentReplay: true,
      },
    }
  }

  const lead = await fetchGrowthLeadById(admin, closureInput.leadId)
  if (!lead) throw new Error("lead_not_found")

  const [memoryBundle, priorPackage, realtimeSession] = await Promise.all([
    resolveCanonicalHumanMemoryForLead(admin, {
      organizationId: closureInput.organizationId,
      leadId: closureInput.leadId,
      generatedAt: closureInput.generatedAt,
    }).catch(() => null),
    resolveCanonicalOutreachPackageForLead(admin, {
      organizationId: closureInput.organizationId,
      leadId: closureInput.leadId,
    }).catch(() => null),
    closureInput.realtimeSessionId
      ? fetchGrowthRealtimeCallSession(admin, closureInput.realtimeSessionId).catch(() => null)
      : Promise.resolve(null),
  ])

  const liveSnapshot = realtimeSession?.liveSnapshot ?? null
  let scorecard = closureInput.scorecard
  if (!scorecard && closureInput.realtimeSessionId) {
    scorecard = await fetchLatestCallIntelligenceScorecardForLead(admin, closureInput.leadId).catch(() => null)
  }

  const extracted = extractCallWorkspacePostCallOutcomes({
    generatedAt: closureInput.generatedAt,
    companyName: closureInput.companyName ?? lead.companyName,
    liveReasoning: closureInput.liveReasoning,
    liveSnapshot,
    scorecard,
    operatorWrapup: closureInput.operatorWrapup,
    operatorDisposition: closureInput.operatorDisposition,
    operatorNotes: closureInput.operatorNotes,
  })

  let memoryWrites = 0
  let memoryDeduped = 0
  let memoryReviewPrepared = extracted.memoryReviewItems.length

  for (const candidate of extracted.memoryCandidates) {
    if (candidate.reviewRequired) continue
    const result = await writeCanonicalLeadMemoryAndRebuild(admin, {
      leadId: closureInput.leadId,
      humanMemoryKind: candidate.humanMemoryKind,
      conclusion: candidate.conclusion,
      confidence: candidate.confidence,
      sourceSystem: GROWTH_CALL_WORKSPACE_POST_CALL_CLOSURE_SOURCE_SYSTEM,
      canonicalEntityLabel: closureInput.companyName ?? lead.companyName,
      whyItMatters: "Confirmed on completed call — not transcript storage",
      operatorStatus: "pending",
    }).catch(() => ({ eventId: null, deduped: true }))
    if (result.deduped) memoryDeduped += 1
    else if (result.eventId) memoryWrites += 1
  }

  let adaptiveEventsEmitted = 0
  let strategyRefreshScheduled = false
  let strategyChange: ReturnType<typeof detectAdaptiveStrategyChanges> | null = null

  const sellerTruth = await loadOutreachSellerTruthForOrganization(admin, {
    organizationId: closureInput.organizationId,
    preparedAt: closureInput.generatedAt,
    prospectCompanyName: closureInput.companyName ?? lead.companyName,
    leadId: closureInput.leadId,
  }).catch(() => null)

  const previousAssessment = closureInput.liveReasoning?.relationshipAssessment ?? null
  const previousRevenue = closureInput.liveReasoning?.revenueStrategyIntelligence ?? null

  const adaptivePrep = sellerTruth
    ? applyAdaptiveLoopToOutreachPreparation({
        events: extracted.adaptiveEvents,
        memory: memoryBundle?.influence ?? null,
        context: memoryBundle?.relationshipContext ?? {
          priorTouchCount: 0,
          priorReplyCount: 0,
          priorOutboundSubjects: [],
          objectionSummaries: [],
          priorReplySummaries: [],
          sequenceHistorySummaries: [],
          memoryOpenLoopSummaries: [],
          buyingIntent: null,
          competitorPressure: null,
        },
        lead: {
          relationshipStrengthScore: lead.score ?? 50,
          relationshipStrengthTier: "warm",
          relationshipTrend: "stable",
          sequenceFatigueRisk: "low",
          leadStatus: lead.status,
          hasMeetingScheduled: false,
          isCustomer: false,
          isSuppressed: false,
          committeeMemberCount: memoryBundle?.committee?.verifiedMemberCount ?? 0,
          singleThreadRisk: memoryBundle?.committee?.singleThreadRisk ?? true,
        },
        committee: memoryBundle?.committee ?? null,
        assessmentInput: {
          leadId: closureInput.leadId,
          companyName: closureInput.companyName ?? lead.companyName ?? "Account",
          preparedAt: closureInput.generatedAt,
          contactName: lead.contactName,
          contactTitle: null,
          relationshipStrengthTier: "warm",
          contactTemperature: "warm",
          leadStatus: lead.status,
          sellerTruth,
          verifiedEvidence: extracted.businessConclusions,
          equipmentServiced: [],
        },
        learningWeights: memoryBundle?.learningWeights ?? null,
        previousAssessment,
        previousRevenue,
        extraRefreshReasons: ["call_workspace_post_call_closure"],
      })
    : null

  const currentRevenue = adaptivePrep
    ? buildRevenueStrategyIntelligence({
        leadId: closureInput.leadId,
        companyName: closureInput.companyName ?? lead.companyName ?? "Account",
        primaryDmName: lead.contactName,
        primaryDmTitle: null,
        relationshipAssessment: adaptivePrep.relationshipAssessment,
        buyingCommitteeSnapshot: adaptivePrep.committee,
        sellerTruth,
        institutionalLearning: memoryBundle?.institutionalAdvisory ?? null,
      })
    : null

  strategyChange = adaptivePrep
    ? detectAdaptiveStrategyChanges({
        previousAssessment,
        currentAssessment: adaptivePrep.relationshipAssessment,
        previousRevenue,
        currentRevenue,
        events: extracted.adaptiveEvents,
      })
    : null

  for (const event of extracted.adaptiveEvents) {
    const materialChange = isRelationshipMaterialChange({ eventType: event.type })
    const ingested = await ingestLiveRelationshipEvent(admin, {
      organizationId: closureInput.organizationId,
      leadId: closureInput.leadId,
      source: "call_workspace",
      event,
      sourceEventId: `${closureInput.sessionId}:${event.type}`,
      scheduleStrategyRefresh: materialChange,
    }).catch(() => null)
    if (ingested?.recorded) adaptiveEventsEmitted += 1
    if (ingested?.strategyRefreshScheduled) strategyRefreshScheduled = true
  }

  const committeeSuggestionsQueued = await applyCallWorkspaceCommitteeSuggestions(admin, {
    leadId: closureInput.leadId,
    suggestions: extracted.committeeSuggestions,
    sourceEventId: closureInput.sessionId,
  }).catch(() => 0)

  const recommendedNextAction = resolveCallWorkspacePostCallNextAction({
    extracted,
    liveReasoning: closureInput.liveReasoning,
    relationshipAssessment: adaptivePrep?.relationshipAssessment ?? null,
    scorecard,
    operatorWrapup: closureInput.operatorWrapup,
  })
  const followUp = resolvePostCallFollowUpChannel(recommendedNextAction)

  let followUpPackageId: string | null = null
  let followUpPackageStatus: GrowthCallWorkspacePostCallClosure["followUpPackageStatus"] = "not_required"

  if (followUp.followUpRequired) {
    const persisted = await generateAndPersistAutonomousOutreachApprovalPackageForDraftFactory(admin, {
      organizationId: closureInput.organizationId,
      leadId: closureInput.leadId,
      generatedAt: closureInput.generatedAt,
      companyName: closureInput.companyName ?? lead.companyName,
      wakeCondition: "relationship_material_change",
    }).catch(() => null)

    if (persisted) {
      followUpPackageId = persisted.packageId
      followUpPackageStatus = persisted.reusedExisting ? "reused_existing" : "pending_approval"
    } else {
      followUpPackageStatus = "blocked"
    }
  }

  const meetingBridge = await bridgeCallWorkspaceClosureToMeetingIntelligence(admin, {
    organizationId: closureInput.organizationId,
    leadId: closureInput.leadId,
    realtimeSessionId: closureInput.realtimeSessionId,
    closure: {
      meetingSummary: extracted.meetingSummary,
      callOutcome: extracted.callOutcome,
      recommendedNextAction,
    },
    generatedAt: closureInput.generatedAt,
  })

  const closure = computeCallWorkspacePostCallClosure({
    closureInput: { ...closureInput, scorecard },
    liveSnapshot,
    memoryBundle,
    strategyChange,
    followUpPackageId,
    followUpPackageStatus,
    meetingIntelligenceUpdated: meetingBridge.updated,
  })

  await persistClosureRecord(admin, {
    leadId: closureInput.leadId,
    companyName: closureInput.companyName ?? lead.companyName,
    fingerprint,
    closure,
    sessionId: closureInput.sessionId,
  })

  logGrowthEngine("call_workspace_post_call_closure_completed", {
    qa_marker: GROWTH_CALL_WORKSPACE_POST_CALL_CLOSURE_QA_MARKER,
    lead_id: closureInput.leadId,
    session_id: closureInput.sessionId,
    fingerprint,
    memory_writes: memoryWrites,
    adaptive_events: adaptiveEventsEmitted,
    follow_up_package_id: followUpPackageId,
    idempotent_replay: false,
    prior_package_preserved: Boolean(priorPackage?.packageId),
  })

  return {
    closure,
    sideEffects: {
      memoryWrites,
      memoryDeduped,
      memoryReviewPrepared,
      adaptiveEventsEmitted,
      committeeSuggestionsQueued,
      strategyRefreshScheduled,
      idempotentReplay: false,
    },
  }
}

export async function previewCallWorkspacePostCallClosure(
  admin: SupabaseClient,
  closureInput: CallWorkspacePostCallClosureInput,
): Promise<GrowthCallWorkspacePostCallClosure> {
  const fingerprint = buildCallWorkspaceClosureFingerprint({
    organizationId: closureInput.organizationId,
    leadId: closureInput.leadId,
    sessionId: closureInput.sessionId,
    completionVersion: closureInput.completionVersion,
  })

  const existing = await loadExistingClosureRecord(admin, fingerprint, closureInput.leadId)
  if (existing) return existing

  const lead = await fetchGrowthLeadById(admin, closureInput.leadId)
  const realtimeSession = closureInput.realtimeSessionId
    ? await fetchGrowthRealtimeCallSession(admin, closureInput.realtimeSessionId).catch(() => null)
    : null

  let scorecard: CallIntelligenceScorecardPublicView | null = closureInput.scorecard
  if (!scorecard && closureInput.realtimeSessionId) {
    scorecard = await fetchLatestCallIntelligenceScorecardForLead(admin, closureInput.leadId).catch(() => null)
  }

  const memoryBundle = await resolveCanonicalHumanMemoryForLead(admin, {
    organizationId: closureInput.organizationId,
    leadId: closureInput.leadId,
    generatedAt: closureInput.generatedAt,
  }).catch(() => null)

  const extracted = extractCallWorkspacePostCallOutcomes({
    generatedAt: closureInput.generatedAt,
    companyName: closureInput.companyName ?? lead?.companyName ?? null,
    liveReasoning: closureInput.liveReasoning,
    liveSnapshot: realtimeSession?.liveSnapshot ?? null,
    scorecard,
    operatorWrapup: closureInput.operatorWrapup,
    operatorDisposition: closureInput.operatorDisposition,
    operatorNotes: closureInput.operatorNotes,
  })

  const recommendedNextAction = resolveCallWorkspacePostCallNextAction({
    extracted,
    liveReasoning: closureInput.liveReasoning,
    relationshipAssessment: closureInput.liveReasoning?.relationshipAssessment ?? null,
    scorecard,
    operatorWrapup: closureInput.operatorWrapup,
  })
  const followUp = resolvePostCallFollowUpChannel(recommendedNextAction)

  return {
    qaMarker: GROWTH_CALL_WORKSPACE_POST_CALL_CLOSURE_QA_MARKER,
    callOutcome: extracted.callOutcome,
    meetingSummary: extracted.meetingSummary,
    businessConclusions: extracted.businessConclusions,
    personalConclusions: extracted.personalConclusions,
    objections: extracted.objections,
    commitments: extracted.commitments,
    buyingSignals: extracted.buyingSignals,
    committeeSignals: extracted.committeeSignals,
    relationshipChange: extracted.adaptiveEvents,
    recommendedNextAction,
    followUpRequired: followUp.followUpRequired,
    followUpChannel: followUp.followUpChannel,
    followUpReason: followUp.followUpReason,
    operatorReviewRequired:
      extracted.memoryReviewItems.length > 0 ||
      extracted.committeeSuggestions.some((row) => row.reviewRequired),
    strategyChange: null,
    committeeSuggestions: extracted.committeeSuggestions,
    memoryReviewItems: extracted.memoryReviewItems,
    followUpPackageId: null,
    followUpPackageStatus: followUp.followUpRequired ? "blocked" : "not_required",
    meetingIntelligenceUpdated: false,
    closureFingerprint: fingerprint,
  }
}
