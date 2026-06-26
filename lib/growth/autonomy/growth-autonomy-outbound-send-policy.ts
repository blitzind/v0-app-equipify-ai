/** GE-AUTO-1E — Confidence-gated autonomous outbound send policy (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  evaluateAutonomyOutboundSendPolicyFromPolicyEngine,
  GROWTH_AUTONOMY_OUTBOUND_SEND_QA_MARKER,
  type GrowthAutonomyOutboundSendEvaluation,
} from "@/lib/growth/autonomy/growth-ai-os-autonomy-policy-evaluation-service"
import type {
  GrowthAutonomyChannelKey,
  GrowthAutonomySendContext,
  GrowthAutonomyTriggerSource,
} from "@/lib/growth/autonomy/growth-autonomy-types"

export { GROWTH_AUTONOMY_OUTBOUND_SEND_QA_MARKER }
export type { GrowthAutonomyOutboundSendEvaluation }

/** Compatibility wrapper — delegates to Autonomy Policy Engine (GE-AIOS-CONSOLIDATION-1E). */
export async function evaluateAutonomyOutboundSendPolicy(
  admin: SupabaseClient,
  input: {
    organizationId: string
    channel: GrowthAutonomyChannelKey
    sendContext: GrowthAutonomySendContext
    triggerSource?: GrowthAutonomyTriggerSource
  },
): Promise<GrowthAutonomyOutboundSendEvaluation> {
  return evaluateAutonomyOutboundSendPolicyFromPolicyEngine(admin, input)
}
