/** Stub voice drop provider — Phase 4B default. */

import { renderPersonalizedMessage } from "@/lib/voice/voice-drops/personalization"
import type {
  VoiceDropDeliveryResult,
  VoiceDropProvider,
  VoiceDropProviderContext,
} from "@/lib/voice/voice-drops/provider-types"
import { normalizePhoneNumber } from "@/lib/voice/phone-normalization"

export const stubVoiceDropProvider: VoiceDropProvider = {
  id: "stub",
  isConfigured() {
    return true
  },
  validateRecipient(phoneNumber: string) {
    const normalized = normalizePhoneNumber(phoneNumber)
    if (!normalized || normalized.length < 10) {
      return { valid: false, reason: "invalid_phone_number" }
    }
    return { valid: true, reason: null }
  },
  renderMessage(template: string, context: Record<string, string | null>) {
    return renderPersonalizedMessage(template, context).rendered
  },
  async queueDelivery(context: VoiceDropProviderContext): Promise<VoiceDropDeliveryResult> {
    return {
      providerDeliveryId: `stub_${context.recipientId}_${Date.now()}`,
      status: "queued",
      failureReason: null,
      evidenceText: "Stub provider queued delivery — no actual outbound call placed.",
    }
  },
  async fetchDeliveryStatus(providerDeliveryId: string): Promise<VoiceDropDeliveryResult> {
    return {
      providerDeliveryId,
      status: "delivered",
      failureReason: null,
      evidenceText: "Stub provider simulated delivery success.",
    }
  },
  async cancelDelivery(providerDeliveryId: string) {
    return { canceled: true, reason: `Canceled stub delivery ${providerDeliveryId}.` }
  },
}
