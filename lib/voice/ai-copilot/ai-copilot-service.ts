import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { UnifiedOperatorAssistSnapshot } from "@/lib/growth/operator-assist/types"
import type { VoiceCallTranscriptSnapshot } from "@/lib/voice/media-streaming/types"
import type { VoiceRevenueIntelligenceWorkspaceSnapshot } from "@/lib/voice/revenue-intelligence/types"
import type { VoiceRetentionIntelligenceWorkspaceSnapshot } from "@/lib/voice/retention-intelligence/types"
import { buildAiCopilotWorkspaceSnapshot } from "@/lib/voice/ai-copilot/snapshot-builder"
import {
  buildStrategySnapshotForCall,
  generateCopilotSuggestionDrafts,
} from "@/lib/voice/ai-copilot/suggestion-engine"
import type {
  VoiceAiCopilotLifecycleAction,
  VoiceAiCopilotReadinessSnapshot,
  VoiceAiCopilotWorkspaceSnapshot,
} from "@/lib/voice/ai-copilot/types"
import {
  VOICE_AI_COPILOT_AUTONOMOUS_ACTIONS_DISABLED,
  VOICE_AI_COPILOT_EVIDENCE_REQUIRED,
  VOICE_AI_COPILOT_GENERATION_COOLDOWN_MS,
  VOICE_AI_COPILOT_GUARDRAILS_ENABLED,
  VOICE_AI_COPILOT_MAX_SUGGESTIONS_PER_CALL,
  VOICE_AI_COPILOT_QA_MARKER,
  VOICE_AI_COPILOT_STALE_MINUTES,
} from "@/lib/voice/ai-copilot/types"
import {
  countActiveAiCopilotSuggestions,
  countAiCopilotSuggestionsByStatus,
  expireStaleAiCopilotSuggestions,
  getLatestAiCopilotGenerationAt,
  insertAiCopilotSuggestion,
  listAiCopilotSuggestions,
  updateAiCopilotSuggestionStatus,
} from "@/lib/voice/repository/voice-ai-copilot-repository"
import {
  listOperatorPerformanceInsights,
  syncOperatorPerformanceInsightsFromStrategy,
} from "@/lib/voice/repository/voice-operator-performance-repository"
import { resolveVoiceAiCopilotProviderMode } from "@/lib/voice/ai-copilot/provider-registry"
import { isOpenAiCopilotConfigured } from "@/lib/voice/ai-copilot/openai-provider"
import { probeVoiceSchemaHealth } from "@/lib/voice/schema-health"
import {
  VOICE_DEEP_COPILOT_MAX_ACTIVE_SUGGESTIONS,
} from "@/lib/voice/copilot-strategy/types"

const LIFECYCLE_STATUS_MAP: Record<
  VoiceAiCopilotLifecycleAction,
  { status: "acknowledged" | "dismissed" | "copied" | "expired"; timestampField?: "acknowledged_at" | "dismissed_at" | "copied_at" }
> = {
  acknowledge: { status: "acknowledged", timestampField: "acknowledged_at" },
  dismiss: { status: "dismissed", timestampField: "dismissed_at" },
  copied: { status: "copied", timestampField: "copied_at" },
  expire: { status: "expired" },
}

function resolveCooldownRemainingMs(latestGenerationAt: string | null): number {
  if (!latestGenerationAt) return 0
  const elapsed = Date.now() - new Date(latestGenerationAt).getTime()
  return Math.max(0, VOICE_AI_COPILOT_GENERATION_COOLDOWN_MS - elapsed)
}

async function syncStaleCopilotSuggestions(
  admin: SupabaseClient,
  organizationId: string,
  voiceCallId: string,
): Promise<void> {
  const staleBefore = new Date(Date.now() - VOICE_AI_COPILOT_STALE_MINUTES * 60 * 1000).toISOString()
  await expireStaleAiCopilotSuggestions(admin, organizationId, voiceCallId, staleBefore)
}

type CopilotContextInput = {
  operatorAssist: UnifiedOperatorAssistSnapshot | null
  liveTranscript: VoiceCallTranscriptSnapshot | null
  retentionIntelligence: VoiceRetentionIntelligenceWorkspaceSnapshot | null
  operatorUserId?: string | null
}

