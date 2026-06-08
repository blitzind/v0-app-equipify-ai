/** PDL provider configuration — client-safe env resolution. */

export function getPdlApiKey(): string | null {
  return (
    process.env.PEOPLE_DATA_LABS_API_KEY?.trim() ||
    process.env.PDL_API_KEY?.trim() ||
    null
  )
}

export function isPdlApiConfigured(): boolean {
  return Boolean(getPdlApiKey())
}

export function isPdlDiscoveryDisabled(): boolean {
  return process.env.GROWTH_DISCOVERY_DISABLE_PDL === "1"
}

export type PdlSandboxEnvConfig = {
  /** Raw PDL_USE_SANDBOX env value, if set. */
  env_raw: string | null
  /** True when PDL_USE_SANDBOX was explicitly set (not falling back to default). */
  env_explicit: boolean
  /** Env-driven default sandbox mode (true when unset or enabled). */
  env_sandbox_enabled: boolean
}

/** Resolve PDL_USE_SANDBOX — GROWTH_PDL_USE_SANDBOX is not used in this codebase. */
export function resolvePdlSandboxEnvConfig(
  env: NodeJS.ProcessEnv = process.env,
): PdlSandboxEnvConfig {
  const raw = env.PDL_USE_SANDBOX?.trim() ?? null
  if (!raw) {
    return { env_raw: null, env_explicit: false, env_sandbox_enabled: true }
  }
  const lower = raw.toLowerCase()
  if (lower === "0" || lower === "false") {
    return { env_raw: raw, env_explicit: true, env_sandbox_enabled: false }
  }
  if (lower === "1" || lower === "true") {
    return { env_raw: raw, env_explicit: true, env_sandbox_enabled: true }
  }
  return { env_raw: raw, env_explicit: true, env_sandbox_enabled: true }
}

/** Default to sandbox for safe no-credit testing unless explicitly disabled. */
export function isPdlSandboxEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return resolvePdlSandboxEnvConfig(env).env_sandbox_enabled
}

export function resolvePdlPersonSearchBaseUrl(sandbox = isPdlSandboxEnabled()): string {
  return sandbox
    ? "https://sandbox.api.peopledatalabs.com/v5/person/search"
    : "https://api.peopledatalabs.com/v5/person/search"
}
