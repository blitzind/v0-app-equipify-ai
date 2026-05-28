import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  createInitialReceptionistFsmState,
  transitionReceptionistFsm,
} from "@/lib/voice/ai-receptionist/conversation-state-machine"
import { matchApprovedFaq } from "@/lib/voice/ai-receptionist/faq-orchestrator"
import { detectCallerIntent } from "@/lib/voice/ai-receptionist/intent-router"
import {
  applyQualificationAnswer,
  buildDefaultQualificationFlow,
  getCurrentQualificationStep,
  isQualificationComplete,
} from "@/lib/voice/ai-receptionist/qualification-flows"
import { analyzeInterruption } from "@/lib/voice/ai-receptionist/interruption-handler"
import {
  deepgramReceptionistProvider,
  deterministicReceptionistProvider,
  elevenLabsReceptionistProvider,
  generateReceptionistResponseWithTimeout,
  openAiRealtimeReceptionistProvider,
  stubReceptionistProvider,
} from "@/lib/voice/ai-receptionist/provider-registry"
import {
  isVoiceAiReceptionistEnabled,
  resolveVoiceAiReceptionistProviderMode,
  type VoiceAiReceptionistProvider,
} from "@/lib/voice/ai-receptionist/provider-types"
import { buildAiReceptionistWorkspaceSnapshot } from "@/lib/voice/ai-receptionist/snapshot-builder"
import {
  buildMissedCallRecoveryHook,
  buildReceptionistHandoffDraft,
} from "@/lib/voice/ai-receptionist/transfer-preparation"
import type {
  VoiceAiReceptionistCallerIntent,
  VoiceAiReceptionistReadinessSnapshot,
  VoiceAiReceptionistWorkspaceSnapshot,
} from "@/lib/voice/ai-receptionist/types"
import {
  VOICE_AI_RECEPTIONIST_MAX_ACTIVE_SESSIONS_PER_ORG,
  VOICE_AI_RECEPTIONIST_QA_MARKER,
} from "@/lib/voice/ai-receptionist/types"
import {
  appendReceptionistEvent,
  countActiveReceptionistSessions,
  createReceptionistSession,
  ensureDefaultReceptionistConfig,
  getActiveReceptionistSessionForCall,
  getQualificationFlow,
  listFaqEntries,
  listReceptionistEvents,
  updateReceptionistSession,
} from "@/lib/voice/repository/voice-ai-receptionist-repository"
import { probeVoiceSchemaHealth } from "@/lib/voice/schema-health"

function resolveProvider(mode: ReturnType<typeof resolveVoiceAiReceptionistProviderMode>): VoiceAiReceptionistProvider {
  switch (mode) {
    case "deepgram":
      return deepgramReceptionistProvider
    case "openai_realtime":
      return openAiRealtimeReceptionistProvider
    case "elevenlabs":
      return elevenLabsReceptionistProvider
    case "stub":
      return stubReceptionistProvider
    default:
      return deterministicReceptionistProvider
  }
}

export async function fetchAiReceptionistReadiness(
  admin: SupabaseClient,
  organizationId: string,
): Promise<VoiceAiReceptionistReadinessSnapshot> {
  const schema = await probeVoiceSchemaHealth(admin)
  const providerMode = resolveVoiceAiReceptionistProviderMode()
  const provider = resolveProvider(providerMode)
  const activeSessionCount = await countActiveReceptionistSessions(admin, organizationId)
  const faqs = schema.ready ? await listFaqEntries(admin, organizationId) : []
  const flow = schema.ready ? await getQualificationFlow(admin, organizationId) : null

  const enabled = isVoiceAiReceptionistEnabled()

  return {
    qaMarker: VOICE_AI_RECEPTIONIST_QA_MARKER,
    schemaReady: schema.ready,
    receptionistEnabled: enabled,
    providerMode,
    realtimeAudioReady: provider.isConfigured() || providerMode === "deterministic",
    faqReady: faqs.length > 0,
    qualificationFlowReady: Boolean(flow),
    escalationRoutingReady: schema.ready,
    operatorTakeoverReady: schema.ready,
    guardrailsEnabled: true,
    autonomousOutboundDisabled: true,
    aiDisclosureEnabled: true,
    activeSessionCount,
    maxActiveSessions: VOICE_AI_RECEPTIONIST_MAX_ACTIVE_SESSIONS_PER_ORG,
    latencyTargetMs: 1500,
    message: enabled
      ? "AI inbound receptionist enabled — bounded, supervised, operator-overridable."
      : "Set VOICE_AI_RECEPTIONIST_ENABLED=true to activate inbound AI receptionist routing.",
  }
}

