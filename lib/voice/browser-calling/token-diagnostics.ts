import { createHash } from "node:crypto"

export type SidDiagnosticMask = {
  prefix: string
  suffix: string
}

export type VoiceBrowserTokenMintDiagnostics = {
  accountSidMask: SidDiagnosticMask
  apiKeySidMask: SidDiagnosticMask
  twimlAppSidMask: SidDiagnosticMask
  apiKeySecretFingerprint: string | null
  identity: string
  grantTypes: string[]
  tokenIssuerSid: string | null
  tokenSubjectSid: string | null
  voiceGrantIncomingAllow: boolean | null
  voiceGrantOutgoingApplicationSid: string | null
  signingKeySidPrefixValid: boolean
  signingCredentialSource: "TWILIO_API_KEY_SECRET"
}

export function maskSidForDiagnostics(sid: string): SidDiagnosticMask {
  const trimmed = sid.trim()
  if (trimmed.length <= 8) {
    return { prefix: trimmed.slice(0, 2), suffix: trimmed.slice(-2) }
  }
  return { prefix: trimmed.slice(0, 4), suffix: trimmed.slice(-4) }
}

export function fingerprintTrimmedApiKeySecret(secret: string | null | undefined): string | null {
  if (!secret?.trim()) return null
  return createHash("sha256").update(secret.trim(), "utf8").digest("hex").slice(0, 10)
}

export function decodeJwtPayloadForDiagnostics(jwt: string): Record<string, unknown> | null {
  const parts = jwt.split(".")
  if (parts.length !== 3) return null
  try {
    const json = Buffer.from(parts[1], "base64url").toString("utf8")
    return JSON.parse(json) as Record<string, unknown>
  } catch {
    return null
  }
}

export function buildVoiceBrowserTokenMintDiagnostics(input: {
  accountSid: string
  apiKeySid: string
  apiKeySecret: string | null
  twimlAppSid: string
  identity: string
  jwt: string | null
}): VoiceBrowserTokenMintDiagnostics {
  const payload = input.jwt ? decodeJwtPayloadForDiagnostics(input.jwt) : null
  const grants = payload?.grants
  const voiceGrant =
    grants && typeof grants === "object" && grants !== null && "voice" in grants
      ? (grants as Record<string, unknown>).voice
      : null
  const voiceGrantRecord =
    voiceGrant && typeof voiceGrant === "object" && voiceGrant !== null
      ? (voiceGrant as Record<string, unknown>)
      : null
  const incoming =
    voiceGrantRecord?.incoming &&
    typeof voiceGrantRecord.incoming === "object" &&
    voiceGrantRecord.incoming !== null
      ? (voiceGrantRecord.incoming as Record<string, unknown>)
      : null
  const outgoing =
    voiceGrantRecord?.outgoing &&
    typeof voiceGrantRecord.outgoing === "object" &&
    voiceGrantRecord.outgoing !== null
      ? (voiceGrantRecord.outgoing as Record<string, unknown>)
      : null

  const grantTypes =
    grants && typeof grants === "object" && grants !== null
      ? Object.keys(grants as Record<string, unknown>).filter((key) => key !== "identity")
      : []

  const apiKeySid = input.apiKeySid.trim()

  return {
    accountSidMask: maskSidForDiagnostics(input.accountSid),
    apiKeySidMask: maskSidForDiagnostics(apiKeySid),
    twimlAppSidMask: maskSidForDiagnostics(input.twimlAppSid),
    apiKeySecretFingerprint: fingerprintTrimmedApiKeySecret(input.apiKeySecret),
    identity: input.identity,
    grantTypes,
    tokenIssuerSid: typeof payload?.iss === "string" ? payload.iss : null,
    tokenSubjectSid: typeof payload?.sub === "string" ? payload.sub : null,
    voiceGrantIncomingAllow: incoming?.allow === true ? true : incoming?.allow === false ? false : null,
    voiceGrantOutgoingApplicationSid:
      typeof outgoing?.application_sid === "string" ? outgoing.application_sid : null,
    signingKeySidPrefixValid: apiKeySid.startsWith("SK"),
    signingCredentialSource: "TWILIO_API_KEY_SECRET",
  }
}
