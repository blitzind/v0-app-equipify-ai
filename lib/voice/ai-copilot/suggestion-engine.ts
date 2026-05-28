/** AI copilot suggestion engine — Phase 3A. */

import type { UnifiedOperatorAssistSnapshot } from "@/lib/growth/operator-assist/types"
import type { VoiceCallTranscriptSnapshot } from "@/lib/voice/media-streaming/types"
import type { VoiceRevenueIntelligenceWorkspaceSnapshot } from "@/lib/voice/revenue-intelligence/types"
import type { VoiceRetentionIntelligenceWorkspaceSnapshot } from "@/lib/voice/retention-intelligence/types"
import { dedupeCopilotDrafts, isDuplicateCopilotSuggestion } from "@/lib/voice/ai-copilot/deduplication"
import { filterGuardedCopilotDrafts } from "@/lib/voice/ai-copilot/guardrails"
import {
  generateCopilotSuggestionsWithTimeout,
  resolveVoiceAiCopilotProvider,
} from "@/lib/voice/ai-copilot/provider-registry"
import type { VoiceAiCopilotSourceEvent } from "@/lib/voice/ai-copilot/provider-types"
import type {
  VoiceAiCopilotGenerationDraft,
  VoiceAiCopilotProviderId,
  VoiceAiCopilotSuggestionPublicView,
} from "@/lib/voice/ai-copilot/types"
import {
  VOICE_AI_COPILOT_MAX_SOURCE_EVENTS,
  VOICE_AI_COPILOT_MAX_SUGGESTIONS_PER_CALL,
  VOICE_AI_COPILOT_TRANSCRIPT_WINDOW_SEGMENTS,
} from "@/lib/voice/ai-copilot/types"

export type CopilotGenerationInput = {
  organizationId: string
  voiceCallId: string
  callState: string
  contactLabel?: string | null
  operatorAssist: UnifiedOperatorAssistSnapshot | null
  retentionIntelligence: VoiceRetentionIntelligenceWorkspaceSnapshot | null
  revenueIntelligence: VoiceRevenueIntelligenceWorkspaceSnapshot | null
  liveTranscript: VoiceCallTranscriptSnapshot | null
  relationshipSummary?: string | null
  existingSuggestions: VoiceAiCopilotSuggestionPublicView[]
}

function mapAssistEvents(operatorAssist: UnifiedOperatorAssistSnapshot | null): VoiceAiCopilotSourceEvent[] {
  if (!operatorAssist) return []
  const feed = [...operatorAssist.topPriority, ...operatorAssist.additional].slice(0, VOICE_AI_COPILOT_MAX_SOURCE_EVENTS)
  return feed.map((event) => ({
    id: event.id,
    source: event.source,
    category: event.category,
    title: event.title,
    evidenceText: event.evidenceText,
    recommendation: event.recommendation,
  }))
}

function mapRetentionSignals(retention: VoiceRetentionIntelligenceWorkspaceSnapshot | null): VoiceAiCopilotSourceEvent[] {
  if (!retention) return []
  const events: VoiceAiCopilotSourceEvent[] = []
  for (const risk of retention.topRisks.slice(0, 3)) {
    events.push({
      id: risk.id,
      source: "retention_intelligence",
      category: "risk",
      title: risk.title,
      evidenceText: risk.evidenceText,
    })
  }
  for (const signal of retention.topExpansionSignals.slice(0, 2)) {
    events.push({
      id: signal.id,
      source: "retention_intelligence",
      category: "expansion",
      title: signal.title,
      evidenceText: signal.evidenceText,
    })
  }
  return events.slice(0, VOICE_AI_COPILOT_MAX_SOURCE_EVENTS)
}

function mapRevenueSignals(revenue: VoiceRevenueIntelligenceWorkspaceSnapshot | null): VoiceAiCopilotSourceEvent[] {
  if (!revenue) return []
  const events: VoiceAiCopilotSourceEvent[] = []
  for (const risk of revenue.topRisks.slice(0, 2)) {
    events.push({
      id: risk.id,
      source: "revenue_intelligence",
      category: "risk",
      title: risk.title,
      evidenceText: risk.evidenceText,
    })
  }
  for (const signal of revenue.topBuyingSignals.slice(0, 2)) {
    events.push({
      id: signal.id,
      source: "revenue_intelligence",
      category: "buying_signal",
      title: signal.title,
      evidenceText: signal.evidenceText,
    })
  }
  return events.slice(0, VOICE_AI_COPILOT_MAX_SOURCE_EVENTS)
}

function collectKnownEvidence(input: CopilotGenerationInput): string[] {
  const evidence: string[] = []
  for (const event of mapAssistEvents(input.operatorAssist)) evidence.push(event.evidenceText)
  for (const event of mapRetentionSignals(input.retentionIntelligence)) evidence.push(event.evidenceText)
  for (const event of mapRevenueSignals(input.revenueIntelligence)) evidence.push(event.evidenceText)
  for (const segment of input.liveTranscript?.segments.slice(-VOICE_AI_COPILOT_TRANSCRIPT_WINDOW_SEGMENTS) ?? []) {
    evidence.push(segment.transcriptText)
  }
  evidence.push("Operator-controlled live call — passive AI copilot mode.")
  return evidence.filter(Boolean)
}

export async function generateCopilotSuggestionDrafts(
  input: CopilotGenerationInput,
): Promise<{ provider: VoiceAiCopilotProviderId; drafts: VoiceAiCopilotGenerationDraft[] }> {
  const operatorAssistEvents = mapAssistEvents(input.operatorAssist)
  const retentionSignals = mapRetentionSignals(input.retentionIntelligence)
  const revenueSignals = mapRevenueSignals(input.revenueIntelligence)

  if (input.operatorAssist?.nextBestAction.primary) {
    const nba = input.operatorAssist.nextBestAction.primary
    operatorAssistEvents.unshift({
      id: `nba:${nba.dedupeKey}`,
      source: "operator_assist_nba",
      category: "guidance",
      title: nba.title,
      evidenceText: nba.evidenceText,
      recommendation: nba.prompt,
    })
  }

  const transcriptWindow =
    input.liveTranscript?.segments.slice(-VOICE_AI_COPILOT_TRANSCRIPT_WINDOW_SEGMENTS).map((segment) => ({
      id: segment.id,
      sequenceNumber: segment.sequenceNumber,
      speakerType: segment.speakerType,
      text: segment.transcriptText,
    })) ?? []

  const provider = resolveVoiceAiCopilotProvider()
  const result = await generateCopilotSuggestionsWithTimeout(provider, {
    organizationId: input.organizationId,
    voiceCallId: input.voiceCallId,
    callState: input.callState,
    operatorAssistEvents: operatorAssistEvents.slice(0, VOICE_AI_COPILOT_MAX_SOURCE_EVENTS),
    retentionSignals,
    revenueSignals,
    transcriptWindow,
    relationshipSummary: input.relationshipSummary ?? null,
    contactLabel: input.contactLabel ?? null,
  })

  const knownEvidence = collectKnownEvidence(input)
  const guarded = filterGuardedCopilotDrafts(result.drafts, knownEvidence)
  const deduped = dedupeCopilotDrafts(guarded)
    .filter((draft) => !isDuplicateCopilotSuggestion(input.existingSuggestions, draft))
    .sort((a, b) => b.priority - a.priority)
    .slice(0, Math.max(0, VOICE_AI_COPILOT_MAX_SUGGESTIONS_PER_CALL - input.existingSuggestions.filter((s) => s.status === "active").length))

  return { provider: result.provider, drafts: deduped }
}
