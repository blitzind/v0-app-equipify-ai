/** GE-AIOS-LIVE-2B — Canonical DataMoon Production configuration audit (client-safe). */

import {
  isDatamoonAudienceConfigured,
  isDatamoonDryRunOnly,
  isDatamoonProviderConfigured,
  isDatamoonProviderEnabled,
  resolveDatamoonAudienceMode,
} from "@/lib/growth/providers/datamoon/datamoon-config"
import {
  autonomousDiscoveryStopReasonMessage,
  evaluateAutonomousProspectDiscoveryProviderPolicy,
  isProductionRuntime,
} from "@/lib/growth/prospect-search/prospect-search-datamoon-autonomous-discovery-policy-1a"
import { buildDatamoonAutonomousDiscoveryOperatorState } from "@/lib/growth/prospect-search/prospect-search-datamoon-autonomous-discovery-operator-1a"
import {
  GROWTH_DATAMOON_AUTONOMOUS_DISCOVERY_CUTOVER_1A_QA_MARKER,
  type DatamoonAutonomousDiscoveryHealthSnapshot,
  type DatamoonAutonomousDiscoveryStopReason,
} from "@/lib/growth/prospect-search/prospect-search-datamoon-autonomous-discovery-types-1a"

export const GROWTH_DATAMOON_PRODUCTION_CONFIGURATION_AUDIT_2B_QA_MARKER =
  "ge-aios-live-2b-datamoon-production-configuration-audit-v1" as const

export const DATAMOON_PRODUCTION_CONFIGURATION_ENV_KEYS = [
  "DATAMOON_PROVIDER_ENABLED",
  "DATAMOON_DRY_RUN_ONLY",
  "DATAMOON_DEFAULT_MODE",
  "DATAMOON_AUDIENCE_EXT_API_KEY",
  "DATAMOON_AUDIENCE_MODULE_API_KEY",
  "DATAMOON_ENRICHMENT_API_KEY",
] as const

export type DatamoonProductionEnvPresence = "present" | "missing"

export type DatamoonProductionConfigurationAudit = {
  qaMarker: typeof GROWTH_DATAMOON_PRODUCTION_CONFIGURATION_AUDIT_2B_QA_MARKER
  policyQaMarker: typeof GROWTH_DATAMOON_AUTONOMOUS_DISCOVERY_CUTOVER_1A_QA_MARKER
  authorityModule: "lib/growth/providers/datamoon/datamoon-config.ts"
  policyModule: "lib/growth/prospect-search/prospect-search-datamoon-autonomous-discovery-policy-1a.ts"
  operatorModule: "lib/growth/prospect-search/prospect-search-datamoon-autonomous-discovery-operator-1a.ts"
  productionRuntime: boolean
  requiredEnv: Record<(typeof DATAMOON_PRODUCTION_CONFIGURATION_ENV_KEYS)[number], DatamoonProductionEnvPresence>
  datamoonEnabled: boolean
  datamoonConfigured: boolean
  datamoonAudienceConfigured: boolean
  datamoonDryRunOnly: boolean
  datamoonAudienceMode: "ext" | "module"
  stopReason: DatamoonAutonomousDiscoveryStopReason | null
  statusLabel: ReturnType<typeof buildDatamoonAutonomousDiscoveryOperatorState>["statusLabel"]
  statusDisplay: string
  eligibleForAutonomousDiscovery: boolean
  configurationCompleteForProduction: boolean
  blockingReasons: string[]
}

function envPresence(env: NodeJS.ProcessEnv, key: string): DatamoonProductionEnvPresence {
  const value = env[key]
  return typeof value === "string" && value.trim().length > 0 ? "present" : "missing"
}

export function auditDatamoonProductionEnvPresence(
  env: NodeJS.ProcessEnv = process.env,
): Record<(typeof DATAMOON_PRODUCTION_CONFIGURATION_ENV_KEYS)[number], DatamoonProductionEnvPresence> {
  return {
    DATAMOON_PROVIDER_ENABLED: envPresence(env, "DATAMOON_PROVIDER_ENABLED"),
    DATAMOON_DRY_RUN_ONLY: envPresence(env, "DATAMOON_DRY_RUN_ONLY"),
    DATAMOON_DEFAULT_MODE: envPresence(env, "DATAMOON_DEFAULT_MODE"),
    DATAMOON_AUDIENCE_EXT_API_KEY: envPresence(env, "DATAMOON_AUDIENCE_EXT_API_KEY"),
    DATAMOON_AUDIENCE_MODULE_API_KEY: envPresence(env, "DATAMOON_AUDIENCE_MODULE_API_KEY"),
    DATAMOON_ENRICHMENT_API_KEY: envPresence(env, "DATAMOON_ENRICHMENT_API_KEY"),
  }
}