export async function fetchAiReceptionistWorkspaceSnapshot(
  admin: SupabaseClient,
  input: {
    organizationId: string
    voiceCallId: string
    currentIntent?: VoiceAiReceptionistCallerIntent | null
  },
): Promise<VoiceAiReceptionistWorkspaceSnapshot> {
  const session = await getActiveReceptionistSessionForCall(admin, input.organizationId, input.voiceCallId)
  const events = session
    ? await listReceptionistEvents(admin, input.organizationId, session.id, 20)
    : []
  const flow =
    (await getQualificationFlow(admin, input.organizationId)) ??
    buildDefaultQualificationFlow(input.organizationId)

  return buildAiReceptionistWorkspaceSnapshot({
    voiceCallId: input.voiceCallId,
    session,
    recentEvents: events,
    currentIntent: input.currentIntent ?? null,
    qualificationFlow: flow,
  })
}

export async function startAiReceptionistSessionForCall(
  admin: SupabaseClient,
  input: {
    organizationId: string
    voiceCallId: string
    relationshipMemoryProfileId?: string | null
    relationshipSummary?: string | null
    afterHours?: boolean
    callerNumber?: string | null
  },
): Promise<VoiceAiReceptionistWorkspaceSnapshot> {
  if (!isVoiceAiReceptionistEnabled()) {
    throw new Error("AI receptionist is not enabled.")
  }

  const activeCount = await countActiveReceptionistSessions(admin, input.organizationId)
  if (activeCount >= VOICE_AI_RECEPTIONIST_MAX_ACTIVE_SESSIONS_PER_ORG) {
    throw new Error("Maximum active AI receptionist sessions reached.")
  }

  await ensureDefaultReceptionistConfig(admin, input.organizationId)

  const existing = await getActiveReceptionistSessionForCall(admin, input.organizationId, input.voiceCallId)
  if (existing) {
    return fetchAiReceptionistWorkspaceSnapshot(admin, {
      organizationId: input.organizationId,
      voiceCallId: input.voiceCallId,
    })
  }

  const providerMode = resolveVoiceAiReceptionistProviderMode()
  const session = await createReceptionistSession(admin, {
    organizationId: input.organizationId,
    voiceCallId: input.voiceCallId,
    relationshipMemoryProfileId: input.relationshipMemoryProfileId,
    aiProvider: providerMode,
    metadata: {
      relationshipSummary: input.relationshipSummary ?? null,
      afterHours: input.afterHours ?? false,
      callerNumber: input.callerNumber ?? null,
    },
  })

  await appendReceptionistEvent(admin, {
    organizationId: input.organizationId,
    sessionId: session.id,
    voiceCallId: input.voiceCallId,
    eventType: "session_started",
    evidenceText: "AI receptionist session started for inbound call.",
    providerSource: providerMode,
    idempotencyKey: `session_start:${session.id}`,
  })

  const provider = resolveProvider(providerMode)
  const response = await generateReceptionistResponseWithTimeout(provider, {
    organizationId: input.organizationId,
    voiceCallId: input.voiceCallId,
    callerText: "",
    phase: "greeting",
    intent: null,
    relationshipSummary: input.relationshipSummary ?? null,
    faqAnswer: null,
    qualificationPrompt: null,
    afterHours: input.afterHours ?? false,
  })

  await appendReceptionistEvent(admin, {
    organizationId: input.organizationId,
    sessionId: session.id,
    voiceCallId: input.voiceCallId,
    eventType: "ai_response_generated",
    evidenceText: response.evidenceText,
    providerSource: response.providerId,
    payload: { spokenText: response.spokenText, latencyMs: response.latencyMs },
    idempotencyKey: `greeting:${session.id}`,
  })

  await updateReceptionistSession(admin, {
    organizationId: input.organizationId,
    sessionId: session.id,
    patch: { latencyMsLast: response.latencyMs },
  })

  return fetchAiReceptionistWorkspaceSnapshot(admin, {
    organizationId: input.organizationId,
    voiceCallId: input.voiceCallId,
  })
}

