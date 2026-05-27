import "server-only"

import { createHash, createHmac } from "crypto"
import { buildRfc822Message, hasCredential, truncateTransportError } from "@/lib/growth/providers/adapters/adapter-utils"
import type {
  GrowthProviderAdapter,
  ProviderAdapterCredentials,
  ProviderSendMessage,
  ProviderSendResult,
} from "@/lib/growth/providers/adapters/provider-adapter-types"

function signSesRequest(input: {
  method: string
  url: URL
  headers: Record<string, string>
  body: string
  accessKeyId: string
  secretAccessKey: string
  region: string
}): Record<string, string> {
  const now = new Date()
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "")
  const dateStamp = amzDate.slice(0, 8)
  const service = "ses"
  const host = input.url.host
  const payloadHash = createHash("sha256").update(input.body).digest("hex")

  const canonicalHeaders = [
    `content-type:${input.headers["Content-Type"]}`,
    `host:${host}`,
    `x-amz-date:${amzDate}`,
    "",
  ].join("\n")

  const signedHeaders = "content-type;host;x-amz-date"
  const canonicalRequest = [
    input.method,
    input.url.pathname,
    "",
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n")

  const credentialScope = `${dateStamp}/${input.region}/${service}/aws4_request`
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    createHash("sha256").update(canonicalRequest).digest("hex"),
  ].join("\n")

  const kDate = createHmac("sha256", `AWS4${input.secretAccessKey}`).update(dateStamp).digest()
  const kRegion = createHmac("sha256", kDate).update(input.region).digest()
  const kService = createHmac("sha256", kRegion).update(service).digest()
  const kSigning = createHmac("sha256", kService).update("aws4_request").digest()
  const signature = createHmac("sha256", kSigning).update(stringToSign).digest("hex")

  const authorization = [
    "AWS4-HMAC-SHA256 Credential=",
    `${input.accessKeyId}/${credentialScope}`,
    `, SignedHeaders=${signedHeaders}`,
    `, Signature=${signature}`,
  ].join("")

  return {
    ...input.headers,
    Host: host,
    "X-Amz-Date": amzDate,
    Authorization: authorization,
  }
}

export const sesProviderAdapter: GrowthProviderAdapter = {
  family: "ses",

  capabilities() {
    return { oauthMailbox: false, smtp: false, apiKey: true, webhooks: true, tracking: false }
  },

  validate(credentials) {
    if (!hasCredential(credentials.aws_access_key_id) || !hasCredential(credentials.aws_secret_access_key)) {
      return { ok: false, status: "invalid", summary: "AWS access key and secret are required for SES." }
    }
    if (!hasCredential(credentials.aws_region)) {
      return { ok: false, status: "warning", summary: "AWS region not configured for SES." }
    }
    if (!hasCredential(credentials.from_address)) {
      return { ok: false, status: "warning", summary: "Verified SES from address not configured." }
    }
    return { ok: true, status: "valid", summary: "SES API credentials present." }
  },

  health(credentials) {
    const validation = this.validate(credentials)
    if (!validation.ok) return { ok: false, tier: "critical", summary: validation.summary }
    return { ok: true, tier: "healthy", summary: "SES transport adapter ready." }
  },

  async send(credentials, message): Promise<ProviderSendResult> {
    const validation = this.validate(credentials)
    if (!validation.ok) return { ok: false, error: validation.summary }

    if (process.env.GROWTH_TRANSPORT_SIMULATE === "true") {
      return { ok: true, provider_message_id: `sim-ses-${Date.now()}`, simulated: true }
    }

    const region = credentials.aws_region ?? "us-east-1"
    const url = new URL(`https://email.${region}.amazonaws.com/v2/email/outbound-emails`)
    const body = JSON.stringify({
      FromEmailAddress: credentials.from_address ?? message.from,
      Destination: { ToAddresses: [message.to] },
      Content: {
        Simple: {
          Subject: { Data: message.subject, Charset: "UTF-8" },
          Body: {
            ...(message.html ? { Html: { Data: message.html, Charset: "UTF-8" } } : {}),
            ...(message.text ? { Text: { Data: message.text, Charset: "UTF-8" } } : {}),
          },
        },
      },
      ...(message.replyTo ? { ReplyToAddresses: [message.replyTo] } : {}),
    })

    try {
      const baseHeaders = { "Content-Type": "application/json" }
      const signedHeaders = signSesRequest({
        method: "POST",
        url,
        headers: baseHeaders,
        body,
        accessKeyId: credentials.aws_access_key_id!,
        secretAccessKey: credentials.aws_secret_access_key!,
        region,
      })

      const response = await fetch(url, { method: "POST", headers: signedHeaders, body })
      const payload = (await response.json().catch(() => ({}))) as { MessageId?: string; message?: string }
      if (!response.ok) {
        return { ok: false, error: truncateTransportError(payload.message ?? `SES API ${response.status}`) }
      }
      return { ok: true, provider_message_id: payload.MessageId ?? undefined }
    } catch (error) {
      return { ok: false, error: truncateTransportError(error instanceof Error ? error.message : "SES send failed.") }
    }
  },
}

export async function sendViaSes(
  credentials: ProviderAdapterCredentials,
  message: ProviderSendMessage,
): Promise<ProviderSendResult> {
  return sesProviderAdapter.send(credentials, message)
}

/** Exported for unit tests — RFC822 builder reused by SMTP. */
export { buildRfc822Message }
