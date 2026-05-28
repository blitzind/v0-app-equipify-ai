import "server-only"

import { createHmac, timingSafeEqual } from "node:crypto"
import type { VoiceTelephonyProvider } from "@/lib/voice/providers/types"

function readTwilioAuthToken(): string | null {
  return process.env.TWILIO_AUTH_TOKEN?.trim() || null
}

function readTwilioAccountSid(): string | null {
  return process.env.TWILIO_ACCOUNT_SID?.trim() || null
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

export function createTwilioVoiceProvider(): VoiceTelephonyProvider {
  return {
    providerId: "twilio",
    async provisionNumber() {
      const accountSid = readTwilioAccountSid()
      if (!accountSid) {
        return { ok: false, message: "TWILIO_ACCOUNT_SID is not configured." }
      }
      return {
        ok: false,
        message: "Twilio number provisioning scaffold ready — configure credentials and enable in a later phase.",
      }
    },
    async releaseNumber() {
      return { ok: false, message: "Twilio number release not enabled in Phase 1A." }
    },
    async initiateCall(input) {
      const accountSid = readTwilioAccountSid()
      if (!accountSid) {
        return { ok: false, message: "TWILIO_ACCOUNT_SID is not configured." }
      }
      return {
        ok: false,
        message: "Outbound call initiation is infrastructure-only in Phase 1A.",
        providerCallId: `twilio:pending:${input.organizationId}`,
      }
    },
    async fetchCall(providerCallId) {
      if (!readTwilioAccountSid()) {
        return { ok: false, message: "TWILIO_ACCOUNT_SID is not configured." }
      }
      return { ok: true, providerCallId, status: "unknown" }
    },
    async listNumbers() {
      if (!readTwilioAccountSid()) {
        return { ok: false, numbers: [], message: "TWILIO_ACCOUNT_SID is not configured." }
      }
      return { ok: true, numbers: [], message: "Twilio listNumbers scaffold (no live API in Phase 1A)." }
    },
    async sendSms() {
      return { ok: false, message: "SMS orchestration is not enabled in Phase 1A." }
    },
    async validateWebhook(input) {
      const authToken = readTwilioAuthToken()
      if (!authToken) {
        return { ok: false, message: "TWILIO_AUTH_TOKEN is not configured for webhook validation." }
      }
      if (!input.signatureHeader) {
        return { ok: false, message: "Missing X-Twilio-Signature header." }
      }
      const params = input.params ?? {}
      const valid = validateTwilioSignature(authToken, input.signatureHeader, input.url, params)
      return valid
        ? { ok: true }
        : { ok: false, message: "Twilio webhook signature validation failed." }
    },
    normalizeWebhookEvent(payload) {
      const callSid = typeof payload.CallSid === "string" ? payload.CallSid : null
      if (!callSid) return null
      const callStatus = typeof payload.CallStatus === "string" ? payload.CallStatus : "unknown"
      const directionRaw = typeof payload.Direction === "string" ? payload.Direction.toLowerCase() : null
      const direction =
        directionRaw === "inbound" || directionRaw === "outbound"
          ? directionRaw
          : directionRaw?.includes("inbound")
            ? "inbound"
            : directionRaw?.includes("outbound")
              ? "outbound"
              : null
      const recordingSid = typeof payload.RecordingSid === "string" ? payload.RecordingSid : null
      return {
        provider: "twilio",
        providerCallId: callSid,
        eventType: callStatus,
        eventTimestamp: new Date().toISOString(),
        direction,
        fromNumber: typeof payload.From === "string" ? payload.From : null,
        toNumber: typeof payload.To === "string" ? payload.To : null,
        providerStatus: callStatus,
        recordingAvailable: Boolean(recordingSid) || callStatus === "completed",
        payload,
      }
    },
  }
}
