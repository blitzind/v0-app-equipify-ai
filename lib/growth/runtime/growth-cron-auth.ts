import "server-only"

import { NextResponse } from "next/server"

export type GrowthCronAuthFailureReason =
  | "cron_secret_not_configured"
  | "authorization_missing"
  | "token_mismatch"

export type GrowthCronAuthBranch = "bearer" | "x-cron-secret"

export type GrowthCronAuthDiagnostics = {
  cronSecretConfigured: boolean
  cronSecretLength: number
  authorizationHeaderPresent: boolean
  xCronSecretHeaderPresent: boolean
  authBranch: GrowthCronAuthBranch | null
  failureReason: GrowthCronAuthFailureReason | null
}

function readConfiguredCronSecret(): string | null {
  const secret = process.env.CRON_SECRET?.trim()
  return secret && secret.length > 0 ? secret : null
}

/** Extract bearer token; tolerate case/spacing/newline differences Vercel and curl may introduce. */
export function extractGrowthCronBearerToken(authorizationHeader: string | null): string | null {
  if (!authorizationHeader) return null
  if (!/^Bearer\s+/i.test(authorizationHeader)) return null
  const token = authorizationHeader.replace(/^Bearer\s+/i, "").trim()
  return token.length > 0 ? token : null
}

export function diagnoseGrowthCronAuth(request: Request): GrowthCronAuthDiagnostics {
  const secret = readConfiguredCronSecret()
  const authorizationHeader = request.headers.get("authorization")
  const xCronSecret = request.headers.get("x-cron-secret")?.trim() ?? ""
  const bearerToken = extractGrowthCronBearerToken(authorizationHeader)

  if (!secret) {
    return {
      cronSecretConfigured: false,
      cronSecretLength: 0,
      authorizationHeaderPresent: Boolean(authorizationHeader),
      xCronSecretHeaderPresent: xCronSecret.length > 0,
      authBranch: null,
      failureReason: "cron_secret_not_configured",
    }
  }

  if (bearerToken === secret) {
    return {
      cronSecretConfigured: true,
      cronSecretLength: secret.length,
      authorizationHeaderPresent: Boolean(authorizationHeader),
      xCronSecretHeaderPresent: xCronSecret.length > 0,
      authBranch: "bearer",
      failureReason: null,
    }
  }

  if (xCronSecret.length > 0 && xCronSecret === secret) {
    return {
      cronSecretConfigured: true,
      cronSecretLength: secret.length,
      authorizationHeaderPresent: Boolean(authorizationHeader),
      xCronSecretHeaderPresent: true,
      authBranch: "x-cron-secret",
      failureReason: null,
    }
  }

  return {
    cronSecretConfigured: true,
    cronSecretLength: secret.length,
    authorizationHeaderPresent: Boolean(authorizationHeader),
    xCronSecretHeaderPresent: xCronSecret.length > 0,
    authBranch: null,
    failureReason:
      !authorizationHeader && xCronSecret.length === 0 ? "authorization_missing" : "token_mismatch",
  }
}

function logGrowthCronAuthFailure(diagnostics: GrowthCronAuthDiagnostics, routeHint?: string): void {
  console.warn(
    `[growth-cron-auth] unauthorized${routeHint ? ` route=${routeHint}` : ""}`,
    JSON.stringify(diagnostics),
  )
}

export function verifyGrowthCronRequest(request: Request, routeHint?: string): NextResponse | null {
  const diagnostics = diagnoseGrowthCronAuth(request)

  if (diagnostics.failureReason === "cron_secret_not_configured") {
    logGrowthCronAuthFailure(diagnostics, routeHint)
    return NextResponse.json({ error: "cron_secret_not_configured" }, { status: 503 })
  }

  if (diagnostics.failureReason) {
    logGrowthCronAuthFailure(diagnostics, routeHint)
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