export async function processAiReceptionistTurn(
  admin: SupabaseClient,
  input: {
    organizationId: string
    voiceCallId: string
    callerText: string
    callerSpeaking?: boolean
    aiSpeaking?: boolean
    afterHours?: boolean
    transcriptSegmentId?: string | null
  },
): Promise<VoiceAiReceptionistWorkspaceSnapshot & { spokenText: string | null }> {
  const session = await getActiveReceptionistSessionForCall(admin, input.organizationId, input.voiceCallId)
  if (!session) {
    const snapshot = await fetchAiReceptionistWorkspaceSnapshot(admin, {
      organizationId: input.organizationId,
      voiceCallId: input.voiceCallId,
    })
    return { ...snapshot, spokenText: null }
  }

  const interruption = analyzeInterruption({
    callerSpeaking: input.callerSpeaking ?? false,
    aiSpeaking: input.aiSpeaking ?? false,
    lastCallerSegmentMs: 200,
  })

  if (interruption.interrupted) {
    await appendReceptionistEvent(admin, {
      organizationId: input.organizationId,
      sessionId: session.id,
      voiceCallId: input.voiceCallId,
      eventType: "interruption_detected",
      evidenceText: interruption.evidenceText,
      transcriptSegmentId: input.transcriptSegmentId ?? null,
      providerSource: session.aiProvider,
    })
  }

  const intent = detectCallerIntent(input.callerText)
  await appendReceptionistEvent(admin, {
    organizationId: input.organizationId,
    sessionId: session.id,
    voiceCallId: input.voiceCallId,
    eventType: "caller_intent_detected",
    evidenceText: `Intent ${intent} from caller text.`,
    transcriptSegmentId: input.transcriptSegmentId ?? null,
    providerSource: session.aiProvider,
    payload: { intent, callerText: input.callerText },
  })

  const faqs = await listFaqEntries(admin, input.organizationId)
  const faqMatch = matchApprovedFaq(input.callerText, faqs)
  const flow =
    (await getQualificationFlow(admin, input.organizationId)) ??
    buildDefaultQualificationFlow(input.organizationId)

  let qualState = { ...session.qualificationState }
  const step = getCurrentQualificationStep(flow, Object.keys(qualState).length)
  if (step && session.currentConversationPhase === "qualification") {
    qualState = applyQualificationAnswer(qualState, step.key, input.callerText)
    await appendReceptionistEvent(admin, {
      organizationId: input.organizationId,
      sessionId: session.id,
      voiceCallId: input.voiceCallId,
      eventType: "qualification_answer",
      evidenceText: `Captured ${step.key}.`,
      transcriptSegmentId: input.transcriptSegmentId ?? null,
      providerSource: session.aiProvider,
      payload: { step: step.key, answer: input.callerText },
    })
  }

  const fsm = transitionReceptionistFsm({
    current: {
      phase: session.currentConversationPhase,
      status: session.receptionistStatus,
      intent,
      qualificationStepIndex: Object.keys(qualState).length,
      escalationRequired: session.escalationRiskLevel !== "low",
    },
    callerText: input.callerText,
    intent,
    qualificationComplete: isQualificationComplete(flow, qualState),
    faqMatched: faqMatch.matched,
    operatorJoined: false,
    interruptionDetected: interruption.interrupted,
    providerFailed: false,
    afterHours: input.afterHours ?? false,
  })

  if (fsm.escalationRequired) {
    await appendReceptionistEvent(admin, {
      organizationId: input.organizationId,
      sessionId: session.id,
      voiceCallId: input.voiceCallId,
      eventType: "escalation_detected",
      evidenceText: `Escalation required — intent ${intent}.`,
      providerSource: session.aiProvider,
    })
  }

  const provider = resolveProvider(session.aiProvider)
  const faqAnswer = faqMatch.matched ? faqMatch.entry.approvedAnswer : null
  const qualPrompt =
    fsm.phase === "qualification"
      ? getCurrentQualificationStep(flow, Object.keys(qualState).length)?.prompt ?? null
      : null

  const response = await generateReceptionistResponseWithTimeout(provider, {
    organizationId: input.organizationId,
    voiceCallId: input.voiceCallId,
    callerText: input.callerText,
    phase: fsm.phase,
    intent,
    relationshipSummary: (session.metadata.relationshipSummary as string | null) ?? null,
    faqAnswer,
    qualificationPrompt: qualPrompt,
    afterHours: input.afterHours ?? false,
  })

  if (faqMatch.matched) {
    await appendReceptionistEvent(admin, {
      organizationId: input.organizationId,
      sessionId: session.id,
      voiceCallId: input.voiceCallId,
      eventType: "faq_answered",
      evidenceText: `FAQ topic ${faqMatch.entry.topic}.`,
      providerSource: session.aiProvider,
    })
  }

  if (fsm.phase === "scheduling") {
    await appendReceptionistEvent(admin, {
      organizationId: input.organizationId,
      sessionId: session.id,
      voiceCallId: input.voiceCallId,
      eventType: "scheduling_requested",
      evidenceText: "Scheduling intake — operator approval required for booking.",
      providerSource: session.aiProvider,
    })
  }

  if (fsm.status === "transfer_pending") {
    await appendReceptionistEvent(admin, {
      organizationId: input.organizationId,
      sessionId: session.id,
      voiceCallId: input.voiceCallId,
      eventType: "transfer_requested",
      evidenceText: "Transfer to human operator requested.",
      providerSource: session.aiProvider,
    })
  }

  const handoff = buildReceptionistHandoffDraft({
    session: { ...session, qualificationState: qualState },
    callerIntent: intent,
    recentTranscript: [input.callerText],
  })

  await updateReceptionistSession(admin, {
    organizationId: input.organizationId,
    sessionId: session.id,
    patch: {
      receptionistStatus: fsm.status,
      currentConversationPhase: fsm.phase,
      escalationRiskLevel: fsm.escalationRequired ? "elevated" : "low",
      qualificationState: qualState,
      handoffSummaryDraft: handoff.summary,
      latencyMsLast: response.latencyMs,
    },
  })

  await appendReceptionistEvent(admin, {
    organizationId: input.organizationId,
    sessionId: session.id,
    voiceCallId: input.voiceCallId,
    eventType: "ai_response_generated",
    evidenceText: response.evidenceText,
    providerSource: response.providerId,
    payload: { spokenText: response.spokenText, latencyMs: response.latencyMs },
  })

  const snapshot = await fetchAiReceptionistWorkspaceSnapshot(admin, {
    organizationId: input.organizationId,
    voiceCallId: input.voiceCallId,
    currentIntent: intent,
  })

  return { ...snapshot, spokenText: response.spokenText }
}

