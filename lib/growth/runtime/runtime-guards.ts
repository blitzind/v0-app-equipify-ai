import "server-only"

import {
  DEV_FALLBACK_CREDENTIAL_PEPPER,
  isUsingDevFallbackCredentialPepper,
} from "@/lib/growth/outbound/credentials-crypto"

export type GrowthRuntimeGuardViolation = {
  code:
    | "dev_fallback_credential_pepper"
    | "transport_simulation_enabled"
    | "inbox_sync_simulation_enabled"
  message: string
  severity: "error" | "warning"
}

export type GrowthRuntimeDiagnostics = {
  environment: "production" | "preview" | "development" | "unknown"
  production: boolean
  violations: GrowthRuntimeGuardViolation[]
  warnings: string[]
  simulate: {
    transport: boolean
    inboxSync: boolean
  }
  credentialPepperConfigured: boolean
  usingDevFallbackCredentialPepper: boolean
}

function resolveGrowthRuntimeEnvironment(): GrowthRuntimeDiagnostics["environment"] {
  const vercel = process.env.VERCEL_ENV?.trim()
  if (vercel === "production") return "production"
  if (vercel === "preview") return "preview"
  if (process.env.NODE_ENV === "production") return "production"
  if (process.env.NODE_ENV === "development") return "development"
  return "unknown"
}

export function isGrowthProductionRuntime(): boolean {
  return resolveGrowthRuntimeEnvironment() === "production"
}

export function isGrowthTransportSimulationEnabled(): boolean {
  return process.env.GROWTH_TRANSPORT_SIMULATE?.trim() === "true"
}

export function isGrowthInboxSyncSimulationEnabled(): boolean {
  return process.env.GROWTH_INBOX_SYNC_SIMULATE?.trim() === "true"
}

export function collectGrowthRuntimeDiagnostics(): GrowthRuntimeDiagnostics {
  const environment = resolveGrowthRuntimeEnvironment()
  const production = environment === "production"
  const transport = isGrowthTransportSimulationEnabled()
  const inboxSync = isGrowthInboxSyncSimulationEnabled()
  const usingFallbackPepper = isUsingDevFallbackCredentialPepper()

  const violations: GrowthRuntimeGuardViolation[] = []
  const warnings: string[] = []

  if (usingFallbackPepper) {
    const entry: GrowthRuntimeGuardViolation = {
      code: "dev_fallback_credential_pepper",
      message: `Production requires GROWTH_PROVIDER_CREDENTIALS_PEPPER — default dev pepper (${DEV_FALLBACK_CREDENTIAL_PEPPER}) is not allowed.`,
      severity: production ? "error" : "warning",
    }
    violations.push(entry)
    if (!production) warnings.push(entry.message)
  }

  if (transport) {
    const entry: GrowthRuntimeGuardViolation = {
      code: "transport_simulation_enabled",
      message: "GROWTH_TRANSPORT_SIMULATE=true is not allowed in production outbound send plane.",
      severity: production ? "error" : "warning",
    }
    violations.push(entry)
    if (!production) warnings.push(entry.message)
  }

  if (inboxSync) {
    const entry: GrowthRuntimeGuardViolation = {
      code: "inbox_sync_simulation_enabled",
      message: "GROWTH_INBOX_SYNC_SIMULATE=true is not allowed in production inbox sync.",
      severity: production ? "error" : "warning",
    }
    violations.push(entry)
    if (!production) warnings.push(entry.message)
  }

  return {
    environment,
    production,
    violations,
    warnings,
    simulate: { transport, inboxSync },
    credentialPepperConfigured: !usingFallbackPepper,
    usingDevFallbackCredentialPepper: usingFallbackPepper,
  }
}

/** Hard production gate — throws when unsafe simulation or credential config is active. */
export function assertGrowthProductionRuntimeSafe(context?: string): void {
  const diagnostics = collectGrowthRuntimeDiagnostics()
  if (!diagnostics.production) return

  const errors = diagnostics.violations.filter((v) => v.severity === "error")
  if (errors.length === 0) return

  const prefix = context ? `[${context}] ` : ""
  throw new Error(`${prefix}${errors.map((e) => e.message).join(" ")}`)
}
