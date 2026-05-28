import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  applyOutboundApprovalTransition,
  canApplyOutboundApproval,
  canInitiateOutboundSession,
  canOperatorTakeover,
} from "@/lib/voice/ai-outbound/approval-workflow"
import {
  createInitialOutboundFsmState,
  detectOptOutIntent,
  transitionOutboundFsm,
} from "@/lib/voice/ai-outbound/conversation-state-machine"
import {
  buildOutboundHandoffSummary,
  evaluateOutboundEscalation,
} from "@/lib/voice/ai-outbound/escalation-handler"
import { buildOutboundOptOutTerminationMessage, sanitizeOutboundResponse } from "@/lib/voice/ai-outbound/guardrails"
import {
  DEFAULT_OUTBOUND_QUALIFICATION_STEPS,
  getCurrentOutboundQualificationStep,
  isOutboundQualificationComplete,
} from "@/lib/voice/ai-outbound/qualification-flows"
import {
  deepgramOutboundProvider,
  deterministicOutboundProvider,
  elevenLabsOutboundProvider,
  generateOutboundResponseWithTimeout,
  openAiRealtimeOutboundProvider,
  stubOutboundProvider,
} from "@/lib/voice/ai-outbound/provider-registry"
import {
  isVoiceAiOutboundEnabled,
  resolveVoiceAiOutboundProviderMode,
  type VoiceAiOutboundProvider,
} from "@/lib/voice/ai-outbound/provider-types"
import {
  buildSchedulingPrompt,
  detectSchedulingIntent,
  requiresHumanSchedulingConfirmation,
} from "@/lib/voice/ai-outbound/scheduling-orchestration"
import {
  buildOutboundApprovalQueueSnapshot,
  buildOutboundWorkspaceSnapshot,
} from "@/lib/voice/ai-outbound/snapshot-builder"
import type {
  OutboundApprovalAction,
  VoiceAiOutboundApprovalQueueSnapshot,
  VoiceAiOutboundReadinessSnapshot,
  VoiceAiOutboundSessionPublicView,
  VoiceAiOutboundWorkflowType,
  VoiceAiOutboundWorkspaceSnapshot,
} from "@/lib/voice/ai-outbound/types"
import {
  VOICE_AI_OUTBOUND_ESCALATION_CONFUSION_THRESHOLD,
  VOICE_AI_OUTBOUND_ESCALATION_FRUSTRATION_THRESHOLD,
  VOICE_AI_OUTBOUND_MAX_ACTIVE_SESSIONS_PER_ORG,
  VOICE_AI_OUTBOUND_MAX_CONCURRENT_INITIATIONS,
  VOICE_AI_OUTBOUND_MAX_RETRY_ATTEMPTS,
  VOICE_AI_OUTBOUND_QA_MARKER,
  VOICE_AI_OUTBOUND_STALE_SESSION_MINUTES,
} from "@/lib/voice/ai-outbound/types"
import { analyzeVoicemailSignal } from "@/lib/voice/ai-outbound/voicemail-handler"
import {
  evaluateAndAuditCompliance,
  isComplianceOrchestrationEnabled,
} from "@/lib/voice/compliance-orchestration/compliance-orchestration-service"
import type { VoiceConsentChannel } from "@/lib/voice/compliance-orchestration/types"
import {
  appendOutboundEvent,
  cleanupStaleOutboundSessions,
  countActiveOutboundSessions,
  countBlockedOutboundSessions,
  countPendingApprovalOutboundSessions,
  createOutboundSession,
  getOutboundSession,
  listActiveOutboundSessions,
  listOutboundEvents,
  listPendingApprovalOutboundSessions,
  updateOutboundSession,
} from "@/lib/voice/repository/voice-ai-outbound-repository"
import { probeVoiceSchemaHealth } from "@/lib/voice/schema-health"

function resolveProvider(mode: ReturnType<typeof resolveVoiceAiOutboundProviderMode>): VoiceAiOutboundProvider {
  switch (mode) {
    case "deepgram":
      return deepgramOutboundProvider
    case "openai_realtime":
      return openAiRealtimeOutboundProvider
    case "elevenlabs":
      return elevenLabsOutboundProvider
    case "stub":
      return stubOutboundProvider
    default:
      return deterministicOutboundProvider
  }
}

