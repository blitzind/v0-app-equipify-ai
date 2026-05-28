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

/** Default to sandbox for safe no-credit testing unless explicitly disabled. */
export function isPdlSandboxEnabled(): boolean {
  const raw = process.env.PDL_USE_SANDBOX?.trim().toLowerCase()
  if (raw === "0" || raw === "false") return false
  if (raw === "1" || raw === "true") return true
  return true
}

export function resolvePdlPersonSearchBaseUrl(): string {
  return isPdlSandboxEnabled()
    ? "https://sandbox.api.peopledatalabs.com/v5/person/search"
    : "https://api.peopledatalabs.com/v5/person/search"
}
