import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { resolveConfiguredIntelligenceAnalysisProvider } from "@/lib/voice/intelligence/registry"
import {
  VOICE_INTELLIGENCE_AUTONOMOUS_ACTIONS_DISABLED,
  VOICE_INTELLIGENCE_PASSIVE_MODE_ENABLED,
} from "@/lib/voice/intelligence/passive-mode-guard"
import type { VoiceConversationIntelligenceReadinessSnapshot } from "@/lib/voice/intelligence/types"
import { VOICE_CONVERSATION_INTELLIGENCE_QA_MARKER } from "@/lib/voice/intelligence/types"
import { resolveConfiguredTranscriptProviderKind } from "@/lib/voice/transcripts/providers/types"
import { isOpenAiIntelligenceConfigured } from "@/lib/voice/intelligence/openai-provider"

export async function fetchVoiceConversationIntelligenceReadiness(
  admin: SupabaseClient,
): Promise<VoiceConversationIntelligenceReadinessSnapshot> {
  const warnings: string[] = []
  let schemaReady = true

  for (const table of [
    "voice_conversation_intelligence_events",
    "voice_objection_events",
    "voice_buying_signal_events",
    "voice_risk_events",
    "voice_operator_guidance_events",
    "voice_conversation_memory_drafts",
  ]) {
    const { error } = await admin.schema("voice").from(table).select("id").limit(0)
    if (error) {
      schemaReady = false
      warnings.push(`Missing or inaccessible table voice.${table}. Apply migration 20270607120000.`)
      break
    }
  }

  const analysisProviderStatus = resolveConfiguredIntelligenceAnalysisProvider()
  if (analysisProviderStatus === "openai" && !isOpenAiIntelligenceConfigured()) {
    warnings.push("OpenAI intelligence selected but VOICE_INTELLIGENCE_OPENAI_ENABLED=true and OPENAI_API_KEY are required.")
  }

  const transcriptProviderStatus = resolveConfiguredTranscriptProviderKind()
  const intelligenceReady = schemaReady && analysisProviderStatus !== "stub"

  return {
    qaMarker: VOICE_CONVERSATION_INTELLIGENCE_QA_MARKER,
    schemaReady,
    transcriptProviderStatus,
    analysisProviderStatus,
    passiveModeEnabled: VOICE_INTELLIGENCE_PASSIVE_MODE_ENABLED,
    autonomousActionsDisabled: VOICE_INTELLIGENCE_AUTONOMOUS_ACTIONS_DISABLED,
    evidenceRequirementEnabled: true,
    intelligenceReady,
    message: intelligenceReady
      ? "Passive conversation intelligence is ready. AI remains operator-assist only."
      : "Apply voice conversation intelligence migration 20270607120000 before enabling live analysis.",
    warnings,
  }
}