function complianceChannelForWorkflow(workflowType: VoiceAiOutboundWorkflowType): VoiceConsentChannel {
  if (workflowType === "voicemail_followup") return "voicemail"
  return "callback"
}

function buildDefaultMessagePreview(workflowType: VoiceAiOutboundWorkflowType): string {
  switch (workflowType) {
    case "missed_call_callback":
      return "Following up on your missed call — is now a good time?"
    case "voicemail_followup":
      return "Following up on your voicemail message."
    case "appointment_confirmation":
      return "Calling to confirm your upcoming appointment."
    case "appointment_reminder":
      return "Reminder about your scheduled appointment."
    case "qualification_callback":
      return "Following up on your service inquiry."
    case "after_hours_followup":
      return "Following up on your after-hours inquiry."
    case "warm_reengagement":
      return "Following up on our recent conversation."
    default:
      return "Operator-assisted callback follow-up."
  }
}

async function evaluateOutboundCompliance(
  admin: SupabaseClient,
  input: {
    organizationId: string
    phoneNumber: string
    workflowType: VoiceAiOutboundWorkflowType
    createdBy?: string | null
  },
) {
  return evaluateAndAuditCompliance(admin, {
    organizationId: input.organizationId,
    phoneNumber: input.phoneNumber,
    channel: complianceChannelForWorkflow(input.workflowType),
    campaignType: input.workflowType,
    createdBy: input.createdBy ?? null,
  })
}

export async function fetchAiOutboundReadiness(
  admin: SupabaseClient,
  organizationId: string,
): Promise<VoiceAiOutboundReadinessSnapshot> {
  const schema = await probeVoiceSchemaHealth(admin)
  const providerMode = resolveVoiceAiOutboundProviderMode()
  const provider = resolveProvider(providerMode)
  const [activeSessionCount, pendingApprovalCount] = await Promise.all([
    countActiveOutboundSessions(admin, organizationId),
    countPendingApprovalOutboundSessions(admin, organizationId),
  ])

  const enabled = isVoiceAiOutboundEnabled()
  const complianceReady = schema.ready && isComplianceOrchestrationEnabled()

  return {
    qaMarker: VOICE_AI_OUTBOUND_QA_MARKER,
    schemaReady: schema.ready,
    outboundEnabled: enabled,
    providerMode,
    complianceReadiness: complianceReady,
    consentReadiness: complianceReady,
    operatorApprovalReady: true,
    escalationRoutingReady: schema.ready,
    voicemailReadiness: schema.ready,
    providerReady: provider.isConfigured() || providerMode === "deterministic",
    fallbackReady: true,
    activeSessionCount,
    pendingApprovalCount,
    maxActiveSessions: VOICE_AI_OUTBOUND_MAX_ACTIVE_SESSIONS_PER_ORG,
    maxConcurrentInitiations: VOICE_AI_OUTBOUND_MAX_CONCURRENT_INITIATIONS,
    autonomousOutboundDisabled: true,
    autonomousColdCallingDisabled: true,
    approvalRequired: true,
    message: enabled
      ? "AI outbound enabled — supervised, approval-gated, compliance-checked. Autonomous cold calling disabled."
      : "Set VOICE_AI_OUTBOUND_ENABLED=true to activate supervised AI outbound.",
  }
}

export async function fetchAiOutboundApprovalQueue(
  admin: SupabaseClient,
  organizationId: string,
): Promise<VoiceAiOutboundApprovalQueueSnapshot> {
  const [pendingSessions, blockedCount] = await Promise.all([
    listPendingApprovalOutboundSessions(admin, organizationId),
    countBlockedOutboundSessions(admin, organizationId),
  ])
  return buildOutboundApprovalQueueSnapshot({ pendingSessions, blockedCount })
}