export async function operatorTakeoverAiReceptionist(
  admin: SupabaseClient,
  input: {
    organizationId: string
    voiceCallId: string
    operatorUserId: string
  },
): Promise<VoiceAiReceptionistWorkspaceSnapshot> {
  const session = await getActiveReceptionistSessionForCall(admin, input.organizationId, input.voiceCallId)
  if (!session) {
    return fetchAiReceptionistWorkspaceSnapshot(admin, {
      organizationId: input.organizationId,
      voiceCallId: input.voiceCallId,
    })
  }

  const handoff = buildReceptionistHandoffDraft({
    session,
    callerIntent: null,
    recentTranscript: [],
  })

  await appendReceptionistEvent(admin, {
    organizationId: input.organizationId,
    sessionId: session.id,
    voiceCallId: input.voiceCallId,
    eventType: "operator_takeover",
    evidenceText: `Operator ${input.operatorUserId} took over AI receptionist.`,
    providerSource: session.aiProvider,
    payload: { operatorUserId: input.operatorUserId },
    idempotencyKey: `takeover:${session.id}:${input.operatorUserId}`,
  })

  await appendReceptionistEvent(admin, {
    organizationId: input.organizationId,
    sessionId: session.id,
    voiceCallId: input.voiceCallId,
    eventType: "operator_joined",
    evidenceText: "Operator joined — AI yields control.",
    providerSource: session.aiProvider,
  })

  await updateReceptionistSession(admin, {
    organizationId: input.organizationId,
    sessionId: session.id,
    patch: {
      receptionistStatus: "operator_joined",
      currentConversationPhase: "completed",
      activeOperatorId: input.operatorUserId,
      handoffSummaryDraft: handoff.summary,
      endedAt: new Date().toISOString(),
    },
  })

  const recoveryHook = buildMissedCallRecoveryHook({
    voiceCallId: input.voiceCallId,
    callerNumber: String(session.metadata.callerNumber ?? ""),
    handoff,
  })

  await appendReceptionistEvent(admin, {
    organizationId: input.organizationId,
    sessionId: session.id,
    voiceCallId: input.voiceCallId,
    eventType: "missed_call_recovery_prepared",
    evidenceText: "Missed-call recovery hook prepared — no autonomous outbound.",
    providerSource: session.aiProvider,
    payload: recoveryHook,
  })

  return fetchAiReceptionistWorkspaceSnapshot(admin, {
    organizationId: input.organizationId,
    voiceCallId: input.voiceCallId,
  })
}
