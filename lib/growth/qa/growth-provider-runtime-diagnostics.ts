/**
 * Phase 7.PS-HO-RUNTIME — Masked provider runtime diagnostics (no secrets).
 */

import {
  isEmailVerificationDisabled,
  isEmailVerificationFixtureEnabled,
  isZeroBounceConfigured,
  getZeroBounceApiKey,
} from "@/lib/growth/contact-verification/providers/zerobounce-config"
import {
  getPdlApiKey,
  isPdlApiConfigured,
  isPdlContactDiscoveryEnabled,
  isPdlDiscoveryDisabled,
  isPdlProviderConfigured,
  isPdlSandboxEnabled,
  resolvePdlSandboxEnvConfig,
} from "@/lib/growth/providers/pdl/pdl-config"
import { maskProviderEnvValue, classifyProviderEnvValueShape } from "@/lib/growth/qa/provider-runtime-env-resolution"

export const GROWTH_PROVIDER_RUNTIME_DIAGNOSTICS_QA_MARKER =
  "growth-provider-runtime-diagnostics-7-ps-ho-runtime-v1" as const

export type GrowthProviderRuntimeKeyStatus = {
  present: boolean
  length: number
  masked: string
  shape: ReturnType<typeof classifyProviderEnvValueShape>
}

export type GrowthProviderRuntimeDiagnosticsSnapshot = {
  qa_marker: typeof GROWTH_PROVIDER_RUNTIME_DIAGNOSTICS_QA_MARKER
  runtime: {
    node_env: string | null
    vercel_env: string | null
    vercel_url: string | null
    vercel_region: string | null
  }
  keys: {
    ZEROBOUNCE_API_KEY: GrowthProviderRuntimeKeyStatus
    GROWTH_ZEROBOUNCE_API_KEY: GrowthProviderRuntimeKeyStatus
    PEOPLE_DATA_LABS_API_KEY: GrowthProviderRuntimeKeyStatus
    PDL_API_KEY: GrowthProviderRuntimeKeyStatus
  }
  loaders: {
    isZeroBounceConfigured: boolean
    isPdlApiConfigured: boolean
    zerobounce_winning_key: "ZEROBOUNCE_API_KEY" | "GROWTH_ZEROBOUNCE_API_KEY" | null
    pdl_winning_key: "PEOPLE_DATA_LABS_API_KEY" | "PDL_API_KEY" | null
    email_verification_disabled: boolean
    fixture_enabled: boolean
    pdl_discovery_disabled: boolean
    /** Env default from PDL_USE_SANDBOX (not per-request override). */
    pdl_sandbox_enabled: boolean
    pdl_sandbox_env_raw: string | null
    pdl_sandbox_env_explicit: boolean
    pdl_contact_discovery_enabled: boolean
    isPdlProviderConfigured: boolean
  }
  production_safe: boolean
}

function keyStatus(env: NodeJS.ProcessEnv, name: string): GrowthProviderRuntimeKeyStatus {
  const raw = env[name]
  const shape = classifyProviderEnvValueShape(raw)
  const present = shape === "present"
  const length = present ? String(raw).trim().length : 0
  return {
    present,
    length,
    masked: maskProviderEnvValue(raw),
    shape,
  }
}

export function buildGrowthProviderRuntimeDiagnosticsSnapshot(
  env: NodeJS.ProcessEnv = process.env,
): GrowthProviderRuntimeDiagnosticsSnapshot {
  const zbPrimary = keyStatus(env, "ZEROBOUNCE_API_KEY")
  const zbAlias = keyStatus(env, "GROWTH_ZEROBOUNCE_API_KEY")
  const pdlPrimary = keyStatus(env, "PEOPLE_DATA_LABS_API_KEY")
  const pdlAlias = keyStatus(env, "PDL_API_KEY")

  const zerobounce_winning_key = zbPrimary.present
    ? "ZEROBOUNCE_API_KEY"
    : zbAlias.present
      ? "GROWTH_ZEROBOUNCE_API_KEY"
      : null
  const pdl_winning_key = pdlPrimary.present
    ? "PEOPLE_DATA_LABS_API_KEY"
    : pdlAlias.present
      ? "PDL_API_KEY"
      : null

  const isZeroBounce = isZeroBounceConfigured()
  const isPdl = isPdlApiConfigured()
  const fixture_enabled = isEmailVerificationFixtureEnabled()
  const email_verification_disabled = isEmailVerificationDisabled()
  const pdlSandboxEnv = resolvePdlSandboxEnvConfig(env)

  return {
    qa_marker: GROWTH_PROVIDER_RUNTIME_DIAGNOSTICS_QA_MARKER,
    runtime: {
      node_env: env.NODE_ENV?.trim() || null,
      vercel_env: env.VERCEL_ENV?.trim() || null,
      vercel_url: env.VERCEL_URL?.trim() || null,
      vercel_region: env.VERCEL_REGION?.trim() || null,
    },
    keys: {
      ZEROBOUNCE_API_KEY: zbPrimary,
      GROWTH_ZEROBOUNCE_API_KEY: zbAlias,
      PEOPLE_DATA_LABS_API_KEY: pdlPrimary,
      PDL_API_KEY: pdlAlias,
    },
    loaders: {
      isZeroBounceConfigured: isZeroBounce,
      isPdlApiConfigured: isPdl,
      zerobounce_winning_key,
      pdl_winning_key,
      email_verification_disabled,
      fixture_enabled,
      pdl_discovery_disabled: isPdlDiscoveryDisabled(),
      pdl_sandbox_enabled: pdlSandboxEnv.env_sandbox_enabled,
      pdl_sandbox_env_raw: pdlSandboxEnv.env_raw,
      pdl_sandbox_env_explicit: pdlSandboxEnv.env_explicit,
      pdl_contact_discovery_enabled: isPdlContactDiscoveryEnabled(env),
      isPdlProviderConfigured: isPdlProviderConfigured(env),
    },
    production_safe:
      isZeroBounce &&
      !email_verification_disabled &&
      (!env.VERCEL_ENV || env.VERCEL_ENV !== "production" || !fixture_enabled),
  }
}

/** Local-only loader check after optional bootstrap — never logs secrets. */
export function buildLocalProviderLoaderStatus(env: NodeJS.ProcessEnv = process.env) {
  const zb = getZeroBounceApiKey()
  const pdl = getPdlApiKey()
  return {
    isZeroBounceConfigured: isZeroBounceConfigured(),
    isPdlApiConfigured: isPdlApiConfigured(),
    zerobounce_masked: zb ? `present(len=${zb.length})` : "(missing)",
    pdl_masked: pdl ? `present(len=${pdl.length})` : "(missing)",
    fixture_enabled: isEmailVerificationFixtureEnabled(),
    verification_disabled: isEmailVerificationDisabled(),
  }
}