async function buildSnapshotWithContext(
  admin: SupabaseClient,
  input: {
    organizationId: string
    voiceCallId: string
    providerMode: ReturnType<typeof resolveVoiceAiCopilotProviderMode>
    suggestions: Awaited<ReturnType<typeof listAiCopilotSuggestions>>
    context: CopilotContextInput
    generationCooldownRemainingMs: number
    canGenerate: boolean
    syncPerformance?: boolean
  },
): Promise<VoiceAiCopilotWorkspaceSnapshot> {
  const strategy = buildStrategySnapshotForCall({
    operatorAssist: input.context.operatorAssist,
    liveTranscript: input.context.liveTranscript,
    retentionIntelligence: input.context.retentionIntelligence,
  })

  let performanceInsights = await listOperatorPerformanceInsights(
    admin,
    input.organizationId,
    input.voiceCallId,
  )

  if (input.syncPerformance && performanceInsights.length === 0) {
    performanceInsights = await syncOperatorPerformanceInsightsFromStrategy(admin, {
      organizationId: input.organizationId,
      voiceCallId: input.voiceCallId,
      operatorUserId: input.context.operatorUserId,
      strategy,
    })
  }

  return buildAiCopilotWorkspaceSnapshot({
    voiceCallId: input.voiceCallId,
    providerMode: input.providerMode,
    suggestions: input.suggestions,
    strategy,
    performanceInsights,
    generationCooldownRemainingMs: input.generationCooldownRemainingMs,
    canGenerate: input.canGenerate,
  })
}

export async function fetchAiCopilotWorkspaceSnapshot(
  admin: SupabaseClient,
  input: {
    organizationId: string
    voiceCallId: string
    operatorAssist?: UnifiedOperatorAssistSnapshot | null
    liveTranscript?: VoiceCallTranscriptSnapshot | null
    retentionIntelligence?: VoiceRetentionIntelligenceWorkspaceSnapshot | null
  },
): Promise<VoiceAiCopilotWorkspaceSnapshot> {
  await syncStaleCopilotSuggestions(admin, input.organizationId, input.voiceCallId)
  const suggestions = await listAiCopilotSuggestions(admin, input.organizationId, input.voiceCallId, { limit: 30 })
  const latestGenerationAt = await getLatestAiCopilotGenerationAt(admin, input.organizationId, input.voiceCallId)
  const cooldownRemainingMs = resolveCooldownRemainingMs(latestGenerationAt)
  const activeCount = suggestions.filter((item) => item.status === "active").length
  const canGenerate = cooldownRemainingMs === 0 && activeCount < VOICE_AI_COPILOT_MAX_SUGGESTIONS_PER_CALL

  return buildSnapshotWithContext(admin, {
    organizationId: input.organizationId,
    voiceCallId: input.voiceCallId,
    providerMode: resolveVoiceAiCopilotProviderMode(),
    suggestions,
    context: {
      operatorAssist: input.operatorAssist ?? null,
      liveTranscript: input.liveTranscript ?? null,
      retentionIntelligence: input.retentionIntelligence ?? null,
    },
    generationCooldownRemainingMs: cooldownRemainingMs,
    canGenerate,
  })
}

export async function generateAiCopilotSuggestionsForCall(
  admin: SupabaseClient,
  input: {
    organizationId: string
    voiceCallId: string
    callState: string
    contactLabel?: string | null
    operatorAssist: UnifiedOperatorAssistSnapshot | null
    retentionIntelligence: VoiceRetentionIntelligenceWorkspaceSnapshot | null
    revenueIntelligence: VoiceRevenueIntelligenceWorkspaceSnapshot | null
    liveTranscript: VoiceCallTranscriptSnapshot | null
    relationshipMemoryProfileId?: string | null
    relatedCustomerId?: string | null
    relatedProspectId?: string | null
    relatedOpportunityId?: string | null
    relationshipSummary?: string | null
    operatorUserId?: string | null
  },
): Promise<VoiceAiCopilotWorkspaceSnapshot> {
  await syncStaleCopilotSuggestions(admin, input.organizationId, input.voiceCallId)

  const existingSuggestions = await listAiCopilotSuggestions(admin, input.organizationId, input.voiceCallId, { limit: 30 })
  const latestGenerationAt = await getLatestAiCopilotGenerationAt(admin, input.organizationId, input.voiceCallId)
  const cooldownRemainingMs = resolveCooldownRemainingMs(latestGenerationAt)
  const activeCount = existingSuggestions.filter((item) => item.status === "active").length

  if (cooldownRemainingMs > 0 || activeCount >= VOICE_AI_COPILOT_MAX_SUGGESTIONS_PER_CALL) {
    return buildSnapshotWithContext(admin, {
      organizationId: input.organizationId,
      voiceCallId: input.voiceCallId,
      providerMode: resolveVoiceAiCopilotProviderMode(),
      suggestions: existingSuggestions,
      context: {
        operatorAssist: input.operatorAssist,
        liveTranscript: input.liveTranscript,
        retentionIntelligence: input.retentionIntelligence,
        operatorUserId: input.operatorUserId,
      },
      generationCooldownRemainingMs: cooldownRemainingMs,
      canGenerate: false,
    })
  }

  const { provider, drafts } = await generateCopilotSuggestionDrafts({
    organizationId: input.organizationId,
    voiceCallId: input.voiceCallId,
    callState: input.callState,
    contactLabel: input.contactLabel,
    operatorAssist: input.operatorAssist,
    retentionIntelligence: input.retentionIntelligence,
    revenueIntelligence: input.revenueIntelligence,
    liveTranscript: input.liveTranscript,
    relationshipSummary: input.relationshipSummary,
    existingSuggestions,
  })

  for (const draft of drafts) {
    await insertAiCopilotSuggestion(admin, {
      organizationId: input.organizationId,
      voiceCallId: input.voiceCallId,
      relationshipMemoryProfileId: input.relationshipMemoryProfileId,
      relatedCustomerId: input.relatedCustomerId,
      relatedProspectId: input.relatedProspectId,
      relatedOpportunityId: input.relatedOpportunityId,
      suggestionType: draft.suggestionType,
      priority: draft.priority,
      title: draft.title,
      body: draft.body,
      evidenceText: draft.evidenceText,
      sourceEventIds: draft.sourceEventIds,
      generatedByProvider: provider,
    })
  }

  const suggestions = await listAiCopilotSuggestions(admin, input.organizationId, input.voiceCallId, { limit: 30 })
  const refreshedLatest = await getLatestAiCopilotGenerationAt(admin, input.organizationId, input.voiceCallId)

  return buildSnapshotWithContext(admin, {
    organizationId: input.organizationId,
    voiceCallId: input.voiceCallId,
    providerMode: provider,
    suggestions,
    context: {
      operatorAssist: input.operatorAssist,
      liveTranscript: input.liveTranscript,
      retentionIntelligence: input.retentionIntelligence,
      operatorUserId: input.operatorUserId,
    },
    generationCooldownRemainingMs: resolveCooldownRemainingMs(refreshedLatest),
    canGenerate: suggestions.filter((item) => item.status === "active").length < VOICE_AI_COPILOT_MAX_SUGGESTIONS_PER_CALL,
    syncPerformance: true,
  })
}

