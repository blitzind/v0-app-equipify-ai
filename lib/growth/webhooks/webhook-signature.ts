import { createHmac, timingSafeEqual } from "node:crypto"
import type { GrowthWebhookProviderFamily } from "@/lib/growth/webhooks/webhook-types"
import { hashWebhookSigningSecret } from "@/lib/growth/webhooks/webhook-sanitizer"

export type WebhookSignatureVerifyInput = {
  providerFamily: GrowthWebhookProviderFamily | string
  rawBody: string
  headers: Headers
  signingSecretHash?: string | null
  endpointStatus?: string | null
  querySecret?: string | null
}

export type WebhookSignatureVerifyResult = {
  ok: boolean
  mode: "verified" | "simulation" | "missing_secret" | "failed"
  message?: string
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}

function verifyHmacSha256(secret: string, rawBody: string, provided: string): boolean {
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex")
  const normalized = provided.replace(/^sha256=/, "").replace(/^v1=/, "")
  return safeEqual(expected, normalized)
}

function header(headers: Headers, name: string): string | null {
  const value = headers.get(name)
  return value?.trim() || null
}

function verifySecretHash(candidate: string, signingSecretHash: string): boolean {
  return safeEqual(hashWebhookSigningSecret(candidate), signingSecretHash)
}

function verifyProviderHmac(
  providerFamily: string,
  input: WebhookSignatureVerifyInput,
  secret: string,
): boolean {
  switch (providerFamily) {
    case "ses": {
      const signature = header(input.headers, "x-amz-sns-signature")
      return signature ? verifyHmacSha256(secret, input.rawBody, signature) : Boolean(header(input.headers, "x-amz-sns-message-type"))
    }
    case "resend": {
      const provided = header(input.headers, "svix-signature") ?? header(input.headers, "resend-signature")
      if (!provided) return false
      const sigPart = provided.split(",").find((part) => part.startsWith("v1=")) ?? provided
      return verifyHmacSha256(secret, input.rawBody, sigPart)
    }
    case "google": {
      const provided = header(input.headers, "x-goog-signature") ?? header(input.headers, "x-hub-signature-256")
      return provided ? verifyHmacSha256(secret, input.rawBody, provided) : false
    }
    case "microsoft": {
      const provided = header(input.headers, "x-ms-signature") ?? header(input.headers, "x-hub-signature-256")
      return provided ? verifyHmacSha256(secret, input.rawBody, provided) : false
    }
    case "smtp":
    case "custom":
    default: {
      const provided =
        header(input.headers, "x-webhook-signature") ??
        header(input.headers, "x-signature") ??
        header(input.headers, "x-hub-signature-256")
      return provided ? verifyHmacSha256(secret, input.rawBody, provided) : false
    }
  }
}

export function isWebhookSimulationMode(input: {
  endpointStatus?: string | null
  signingSecretHash?: string | null
}): boolean {
  if (input.endpointStatus === "simulation") return true
  if (!input.signingSecretHash && process.env.NODE_ENV !== "production") return true
  if (process.env.GROWTH_WEBHOOK_SIMULATION === "true") return true
  return false
}

export function verifyProviderWebhookSignature(input: WebhookSignatureVerifyInput): WebhookSignatureVerifyResult {
  if (isWebhookSimulationMode(input)) {
    return { ok: true, mode: "simulation", message: "Simulation or dev mode — signature bypassed." }
  }

  if (!input.signingSecretHash) {
    return { ok: false, mode: "missing_secret", message: "Signing secret not configured." }
  }

  const headerSecret = header(input.headers, "x-webhook-secret") ?? header(input.headers, "x-growth-webhook-secret")
  const querySecret = input.querySecret?.trim() || null

  if (headerSecret && verifySecretHash(headerSecret, input.signingSecretHash)) {
    return { ok: true, mode: "verified" }
  }
  if (querySecret && verifySecretHash(querySecret, input.signingSecretHash)) {
    return { ok: true, mode: "verified" }
  }

  const hmacSecret = headerSecret ?? querySecret
  if (hmacSecret && verifyProviderHmac(input.providerFamily, input, hmacSecret)) {
    return { ok: true, mode: "verified" }
  }

  return { ok: false, mode: "failed", message: "Webhook signature verification failed." }
}
