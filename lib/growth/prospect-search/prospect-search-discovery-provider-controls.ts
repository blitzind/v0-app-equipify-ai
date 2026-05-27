/** Runtime enable/disable for external discovery providers (no secrets). */

export type GrowthDiscoveryProviderControlName = "google_places" | "serp"

const runtimeDisabled = new Set<GrowthDiscoveryProviderControlName>()

function envDisabled(name: GrowthDiscoveryProviderControlName): boolean {
  if (name === "google_places") {
    return process.env.GROWTH_DISCOVERY_DISABLE_GOOGLE_PLACES === "1"
  }
  return process.env.GROWTH_DISCOVERY_DISABLE_SERP === "1"
}

export function isDiscoveryProviderRuntimeEnabled(name: GrowthDiscoveryProviderControlName): boolean {
  if (envDisabled(name)) return false
  return !runtimeDisabled.has(name)
}

export function setDiscoveryProviderRuntimeEnabled(
  name: GrowthDiscoveryProviderControlName,
  enabled: boolean,
): void {
  if (enabled) runtimeDisabled.delete(name)
  else runtimeDisabled.add(name)
}

export function listDiscoveryProviderRuntimeControls(): Array<{
  provider_name: GrowthDiscoveryProviderControlName
  enabled: boolean
  env_disabled: boolean
}> {
  return (["google_places", "serp"] as const).map((provider_name) => ({
    provider_name,
    enabled: isDiscoveryProviderRuntimeEnabled(provider_name),
    env_disabled: envDisabled(provider_name),
  }))
}

export function resetDiscoveryProviderRuntimeControls(): void {
  runtimeDisabled.clear()
}
