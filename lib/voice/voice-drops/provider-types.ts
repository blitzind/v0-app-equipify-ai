/** Voice drop provider interface — Phase 4B. */

import type { VoiceDropProviderId } from "@/lib/voice/voice-drops/types"

export type VoiceDropProviderContext = {
  organizationId: string
  campaignId: string
  recipientId: string
  phoneNumber: string
  renderedMessage: string
  voiceId?: string | null
}

export type VoiceDropDeliveryResult = {
  providerDeliveryId: string | null
  status: "queued" | "in_progress" | "delivered" | "failed"
  failureReason: string | null
  evidenceText: string
}

export type VoiceDropProvider = {
  id: VoiceDropProviderId
  isConfigured(): boolean
  validateRecipient(phoneNumber: string): { valid: boolean; reason: string | null }
  renderMessage(template: string, context: Record<string, string | null>): string
  queueDelivery(context: VoiceDropProviderContext): Promise<VoiceDropDeliveryResult>
  fetchDeliveryStatus(providerDeliveryId: string): Promise<VoiceDropDeliveryResult>
  cancelDelivery(providerDeliveryId: string): Promise<{ canceled: boolean; reason: string | null }>
}

export function isVoiceDropEnabled(): boolean {
  return process.env.VOICE_DROP_ENABLED === "true"
}

export function resolveVoiceDropProviderMode(): VoiceDropProviderId {
  const raw = process.env.VOICE_DROP_PROVIDER?.trim().toLowerCase()
  if (raw === "twilio") return "twilio"
  if (raw === "ringless_future") return "ringless_future"
  return "stub"
}