export async function fetchAiOutboundWorkspaceSnapshot(
  admin: SupabaseClient,
  organizationId: string,
): Promise<VoiceAiOutboundWorkspaceSnapshot> {
  const [activeSessions, pendingApprovalCount] = await Promise.all([
    listActiveOutboundSessions(admin, organizationId),
    countPendingApprovalOutboundSessions(admin, organizationId),
  ])
  const recentEvents =
    activeSessions.length > 0
      ? await listOutboundEvents(admin, organizationId, activeSessions[0]!.id, 15)
      : []
  return buildOutboundWorkspaceSnapshot({ activeSessions, recentEvents, pendingApprovalCount })
}

export async function queueOutboundAiSession(
  admin: SupabaseClient,
  input: {
    organizationId: string
    phoneNumber: string
    outboundWorkflowType: VoiceAiOutboundWorkflowType
    relatedCustomerId?: string | null
    relatedProspectId?: string | null
    relationshipMemoryProfileId?: string | null
    sourceRecoveryEventId?: string | null
    sourceCampaignId?: string | null
    messagePreview?: string | null
    createdBy?: string | null
  },
): Promise<VoiceAiOutboundSessionPublicView> {
  if (!isVoiceAiOutboundEnabled()) {
    throw new Error("AI outbound is not enabled.")
  }

  const compliance = await evaluateOutboundCompliance(admin, input)
  const providerMode = resolveVoiceAiOutboundProviderMode()
  const messagePreview = input.messagePreview ?? buildDefaultMessagePreview(input.outboundWorkflowType)

  if (compliance.blocked) {
    const session = await createOutboundSession(admin, {
      organizationId: input.organizationId,
      phoneNumber: input.phoneNumber,
      outboundWorkflowType: input.outboundWorkflowType,
      aiProvider: providerMode,
      relatedCustomerId: input.relatedCustomerId,
      relatedProspectId: input.relatedProspectId,
      relationshipMemoryProfileId: input.relationshipMemoryProfileId,
      sourceRecoveryEventId: input.sourceRecoveryEventId,
      sourceCampaignId: input.sourceCampaignId,
      messagePreview,
      complianceDecision: compliance.decision,
      complianceReasons: compliance.reasons,
      manualReviewRequired: compliance.manualReviewRequired,
    })

    await updateOutboundSession(admin, {
      organizationId: input.organizationId,
      sessionId: session.id,
      patch: { outboundSessionStatus: "blocked_by_compliance", endedAt: new Date().toISOString() },
    })

    await appendOutboundEvent(admin, {
      organizationId: input.organizationId,
      sessionId: session.id,
      eventType: "compliance_blocked",
      evidenceText: compliance.reasons.join("; ") || "Compliance blocked outbound session.",
      payload: { decision: compliance.decision, reasons: compliance.reasons },
      createdBy: input.createdBy ?? null,
    })

    return (await getOutboundSession(admin, input.organizationId, session.id))!
  }

  const session = await createOutboundSession(admin, {
    organizationId: input.organizationId,
    phoneNumber: input.phoneNumber,
    outboundWorkflowType: input.outboundWorkflowType,
    aiProvider: providerMode,
    relatedCustomerId: input.relatedCustomerId,
    relatedProspectId: input.relatedProspectId,
    relationshipMemoryProfileId: input.relationshipMemoryProfileId,
    sourceRecoveryEventId: input.sourceRecoveryEventId,
    sourceCampaignId: input.sourceCampaignId,
    messagePreview,
    complianceDecision: compliance.decision,
    complianceReasons: compliance.reasons,
    manualReviewRequired: compliance.manualReviewRequired,
  })

  await appendOutboundEvent(admin, {
    organizationId: input.organizationId,
    sessionId: session.id,
    eventType: "compliance_passed",
    evidenceText: compliance.allowed
      ? "Compliance passed — awaiting operator approval."
      : "Compliance requires manual review — awaiting operator approval.",
    payload: { decision: compliance.decision, reasons: compliance.reasons, allowed: compliance.allowed },
    createdBy: input.createdBy ?? null,
  })

  await appendOutboundEvent(admin, {
    organizationId: input.organizationId,
    sessionId: session.id,
    eventType: "session_queued",
    evidenceText: "Outbound session queued — operator approval required before initiation.",
    createdBy: input.createdBy ?? null,
  })

  return session
}

