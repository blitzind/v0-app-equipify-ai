import "server-only"

import { createHmac, timingSafeEqual } from "node:crypto"
import type {
  GrowthSmsProviderAdapter,
  GrowthSmsProviderSendMessage,
  GrowthSmsProviderSendResult,
  GrowthSmsWebhookValidationInput,
  GrowthSmsWebhookValidationResult,
} from "@/lib/growth/sms/providers/sms-provider-types"

function readTwilioAccountSid(): string | null {
  return process.env.TWILIO_ACCOUNT_SID?.trim() || null
}

function readTwilioAuthToken(): string | null {
  return process.env.TWILIO_AUTH_TOKEN?.trim() || null
}

function validateTwilioSignature(
  authToken: string,
  signatureHeader: string,
  url: string,
  params: Record<string, string>,
): boolean {
  const sortedKeys = Object.keys(params).sort()
  let payload = url
  for (const key of sortedKeys) {
    payload += key + params[key]
  }
  const expected = createHmac("sha1", authToken).update(payload, "utf8").digest("base64")
  try {
    const a = Buffer.from(signatureHeader)
    const b = Buffer.from(expected)
    return a.length === b.length && timingSafeEqual(a, b)
  } catch {
    return false
  }
}

async function twilioMessagesApiSend(input: {
  accountSid: string
  authToken: string
  message: GrowthSmsProviderSendMessage
}): Promise<GrowthSmsProviderSendResult> {
  const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${input.accountSid}/Messages.json`
  const form = new URLSearchParams()
  form.set("To", input.message.toE164)
  form.set("Body", input.message.body)

  if (input.message.messagingServiceSid) {
    form.set("MessagingServiceSid", input.message.messagingServiceSid)
  } else {
    form.set("From", input.message.fromE164)
  }

  if (input.message.statusCallbackUrl) {
    form.set("StatusCallback", input.message.statusCallbackUrl)
  }

  const auth = Buffer.from(`${input.accountSid}:${input.authToken}`).toString("base64")
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form.toString(),
  })

  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>
  if (!response.ok) {
    const message =
      typeof payload.message === "string"
        ? payload.message
        : typeof payload.error_message === "string"
          ? payload.error_message
          : `Twilio API error (${response.status})`
    return { ok: false, code: "provider_send_failed", message }
  }

  const sid = typeof payload.sid === "string" ? payload.sid : null
  if (!sid) {
    return { ok: false, code: "provider_missing_message_id", message: "Twilio response missing MessageSid." }
  }

  const statusRaw = typeof payload.status === "string" ? payload.status : "queued"
  const status = statusRaw === "sent" || statusRaw === "queued" ? statusRaw : "queued"
  return { ok: true, providerMessageId: sid, status }
}

export function createTwilioGrowthSmsProvider(): GrowthSmsProviderAdapter {
  return {
    kind: "twilio",
    capabilities() {
      return {
        supportsStatusCallbacks: true,
        supportsMessagingServiceSid: true,
        supportsInboundWebhooks: true,
      }
    },
    async health() {
      const accountSid = readTwilioAccountSid()
      const authToken = readTwilioAuthToken()
      if (!accountSid || !authToken) {
        return { ok: false, message: "TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN are required." }
      }
      return { ok: true, message: "Twilio credentials configured." }
    },
    async send(message: GrowthSmsProviderSendMessage): Promise<GrowthSmsProviderSendResult> {
      const accountSid = readTwilioAccountSid()
      const authToken = readTwilioAuthToken()
      if (!accountSid || !authToken) {
        return { ok: false, code: "provider_not_configured", message: "Twilio is not configured." }
      }
      return twilioMessagesApiSend({ accountSid, authToken, message })
    },
    validateWebhook(input: GrowthSmsWebhookValidationInput): GrowthSmsWebhookValidationResult {
      const authToken = readTwilioAuthToken()
      if (!authToken) {
        return { ok: false, message: "TWILIO_AUTH_TOKEN is not configured for webhook validation." }
      }
      if (!input.signatureHeader) {
        return { ok: false, message: "Missing X-Twilio-Signature header." }
      }
      const valid = validateTwilioSignature(authToken, input.signatureHeader, input.url, input.params)
      return valid ? { ok: true } : { ok: false, message: "Twilio webhook signature verification failed." }
    },
  }
}
