/** GE-AIOS-2H — Decision Engine health monitor (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { fetchAiDecisionEngineRuntime } from "@/lib/growth/aios/ai-decision-engine-repository"

export type AiDecisionEngineHealthReport = {
  organizationId: string
  evaluatedAt: string
  degraded: boolean
  degradedReason: string | null
  evaluationCount: number
  insufficientEvidenceCount: number
  insufficientRate: number
  ready: boolean
}

export async function evaluateAiDecisionEngineHealth(
  admin: SupabaseClient,
  input: { organizationId: string },
): Promise<AiDecisionEngineHealthReport> {
  const runtime = await fetchAiDecisionEngineRuntime(admin, { organizationId: input.organizationId })
  const evaluationCount = runtime?.evaluationCount ?? 0
  const insufficientEvidenceCount = runtime?.insufficientEvidenceCount ?? 0
  const insufficientRate = evaluationCount > 0 ? insufficientEvidenceCount / evaluationCount : 0

  return {
    organizationId: input.organizationId,
    evaluatedAt: new Date().toISOString(),
    degraded: runtime?.degraded ?? false,
    degradedReason: runtime?.degradedReason ?? null,
    evaluationCount,
    insufficientEvidenceCount,
    insufficientRate,
    ready: Boolean(runtime) && !(runtime?.degraded ?? false),
  }
}