export async function applyOutboundApprovalAction(
  admin: SupabaseClient,
  input: {
    organizationId: string
    sessionId: string
    action: OutboundApprovalAction
    userId: string
    scheduledAt?: string | null
  },
): Promise<VoiceAiOutboundSessionPublicView> {
  const session = await getOutboundSession(admin, input.organizationId, input.sessionId)
  if (!session) throw new Error("Outbound session not found.")

  if (!canApplyOutboundApproval(input.action, session.outboundSessionStatus)) {
    throw new Error(`Cannot ${input.action} session in status ${session.outboundSessionStatus}.`)
  }

  const transition = applyOutboundApprovalTransition(input.action)
  if (!transition) throw new Error("Invalid approval action.")

  if (input.action === "approve" || input.action === "schedule") {
    const compliance = await evaluateOutboundCompliance(admin, {
      organizationId: input.organizationId,
      phoneNumber: session.phoneNumber,
      workflowType: session.outboundWorkflowType,
      createdBy: input.userId,
    })

    if (compliance.blocked) {
      await updateOutboundSession(admin, {
        organizationId: input.organizationId,
        sessionId: session.id,
        patch: {
          outboundSessionStatus: "blocked_by_compliance",
          complianceDecision: compliance.decision,
          complianceReasons: compliance.reasons,
          endedAt: new Date().toISOString(),
        },
      })
      await appendOutboundEvent(admin, {
        organizationId: input.organizationId,
        sessionId: session.id,
        eventType: "compliance_blocked",
        evidenceText: "Compliance blocked at approval time.",
        payload: { reasons: compliance.reasons },
        createdBy: input.userId,
      })
      return (await getOutboundSession(admin, input.organizationId, session.id))!
    }
  }

  const updated = await updateOutboundSession(admin, {
    organizationId: input.organizationId,
    sessionId: session.id,
    patch: {
      outboundSessionStatus: transition.status,
      operatorSupervisionMode: transition.supervisionMode,
      approvedBy: input.action === "approve" || input.action === "schedule" ? input.userId : session.approvedBy,
      approvedAt:
        input.action === "approve" || input.action === "schedule" ? new Date().toISOString() : session.approvedAt,
      metadata:
        input.action === "schedule" && input.scheduledAt
          ? { ...session.metadata, scheduledAt: input.scheduledAt }
          : session.metadata,
    },
  })

  if (input.action === "approve" || input.action === "schedule") {
    await appendOutboundEvent(admin, {
      organizationId: input.organizationId,
      sessionId: session.id,
      eventType: "operator_approved",
      evidenceText: `Operator ${input.action === "schedule" ? "scheduled" : "approved"} outbound session.`,
      createdBy: input.userId,
    })
  } else {
    await appendOutboundEvent(admin, {
      organizationId: input.organizationId,
      sessionId: session.id,
      eventType: "session_canceled",
      evidenceText: `Operator ${input.action} outbound session.`,
      createdBy: input.userId,
    })
  }

  return updated!
}

