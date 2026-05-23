import type { GrowthProviderCapabilitySnapshot, GrowthProviderValidationWarning } from "@/lib/growth/outbound/provider-types"
import { mergeGrowthProviderCapabilities } from "@/lib/growth/outbound/capability-snapshot"
import type { GrowthProviderValidationResult } from "@/lib/growth/outbound/providers/types"

export type FixtureValidationMode = "healthy" | "warning" | "error" | "degraded"

export function resolveFixtureValidationMode(config: Record<string, unknown>): FixtureValidationMode {
  const raw = config.validationFixture
  if (raw === "warning" || raw === "error" || raw === "degraded" || raw === "healthy") return raw
  return "healthy"
}

export function buildFixtureValidationResult(input: {
  declared: GrowthProviderCapabilitySnapshot
  config: Record<string, unknown>
  credentials: Record<string, unknown> | null
  providerLabel: string
}): GrowthProviderValidationResult {
  const mode = resolveFixtureValidationMode(input.config)
  const hasCredentials = Boolean(input.credentials?.apiKey || input.credentials?.accessToken)

  if (mode === "error" || (!hasCredentials && input.config.requireCredentials === true)) {
    return {
      healthy: false,
      warnings: [],
      supportedCapabilities: input.declared,
      accountMetadata: { fixtureMode: mode, validated: false },
      temporarilyDegraded: false,
      degradedReason: null,
      degradedUntil: null,
    }
  }

  const warnings: GrowthProviderValidationWarning[] = []
  let temporarilyDegraded = false
  let degradedReason: string | null = null
  let degradedUntil: string | null = null

  if (mode === "warning") {
    warnings.push({
      code: "fixture_warning",
      message: `${input.providerLabel} fixture validation returned warnings.`,
    })
  }

  if (mode === "degraded") {
    temporarilyDegraded = true
    degradedReason = `${input.providerLabel} temporarily degraded (fixture).`
    degradedUntil = new Date(Date.now() + 60 * 60 * 1000).toISOString()
    warnings.push({
      code: "provider_degraded",
      message: degradedReason,
    })
  }

  const probed: Partial<GrowthProviderCapabilitySnapshot> = {}
  for (const [key, value] of Object.entries(input.declared)) {
    if (value === "supported" || value === "partial") {
      probed[key as keyof GrowthProviderCapabilitySnapshot] = value
    }
  }

  return {
    healthy: mode !== "error",
    warnings,
    supportedCapabilities: mergeGrowthProviderCapabilities(input.declared, probed),
    accountMetadata: {
      fixtureMode: mode,
      validated: true,
      seatCount: typeof input.config.fixtureSeatCount === "number" ? input.config.fixtureSeatCount : 1,
      accountName: `${input.providerLabel} fixture account`,
    },
    temporarilyDegraded,
    degradedReason,
    degradedUntil,
  }
}