export function buildDatamoonProductionConfigurationAudit(input?: {
  env?: NodeJS.ProcessEnv
  discoveriesToday?: number
  maximumDailyDiscovery?: number
  approvedBusinessProfilePresent?: boolean
}): DatamoonProductionConfigurationAudit {
  const env = input?.env ?? process.env
  const requiredEnv = auditDatamoonProductionEnvPresence(env)
  const policy = evaluateAutonomousProspectDiscoveryProviderPolicy({
    authority: "autonomous_portfolio",
    env,
    discoveriesToday: input?.discoveriesToday,
    maximumDailyDiscovery: input?.maximumDailyDiscovery,
  })
  const operator = buildDatamoonAutonomousDiscoveryOperatorState({
    policy,
    nextBatchSize: null,
  })
  const datamoonAudienceMode = resolveDatamoonAudienceMode(env)
  const productionRuntime = isProductionRuntime(env)
  const blockingReasons: string[] = []

  if (requiredEnv.DATAMOON_PROVIDER_ENABLED === "missing" || !isDatamoonProviderEnabled(env)) {
    blockingReasons.push("DATAMOON_PROVIDER_ENABLED must be present and truthy.")
  }
  if (!isDatamoonAudienceConfigured(env, datamoonAudienceMode)) {
    blockingReasons.push(
      datamoonAudienceMode === "module"
        ? "DATAMOON_AUDIENCE_MODULE_API_KEY must be present for module mode."
        : "DATAMOON_AUDIENCE_EXT_API_KEY must be present for ext mode.",
    )
  }
  if (productionRuntime && isDatamoonDryRunOnly(env)) {
    blockingReasons.push("DATAMOON_DRY_RUN_ONLY must be false for live Production discovery.")
  }
  if (input?.approvedBusinessProfilePresent === false) {
    blockingReasons.push("Approved Business Profile required for autonomous discovery.")
  }
  if (policy.stopReason) {
    blockingReasons.push(autonomousDiscoveryStopReasonMessage(policy.stopReason))
  }

  const configurationCompleteForProduction =
    isDatamoonProviderEnabled(env) &&
    isDatamoonProviderConfigured(env) &&
    isDatamoonAudienceConfigured(env, datamoonAudienceMode) &&
    (!productionRuntime || !isDatamoonDryRunOnly(env))

  return {
    qaMarker: GROWTH_DATAMOON_PRODUCTION_CONFIGURATION_AUDIT_2B_QA_MARKER,
    policyQaMarker: GROWTH_DATAMOON_AUTONOMOUS_DISCOVERY_CUTOVER_1A_QA_MARKER,
    authorityModule: "lib/growth/providers/datamoon/datamoon-config.ts",
    policyModule: "lib/growth/prospect-search/prospect-search-datamoon-autonomous-discovery-policy-1a.ts",
    operatorModule: "lib/growth/prospect-search/prospect-search-datamoon-autonomous-discovery-operator-1a.ts",
    productionRuntime,
    requiredEnv,
    datamoonEnabled: isDatamoonProviderEnabled(env),
    datamoonConfigured: isDatamoonProviderConfigured(env),
    datamoonAudienceConfigured: isDatamoonAudienceConfigured(env, datamoonAudienceMode),
    datamoonDryRunOnly: isDatamoonDryRunOnly(env),
    datamoonAudienceMode,
    stopReason: policy.stopReason,
    statusLabel: operator.statusLabel,
    statusDisplay: operator.statusDisplay,
    eligibleForAutonomousDiscovery: policy.eligible,
    configurationCompleteForProduction,
    blockingReasons: [...new Set(blockingReasons)],
  }
}

export function extendDatamoonHealthSnapshotWithConfigurationAudit(input: {
  base: DatamoonAutonomousDiscoveryHealthSnapshot
  audit: DatamoonProductionConfigurationAudit
}): DatamoonAutonomousDiscoveryHealthSnapshot & {
  stopReason: DatamoonAutonomousDiscoveryStopReason | null
  statusLabel: DatamoonProductionConfigurationAudit["statusLabel"]
  statusDisplay: string
  requiredEnv: DatamoonProductionConfigurationAudit["requiredEnv"]
  configurationCompleteForProduction: boolean
  blockingReasons: string[]
} {
  return {
    ...input.base,
    ok: input.base.ok && input.audit.configurationCompleteForProduction,
    stopReason: input.audit.stopReason,
    statusLabel: input.audit.statusLabel,
    statusDisplay: input.audit.statusDisplay,
    requiredEnv: input.audit.requiredEnv,
    configurationCompleteForProduction: input.audit.configurationCompleteForProduction,
    blockingReasons: input.audit.blockingReasons,
  }
}