export async function updateAiCopilotSuggestionLifecycle(
  admin: SupabaseClient,
  input: {
    organizationId: string
    voiceCallId: string
    suggestionId: string
    action: VoiceAiCopilotLifecycleAction
  },
): Promise<{ suggestionId: string; status: string } | null> {
  const mapped = LIFECYCLE_STATUS_MAP[input.action]
  const updated = await updateAiCopilotSuggestionStatus(admin, {
    organizationId: input.organizationId,
    voiceCallId: input.voiceCallId,
    suggestionId: input.suggestionId,
    status: mapped.status,
    timestampField: mapped.timestampField,
  })
  if (!updated) return null
  return { suggestionId: updated.id, status: updated.status }
}

export async function fetchAiCopilotReadiness(
  admin: SupabaseClient,
  organizationId: string,
): Promise<VoiceAiCopilotReadinessSnapshot> {
  const schema = await probeVoiceSchemaHealth(admin)
  const schemaReady =
    schema.ready &&
    !schema.missingTables.includes("voice_ai_copilot_suggestions") &&
    !schema.missingTables.includes("voice_operator_performance_insights")
  const providerMode = resolveVoiceAiCopilotProviderMode()
  const activeSuggestionCount = schemaReady
    ? await countAiCopilotSuggestionsByStatus(admin, organizationId, "active")
    : 0

  return {
    qaMarker: VOICE_AI_COPILOT_QA_MARKER,
    schemaReady,
    deterministicModeActive: providerMode === "deterministic_template" || !isOpenAiCopilotConfigured(),
    openAiAugmentationEnabled: isOpenAiCopilotConfigured(),
    structuredOutputEnforced: true,
    evidenceValidationEnabled: true,
    overloadPreventionEnabled: true,
    autonomousActionsDisabled: VOICE_AI_COPILOT_AUTONOMOUS_ACTIONS_DISABLED,
    maxActiveSuggestions: VOICE_DEEP_COPILOT_MAX_ACTIVE_SUGGESTIONS,
    escalationSafeModeEnabled: true,
    performanceInsightsReady: schemaReady && !schema.missingTables.includes("voice_operator_performance_insights"),
    providerMode,
    openAiEnabled: isOpenAiCopilotConfigured(),
    deterministicFallbackReady: true,
    evidenceRequirementEnabled: VOICE_AI_COPILOT_EVIDENCE_REQUIRED,
    guardrailsEnabled: VOICE_AI_COPILOT_GUARDRAILS_ENABLED,
    maxSuggestionsPerCall: VOICE_AI_COPILOT_MAX_SUGGESTIONS_PER_CALL,
    activeSuggestionCount,
    message: schemaReady
      ? providerMode === "openai"
        ? "Deep copilot active with structured-output enforcement and deterministic fallback."
        : "Deep copilot deterministic mode active. Evidence-backed, operator-controlled suggestions only."
      : `Apply migration for voice deep copilot — ${schema.message}`,
  }
}

export async function countActiveCopilotSuggestionsForCall(
  admin: SupabaseClient,
  organizationId: string,
  voiceCallId: string,
): Promise<number> {
  return countActiveAiCopilotSuggestions(admin, organizationId, voiceCallId)
}
