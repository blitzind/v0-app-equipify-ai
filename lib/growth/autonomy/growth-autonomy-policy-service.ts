import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type {
  GrowthAutonomyCapability,
  GrowthAutonomyPolicyResult,
  GrowthAutonomyPrepareCapability,
  GrowthAutonomyPrepareContext,
  GrowthAutonomyTriggerSource,
} from "@/lib/growth/autonomy/growth-autonomy-types"
import { evaluateAutonomyCapabilityFromPolicyEngine } from "@/lib/growth/autonomy/growth-ai-os-autonomy-policy-evaluation-service"

type EvaluateInput = {
  organizationId: string
  capability: GrowthAutonomyCapability | GrowthAutonomyPrepareCapability
  triggerSource?: GrowthAutonomyTriggerSource
  enforcementRequested?: boolean
  prepareContext?: GrowthAutonomyPrepareContext
}

/**
 * Compatibility wrapper — delegates to Autonomy Policy Engine (GE-AIOS-CONSOLIDATION-1E).
 * GE-AUTO-1E: channel prepare allowed when configured; outbound send via evaluateAutonomyOutboundSendPolicy.
 */
export async function evaluateAutonomyCapability(
  admin: SupabaseClient,
  input: EvaluateInput,
): Promise<GrowthAutonomyPolicyResult> {
  return evaluateAutonomyCapabilityFromPolicyEngine(admin, input)
}

export const GrowthAutonomyPolicyService = {
  evaluateAutonomyCapability,
} as const
