/** Outbound AI provider abstraction — Phase 5A. */

import type { VoiceAiOutboundProviderId, VoiceAiOutboundWorkflowType } from "@/lib/voice/ai-outbound/types"

export type OutboundProviderContext = {
  organizationId: string
  sessionId: string
  phoneNumber: string
  calleeText: string
  phase: string
  workflowType: VoiceAiOutboundWorkflowType
  organizationName: string | null
  messagePreview: string | null
  qualificationPrompt: string | null
  schedulingPrompt: string | null
  voicemailMode: boolean
}

export type OutboundProviderResponse = {
  spokenText: string
  evidenceText: string
  latencyMs: number
  providerId: VoiceAiOutboundProviderId
  cancelled?: boolean
}

export interface VoiceAiOutboundProvider {
  id: VoiceAiOutboundProviderId
  isConfigured(): boolean
  generateResponse(context: OutboundProviderContext): Promise<OutboundProviderResponse>
  cancelPending?(): void
}

export function isVoiceAiOutboundEnabled(): boolean {
  return process.env.VOICE_AI_OUTBOUND_ENABLED === "true"
}

export function resolveVoiceAiOutboundProviderMode(): VoiceAiOutboundProviderId {
  const raw = (process.env.VOICE_AI_OUTBOUND_PROVIDER ?? "deterministic").trim().toLowerCase()
  if (raw === "deepgram") return "deepgram"
  if (raw === "openai_realtime" || raw === "openai") return "openai_realtime"
  if (raw === "elevenlabs") return "elevenlabs"
  if (raw === "stub") return "stub"
  return "deterministic"
}