export async function initiateOutboundAiSession(
  admin: SupabaseClient,
  input: {
    organizationId: string
    sessionId: string
    voiceCallId?: string | null
    userId?: string | null
  },
): Promise<VoiceAiOutboundSessionPublicView> {
  const session = await getOutboundSession(admin, input.organizationId, input.sessionId)
  if (!session) throw new Error("Outbound session not found.")

  if (!canInitiateOutboundSession(session.outboundSessionStatus)) {
    throw new Error(`Cannot initiate session in status ${session.outboundSessionStatus}.`)
  }

  const activeCount = await countActiveOutboundSessions(admin, input.organizationId)
  if (activeCount >= VOICE_AI_OUTBOUND_MAX_ACTIVE_SESSIONS_PER_ORG) {
    throw new Error("Maximum active outbound AI sessions reached.")
  }

  const compliance = await evaluateOutboundCompliance(admin, {
    organizationId: input.organizationId,
    phoneNumber: session.phoneNumber,
    workflowType: session.outboundWorkflowType,
    createdBy: input.userId ?? null,
  })

  if (compliance.blocked) {
    await updateOutboundSession(admin, {
      organizationId: input.organizationId,
      sessionId: session.id,
      patch: {
        outboundSessionStatus: "blocked_by_compliance",
        complianceDecision: compliance.decision,
        complianceReasons: compliance.reasons,
        endedAt: new Date().toISOString(),
      },
    })
    await appendOutboundEvent(admin, {
      organizationId: input.organizationId,
      sessionId: session.id,
      eventType: "compliance_blocked",
      evidenceText: "Compliance blocked at initiation.",
      createdBy: input.userId ?? null,
    })
    return (await getOutboundSession(admin, input.organizationId, session.id))!
  }

  const now = new Date().toISOString()
  await updateOutboundSession(admin, {
    organizationId: input.organizationId,
    sessionId: session.id,
    patch: {
      outboundSessionStatus: "initiating",
      voiceCallId: input.voiceCallId ?? session.voiceCallId,
      startedAt: now,
      metadata: {
        ...session.metadata,
        retryCount: 0,
        fsm: createInitialOutboundFsmState(true),
        qualificationState: {},
        qualificationStepIndex: 0,
      },
    },
  })

  await appendOutboundEvent(admin, {
    organizationId: input.organizationId,
    sessionId: session.id,
    eventType: "outbound_started",
    evidenceText: "Outbound AI session initiated after operator approval.",
    voiceCallId: input.voiceCallId ?? session.voiceCallId,
    createdBy: input.userId ?? null,
  })

  return (await getOutboundSession(admin, input.organizationId, session.id))!
}

