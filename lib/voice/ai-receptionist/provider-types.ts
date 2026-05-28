/** AI receptionist provider abstraction — Phase 4A. */

import type { VoiceAiReceptionistProviderId } from "@/lib/voice/ai-receptionist/types"

export type ReceptionistProviderContext = {
  organizationId: string
  voiceCallId: string
  callerText: string
  phase: string
  intent: string | null
  relationshipSummary: string | null
  faqAnswer: string | null
  qualificationPrompt: string | null
  afterHours: boolean
}

export type ReceptionistProviderResponse = {
  spokenText: string
  evidenceText: string
  latencyMs: number
  providerId: VoiceAiReceptionistProviderId
  cancelled?: boolean
}

export interface VoiceAiReceptionistProvider {
  id: VoiceAiReceptionistProviderId
  isConfigured(): boolean
  generateResponse(context: ReceptionistProviderContext): Promise<ReceptionistProviderResponse>
  cancelPending?(): void
}

export function isVoiceAiReceptionistEnabled(): boolean {
  return process.env.VOICE_AI_RECEPTIONIST_ENABLED === "true"
}

export function resolveVoiceAiReceptionistProviderMode(): VoiceAiReceptionistProviderId {
  const raw = (process.env.VOICE_AI_RECEPTIONIST_PROVIDER ?? "deterministic").trim().toLowerCase()
  if (raw === "deepgram") return "deepgram"
  if (raw === "openai_realtime" || raw === "openai") return "openai_realtime"
  if (raw === "elevenlabs") return "elevenlabs"
  if (raw === "stub") return "stub"
  return "deterministic"
}
