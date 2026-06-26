/** GE-AIOS-2J — Context Assembly health monitor (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { fetchAiContextAssemblyRuntime } from "@/lib/growth/aios/ai-context-assembly-repository"
import { isGrowthAiContextAssemblySchemaReady } from "@/lib/growth/aios/ai-context-assembly-schema-health"

export type AiContextAssemblyHealthReport = {
  organizationId: string
  evaluatedAt: string
  schemaReady: boolean
  assemblyCount: number
  reuseCount: number
  validationFailureCount: number
  reuseRate: number
  validationFailureRate: number
  ready: boolean
}

export async function evaluateAiContextAssemblyHealth(
  admin: SupabaseClient,
  input: { organizationId: string },
): Promise<AiContextAssemblyHealthReport> {
  const schemaReady = await isGrowthAiContextAssemblySchemaReady(admin)
  const runtime = await fetchAiContextAssemblyRuntime(admin, { organizationId: input.organizationId })
  const assemblyCount = runtime?.assemblyCount ?? 0
  const reuseCount = runtime?.reuseCount ?? 0
  const validationFailureCount = runtime?.validationFailureCount ?? 0
  const totalAttempts = assemblyCount + reuseCount + validationFailureCount
  const reuseRate = totalAttempts > 0 ? reuseCount / totalAttempts : 0
  const validationFailureRate = totalAttempts > 0 ? validationFailureCount / totalAttempts : 0

  return {
    organizationId: input.organizationId,
    evaluatedAt: new Date().toISOString(),
    schemaReady,
    assemblyCount,
    reuseCount,
    validationFailureCount,
    reuseRate,
    validationFailureRate,
    ready: schemaReady && Boolean(runtime),
  }
}
