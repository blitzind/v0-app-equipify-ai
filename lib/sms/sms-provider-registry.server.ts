import "server-only"

import type { SmsOutboundProvider, SmsSendRequest, SmsSendResult } from "@/lib/sms/sms-provider-types.server"

/** Safe default: never performs network I/O. */
export const noopSmsProvider: SmsOutboundProvider = {
  id: "noop",
  async send(_req: SmsSendRequest): Promise<SmsSendResult> {
    return { ok: true, provider: "noop", externalId: null }
  },
}

/** Twilio adapter placeholder — wire Account SID / auth + Messages API in a later phase. */
export const twilioSmsProviderPlaceholder: SmsOutboundProvider = {
  id: "twilio",
  async send(_req: SmsSendRequest): Promise<SmsSendResult> {
    return { ok: false, provider: "twilio", code: "not_configured" }
  },
}

/** Telnyx adapter placeholder. */
export const telnyxSmsProviderPlaceholder: SmsOutboundProvider = {
  id: "telnyx",
  async send(_req: SmsSendRequest): Promise<SmsSendResult> {
    return { ok: false, provider: "telnyx", code: "not_configured" }
  },
}

export function resolveSmsOutboundProvider(kind: "none" | "twilio" | "telnyx"): SmsOutboundProvider {
  if (kind === "twilio") return twilioSmsProviderPlaceholder
  if (kind === "telnyx") return telnyxSmsProviderPlaceholder
  return noopSmsProvider
}
