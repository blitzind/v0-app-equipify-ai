import { z } from "zod"
import type { GrowthAiosRuntimeConfigProofClassification } from "@/lib/growth/aios/runtime/growth-aios-runtime-config-health-1a-types"

export function classifySensitiveEnvPresence(
  envKey: string,
  env: NodeJS.ProcessEnv = process.env,
): GrowthAiosRuntimeConfigProofClassification {
  const raw = env[envKey]?.trim() ?? ""
  if (raw.length > 0) {
    return z.string().uuid().safeParse(raw).success ? "verified_true" : "verified_false"
  }
  if (env.EQUIPIFY_VERCEL_PRODUCTION_ENV_RUN === "1") {
    return "unverified_sensitive_value"
  }
  return "not_configured"
}

export function classifyBooleanFromDeployedOrLocal(input: {
  deployedValue: boolean | null | undefined
  localValue: boolean
  localEnvPresent: boolean
  vercelProductionEnvRun: boolean
}): GrowthAiosRuntimeConfigProofClassification {
  if (typeof input.deployedValue === "boolean") {
    return input.deployedValue ? "verified_true" : "verified_false"
  }
  if (!input.localEnvPresent && input.vercelProductionEnvRun) {
    return "unverified_sensitive_value"
  }
  if (!input.localEnvPresent) {
    return "not_configured"
  }
  return input.localValue ? "verified_true" : "verified_false"
}

export function classificationBlocksConfiguration(
  classification: GrowthAiosRuntimeConfigProofClassification,
): boolean {
  return classification === "verified_false" || classification === "not_configured"
}