export async function processOutboundAiTurn(
  admin: SupabaseClient,
  input: {
    organizationId: string
    sessionId: string
    calleeText: string
    transcriptSegmentId?: string | null
    operatorJoined?: boolean
    organizationName?: string | null
  },
): Promise<{ session: VoiceAiOutboundSessionPublicView; spokenText: string | null }> {
  const session = await getOutboundSession(admin, input.organizationId, input.sessionId)
  if (!session) throw new Error("Outbound session not found.")

  if (["completed", "failed", "blocked_by_compliance", "canceled"].includes(session.outboundSessionStatus)) {
    return { session, spokenText: null }
  }

  const compliance = await evaluateOutboundCompliance(admin, {
    organizationId: input.organizationId,
    phoneNumber: session.phoneNumber,
    workflowType: session.outboundWorkflowType,
  })

  if (compliance.blocked || detectOptOutIntent(input.calleeText)) {
    const spokenText = detectOptOutIntent(input.calleeText)
      ? buildOutboundOptOutTerminationMessage()
      : null

    await updateOutboundSession(admin, {
      organizationId: input.organizationId,
      sessionId: session.id,
      patch: {
        outboundSessionStatus: "completed",
        endedAt: new Date().toISOString(),
        complianceDecision: compliance.decision,
        complianceReasons: compliance.reasons,
      },
    })

    await appendOutboundEvent(admin, {
      organizationId: input.organizationId,
      sessionId: session.id,
      eventType: detectOptOutIntent(input.calleeText) ? "opt_out_detected" : "compliance_blocked",
      evidenceText: detectOptOutIntent(input.calleeText)
        ? "Opt-out detected — terminating outbound session."
        : "Compliance changed mid-session — terminating.",
      transcriptSegmentId: input.transcriptSegmentId ?? null,
    })

    if (spokenText) {
      await appendOutboundEvent(admin, {
        organizationId: input.organizationId,
        sessionId: session.id,
        eventType: "conversation_terminated",
        evidenceText: spokenText,
      })
    }

    return { session: (await getOutboundSession(admin, input.organizationId, session.id))!, spokenText }
  }

  const metadata = session.metadata
  const fsmState = (metadata.fsm as ReturnType<typeof createInitialOutboundFsmState>) ?? createInitialOutboundFsmState(true)
  const qualificationState = (metadata.qualificationState as Record<string, unknown>) ?? {}
  let qualificationStepIndex = Number(metadata.qualificationStepIndex ?? 0)

  const voicemail = analyzeVoicemailSignal({
    calleeText: input.calleeText,
    organizationName: input.organizationName ?? null,
    callbackNumber: null,
    workflowType: session.outboundWorkflowType,
  })

  if (voicemail.detected) {
    await appendOutboundEvent(admin, {
      organizationId: input.organizationId,
      sessionId: session.id,
      eventType: "voicemail_detected",
      evidenceText: voicemail.evidenceText,
      transcriptSegmentId: input.transcriptSegmentId ?? null,
    })
  }

  const nextFsm = transitionOutboundFsm({
    current: fsmState,
    calleeText: input.calleeText,
    workflowType: session.outboundWorkflowType,
    operatorJoined: input.operatorJoined ?? false,
    operatorApproved: Boolean(session.approvedBy),
    complianceBlocked: false,
    providerFailed: false,
    silenceDetected: !input.calleeText.trim(),
    interruptionDetected: false,
  })

  let schedulingPrompt: string | null = null
  let qualificationPrompt: string | null = null

  if (nextFsm.phase === "scheduling") {
    const intent = detectSchedulingIntent(input.calleeText)
    schedulingPrompt = buildSchedulingPrompt(session.outboundWorkflowType, intent)
    if (requiresHumanSchedulingConfirmation(intent)) {
      await appendOutboundEvent(admin, {
        organizationId: input.organizationId,
        sessionId: session.id,
        eventType: "scheduling_requested",
        evidenceText: `Scheduling intent: ${intent} — human confirmation required.`,
      })
    }
  }

  if (nextFsm.phase === "qualification" && input.calleeText.trim()) {
    const currentStep = getCurrentOutboundQualificationStep(DEFAULT_OUTBOUND_QUALIFICATION_STEPS, qualificationStepIndex)
    if (currentStep) {
      qualificationState[currentStep.key] = input.calleeText.trim()
      qualificationStepIndex += 1
    }
    const nextStep = getCurrentOutboundQualificationStep(DEFAULT_OUTBOUND_QUALIFICATION_STEPS, qualificationStepIndex)
    qualificationPrompt = nextStep?.prompt ?? null
    if (isOutboundQualificationComplete(DEFAULT_OUTBOUND_QUALIFICATION_STEPS, qualificationState)) {
      await appendOutboundEvent(admin, {
        organizationId: input.organizationId,
        sessionId: session.id,
        eventType: "qualification_completed",
        evidenceText: "Outbound qualification complete.",
        payload: qualificationState,
      })
    }
  }

  const escalation = evaluateOutboundEscalation({
    confusionCount: nextFsm.confusionCount,
    frustrationCount: nextFsm.frustrationCount,
    providerFailed: false,
    guardrailEscalate: false,
    operatorRequested: /\b(operator|human|person|representative)\b/i.test(input.calleeText),
    schedulingComplex: nextFsm.phase === "scheduling" && requiresHumanSchedulingConfirmation(detectSchedulingIntent(input.calleeText)),
    confusionThreshold: VOICE_AI_OUTBOUND_ESCALATION_CONFUSION_THRESHOLD,
    frustrationThreshold: VOICE_AI_OUTBOUND_ESCALATION_FRUSTRATION_THRESHOLD,
  })

  if (escalation.shouldEscalate) {
    await appendOutboundEvent(admin, {
      organizationId: input.organizationId,
      sessionId: session.id,
      eventType: "escalation_triggered",
      evidenceText: escalation.handoffSummary,
      payload: { reason: escalation.reason },
    })
  }

  const providerMode = resolveVoiceAiOutboundProviderMode()
  const provider = resolveProvider(providerMode)
  const response = await generateOutboundResponseWithTimeout(provider, {
    organizationId: input.organizationId,
    sessionId: session.id,
    phoneNumber: session.phoneNumber,
    calleeText: input.calleeText,
    phase: nextFsm.phase,
    workflowType: session.outboundWorkflowType,
    organizationName: input.organizationName ?? null,
    messagePreview: session.messagePreview,
    qualificationPrompt,
    schedulingPrompt,
    voicemailMode: nextFsm.voicemailDetected || voicemail.detected,
  })

  const sanitized = sanitizeOutboundResponse(response.spokenText)

  await appendOutboundEvent(admin, {
    organizationId: input.organizationId,
    sessionId: session.id,
    eventType: "ai_response_generated",
    evidenceText: response.evidenceText,
    providerSource: response.providerId,
    transcriptSegmentId: input.transcriptSegmentId ?? null,
    payload: { spokenText: sanitized.text, latencyMs: response.latencyMs },
  })

  if (response.providerId !== providerMode && providerMode !== "deterministic") {
    await appendOutboundEvent(admin, {
      organizationId: input.organizationId,
      sessionId: session.id,
      eventType: "provider_fallback",
      evidenceText: `Fallback from ${providerMode} to ${response.providerId}.`,
    })
  }

  const patchStatus = input.operatorJoined
    ? "operator_joined"
    : escalation.shouldEscalate
      ? "escalation_pending"
      : nextFsm.status

  await updateOutboundSession(admin, {
    organizationId: input.organizationId,
    sessionId: session.id,
    patch: {
      outboundSessionStatus: patchStatus,
      escalationState: escalation.shouldEscalate ? escalation.nextEscalationState : session.escalationState,
      metadata: {
        ...metadata,
        fsm: nextFsm,
        qualificationState,
        qualificationStepIndex,
        handoffSummary: escalation.shouldEscalate
          ? buildOutboundHandoffSummary({
              workflowType: session.outboundWorkflowType,
              phoneNumber: session.phoneNumber,
              qualificationState,
              escalationReason: escalation.reason,
            })
          : metadata.handoffSummary ?? null,
        lastLatencyMs: response.latencyMs,
      },
      endedAt: nextFsm.phase === "terminated" ? new Date().toISOString() : null,
    },
  })

  if (nextFsm.phase === "terminated") {
    await appendOutboundEvent(admin, {
      organizationId: input.organizationId,
      sessionId: session.id,
      eventType: "conversation_terminated",
      evidenceText: "Outbound conversation terminated.",
    })
  }

  return {
    session: (await getOutboundSession(admin, input.organizationId, session.id))!,
    spokenText: sanitized.text,
  }
}

