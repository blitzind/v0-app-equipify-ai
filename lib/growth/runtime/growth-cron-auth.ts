import "server-only"

import { createHash } from "node:crypto"
import { NextResponse } from "next/server"

export type GrowthCronAuthFailureReason =
  | "cron_secret_not_configured"
  | "authorization_missing"
  | "token_mismatch"

export type GrowthCronAuthBranch = "bearer" | "x-cron-secret"

export type GrowthCronAuthDiagnostics = {
  cronSecretConfigured: boolean
  envSecretLength: number
  authorizationHeaderPresent: boolean
  xCronSecretHeaderPresent: boolean
  authBranch: GrowthCronAuthBranch | null
  failureReason: GrowthCronAuthFailureReason | null
}

export type GrowthCronAuthFailureLog = {
  cronSecretConfigured: boolean
  envSecretLength: number
  envSecretHashPrefix: string | null
  authorizationHeaderPresent: boolean
  xCronSecretHeaderPresent: boolean
  incomingTokenLength: number
  incomingTokenHashPrefix: string | null
  authBranch: GrowthCronAuthBranch | null
  failureReason: GrowthCronAuthFailureReason
  cronRoute: string | null
}

function readConfiguredCronSecret(): string | null {
  const secret = process.env.CRON_SECRET?.trim()
  return secret && secret.length > 0 ? secret : null
}

/** Safe runtime fingerprint for admin diagnostics — never returns the raw secret. */
export function describeConfiguredGrowthCronSecret(): {
  configured: boolean
  length: number
  hashPrefix: string
} {
  const secret = readConfiguredCronSecret()
  if (!secret) {
    return { configured: false, length: 0, hashPrefix: "" }
  }
  return {
    configured: true,
    length: secret.length,
    hashPrefix: hashGrowthCronAuthTokenPrefix(secret) ?? "",
  }
}

/** Safe fingerprint for comparing env vs incoming tokens without logging secrets. */
export function hashGrowthCronAuthTokenPrefix(token: string | null | undefined): string | null {
  if (!token || token.length === 0) return null
  return createHash("sha256").update(token, "utf8").digest("hex").slice(0, 8)
}

/** Extract bearer token; tolerate case/spacing/newline differences Vercel and curl may introduce. */
export function extractGrowthCronBearerToken(authorizationHeader: string | null): string | null {
  if (!authorizationHeader) return null
  if (!/^Bearer\s+/i.test(authorizationHeader)) return null
  const token = authorizationHeader.replace(/^Bearer\s+/i, "").trim()
  return token.length > 0 ? token : null
}

function resolveIncomingCronToken(request: Request): string | null {
  const bearerToken = extractGrowthCronBearerToken(request.headers.get("authorization"))
  if (bearerToken) return bearerToken
  const xCronSecret = request.headers.get("x-cron-secret")?.trim() ?? ""
  return xCronSecret.length > 0 ? xCronSecret : null
}

export function buildGrowthCronAuthFailureLog(
  request: Request,
  diagnostics: GrowthCronAuthDiagnostics,
  cronRoute?: string,
): GrowthCronAuthFailureLog | null {
  if (!diagnostics.failureReason) return null

  const envSecret = readConfiguredCronSecret()
  const incomingToken = resolveIncomingCronToken(request)

  return {
    cronSecretConfigured: diagnostics.cronSecretConfigured,
    envSecretLength: envSecret?.length ?? 0,
    envSecretHashPrefix: hashGrowthCronAuthTokenPrefix(envSecret),
    authorizationHeaderPresent: diagnostics.authorizationHeaderPresent,
    xCronSecretHeaderPresent: diagnostics.xCronSecretHeaderPresent,
    incomingTokenLength: incomingToken?.length ?? 0,
    incomingTokenHashPrefix: hashGrowthCronAuthTokenPrefix(incomingToken),
    authBranch: diagnostics.authBranch,
    failureReason: diagnostics.failureReason,
    cronRoute: cronRoute ?? null,
  }
}

export function diagnoseGrowthCronAuth(request: Request): GrowthCronAuthDiagnostics {
  const secret = readConfiguredCronSecret()
  const authorizationHeader = request.headers.get("authorization")
  const xCronSecret = request.headers.get("x-cron-secret")?.trim() ?? ""
  const bearerToken = extractGrowthCronBearerToken(authorizationHeader)

  if (!secret) {
    return {
      cronSecretConfigured: false,
      envSecretLength: 0,
      authorizationHeaderPresent: Boolean(authorizationHeader),
      xCronSecretHeaderPresent: xCronSecret.length > 0,
      authBranch: null,
      failureReason: "cron_secret_not_configured",
    }
  }

  if (bearerToken === secret) {
    return {
      cronSecretConfigured: true,
      envSecretLength: secret.length,
      authorizationHeaderPresent: Boolean(authorizationHeader),
      xCronSecretHeaderPresent: xCronSecret.length > 0,
      authBranch: "bearer",
      failureReason: null,
    }
  }

  if (xCronSecret.length > 0 && xCronSecret === secret) {
    return {
      cronSecretConfigured: true,
      envSecretLength: secret.length,
      authorizationHeaderPresent: Boolean(authorizationHeader),
      xCronSecretHeaderPresent: true,
      authBranch: "x-cron-secret",
      failureReason: null,
    }
  }

  return {
    cronSecretConfigured: true,
    envSecretLength: secret.length,
    authorizationHeaderPresent: Boolean(authorizationHeader),
    xCronSecretHeaderPresent: xCronSecret.length > 0,
    authBranch: null,
    failureReason:
      !authorizationHeader && xCronSecret.length === 0 ? "authorization_missing" : "token_mismatch",
  }
}

function logGrowthCronAuthFailure(
  request: Request,
  diagnostics: GrowthCronAuthDiagnostics,
  cronRoute?: string,
): void {
  const payload = buildGrowthCronAuthFailureLog(request, diagnostics, cronRoute)
  if (!payload) return
  console.warn("[growth-cron-auth] unauthorized", JSON.stringify(payload))
}

export function verifyGrowthCronRequest(request: Request, cronRoute?: string): NextResponse | null {
  const diagnostics = diagnoseGrowthCronAuth(request)

  if (diagnostics.failureReason === "cron_secret_not_configured") {
    logGrowthCronAuthFailure(request, diagnostics, cronRoute)
    return NextResponse.json({ error: "cron_secret_not_configured" }, { status: 503 })
  }

  if (diagnostics.failureReason) {
    logGrowthCronAuthFailure(request, diagnostics, cronRoute)
    return NextResponse.json(
      {
        error: "unauthorized",
        auth_failure: diagnostics.failureReason,
      },
      { status: 401 },
    )
  }

  return null
}
