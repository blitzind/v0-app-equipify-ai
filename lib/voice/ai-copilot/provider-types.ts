/** Voice AI Copilot provider types — Phase 3A. */

import type { VoiceAiCopilotGenerationDraft, VoiceAiCopilotProviderId } from "@/lib/voice/ai-copilot/types"

export type VoiceAiCopilotSourceEvent = {
  id: string
  source: string
  category: string
  title: string
  evidenceText: string
  recommendation?: string
}

export type VoiceAiCopilotTranscriptWindowSegment = {
  id: string
  sequenceNumber: number
  speakerType: string
  text: string
}

export type VoiceAiCopilotGenerationContext = {
  organizationId: string
  voiceCallId: string
  callState: string
  operatorAssistEvents: VoiceAiCopilotSourceEvent[]
  retentionSignals: VoiceAiCopilotSourceEvent[]
  revenueSignals: VoiceAiCopilotSourceEvent[]
  transcriptWindow: VoiceAiCopilotTranscriptWindowSegment[]
  relationshipSummary: string | null
  contactLabel: string | null
}

export type VoiceAiCopilotProviderResult = {
  provider: VoiceAiCopilotProviderId
  drafts: VoiceAiCopilotGenerationDraft[]
}

export type VoiceAiCopilotProvider = {
  id: VoiceAiCopilotProviderId
  generateSuggestions(context: VoiceAiCopilotGenerationContext): Promise<VoiceAiCopilotProviderResult>
}