export async function operatorTakeoverOutboundSession(
  admin: SupabaseClient,
  input: {
    organizationId: string
    sessionId: string
    operatorId: string
  },
): Promise<VoiceAiOutboundSessionPublicView> {
  const session = await getOutboundSession(admin, input.organizationId, input.sessionId)
  if (!session) throw new Error("Outbound session not found.")

  if (!canOperatorTakeover(session.outboundSessionStatus)) {
    throw new Error(`Cannot takeover session in status ${session.outboundSessionStatus}.`)
  }

  await updateOutboundSession(admin, {
    organizationId: input.organizationId,
    sessionId: session.id,
    patch: {
      outboundSessionStatus: "operator_joined",
      operatorSupervisionMode: "operator_joined",
      metadata: { ...session.metadata, activeOperatorId: input.operatorId },
    },
  })

  await appendOutboundEvent(admin, {
    organizationId: input.organizationId,
    sessionId: session.id,
    eventType: "operator_joined",
    evidenceText: "Operator joined outbound AI session — AI paused.",
    createdBy: input.operatorId,
    payload: { handoffSummary: session.metadata.handoffSummary ?? null },
  })

  return (await getOutboundSession(admin, input.organizationId, session.id))!
}

export async function cleanupStaleOutboundAiSessions(
  admin: SupabaseClient,
  organizationId: string,
): Promise<number> {
  const staleBefore = new Date(Date.now() - VOICE_AI_OUTBOUND_STALE_SESSION_MINUTES * 60_000).toISOString()
  return cleanupStaleOutboundSessions(admin, organizationId, staleBefore)
}

export { VOICE_AI_OUTBOUND_MAX_RETRY_ATTEMPTS }
