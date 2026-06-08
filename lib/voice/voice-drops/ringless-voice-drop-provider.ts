/** Ringless voice drop scaffold — Phase 4B. Not configured. */

import { stubVoiceDropProvider } from "@/lib/voice/voice-drops/stub-provider"
import type {
  VoiceDropDeliveryResult,
  VoiceDropProvider,
  VoiceDropProviderContext,
} from "@/lib/voice/voice-drops/provider-types"
import { normalizePhoneNumber } from "@/lib/voice/phone-normalization"

export const ringlessVoiceDropProvider: VoiceDropProvider = {
  id: "ringless_future",
  isConfigured() {
    return false
  },
  validateRecipient(phoneNumber: string) {
    const normalized = normalizePhoneNumber(phoneNumber)
    if (!normalized || normalized.length < 10) {
      return { valid: false, reason: "invalid_phone_number" }
    }
    return { valid: true, reason: null }
  },
  renderMessage(template, context) {
    return stubVoiceDropProvider.renderMessage(template, context)
  },
  async queueDelivery(_context: VoiceDropProviderContext): Promise<VoiceDropDeliveryResult> {
    return {
      providerDeliveryId: null,
      status: "failed",
      failureReason: "ringless_provider_not_configured",
      evidenceText: "Ringless voicemail provider scaffold — not enabled.",
    }
  },
  async fetchDeliveryStatus(providerDeliveryId: string) {
    return {
      providerDeliveryId,
      status: "failed",
      failureReason: "ringless_provider_not_configured",
      evidenceText: "Ringless provider status unavailable.",
    }
  },
  async cancelDelivery() {
    return { canceled: false, reason: "Ringless provider not configured." }
  },
}
