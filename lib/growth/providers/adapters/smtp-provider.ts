import "server-only"

import { hasCredential } from "@/lib/growth/providers/adapters/adapter-utils"
import type {
  GrowthProviderAdapter,
  ProviderAdapterCredentials,
  ProviderSendMessage,
  ProviderSendResult,
} from "@/lib/growth/providers/adapters/provider-adapter-types"

const SMTP_NOT_CONFIGURED_MESSAGE =
  "SMTP transport requires server runtime adapter wiring before live sends."

export async function sendViaSmtpNative(
  _credentials: ProviderAdapterCredentials,
  _message: ProviderSendMessage,
): Promise<ProviderSendResult> {
  if (process.env.GROWTH_TRANSPORT_SIMULATE === "true") {
    return { ok: true, provider_message_id: `sim-smtp-${Date.now()}`, simulated: true }
  }

  return {
    ok: false,
    error: SMTP_NOT_CONFIGURED_MESSAGE,
  }
}

export const smtpProviderAdapter: GrowthProviderAdapter = {
  family: "smtp",

  capabilities() {
    return { oauthMailbox: false, smtp: true, apiKey: false, webhooks: false, tracking: false }
  },

  validate(credentials) {
    if (!hasCredential(credentials.smtp_host)) {
      return { ok: false, status: "invalid", summary: "SMTP host is required." }
    }
    if (!hasCredential(credentials.smtp_user) || !hasCredential(credentials.smtp_password)) {
      return { ok: false, status: "invalid", summary: "SMTP username and password are required." }
    }
    return { ok: true, status: "valid", summary: "SMTP credentials present." }
  },

  health(credentials) {
    const validation = this.validate(credentials)
    if (!validation.ok) return { ok: false, tier: "degraded", summary: validation.summary }
    if (process.env.GROWTH_TRANSPORT_SIMULATE === "true") {
      return { ok: true, tier: "healthy", summary: "SMTP transport adapter ready (simulation mode)." }
    }
    return {
      ok: false,
      tier: "degraded",
      summary: "SMTP live send not configured — simulation or server runtime wiring required.",
    }
  },

  async send(credentials, message) {
    return sendViaSmtpNative(credentials, message)
  },
}
