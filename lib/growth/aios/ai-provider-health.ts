/** GE-AIOS-3A — Provider health service (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { isProviderAvailable } from "@/lib/ai/providers"
import { fetchAiProviderRuntime } from "@/lib/growth/aios/ai-provider-repository"
import { listAiOsProviderRegistryEntries } from "@/lib/growth/aios/ai-provider-registry"
import { isGrowthAiProviderSchemaReady } from "@/lib/growth/aios/ai-provider-schema-health"
import type { AiOsProviderHealthStatus, AiOsProviderId } from "@/lib/growth/aios/ai-provider-types"

export type AiOsProviderHealthReport = {
  organizationId: string
  evaluatedAt: string
  schemaReady: boolean
  runtimeDegraded: boolean
  degradedReason: string | null
  activeProvider: AiOsProviderId | null
  providers: AiOsProviderHealthStatus[]
  ready: boolean
}

export async function evaluateAiOsProviderHealth(
  admin: SupabaseClient,
  input: { organizationId: string },
): Promise<AiOsProviderHealthReport> {
  const schemaReady = await isGrowthAiProviderSchemaReady(admin)
  const runtime = await fetchAiProviderRuntime(admin, { organizationId: input.organizationId })

  const providers: AiOsProviderHealthStatus[] = listAiOsProviderRegistryEntries().map((entry) => {
    const available = isProviderAvailable(entry.providerId)
    return {
      providerId: entry.providerId,
      available,
      degraded: !available,
      message: available ? null : `${entry.label} credentials unavailable`,
    }
  })

  const anyAvailable = providers.some((provider) => provider.available)

  return {
    organizationId: input.organizationId,
    evaluatedAt: new Date().toISOString(),
    schemaReady,
    runtimeDegraded: runtime?.degraded ?? false,
    degradedReason: runtime?.degradedReason ?? null,
    activeProvider: runtime?.activeProvider ?? null,
    providers,
    ready: schemaReady && anyAvailable && !(runtime?.degraded ?? false),
  }
}
