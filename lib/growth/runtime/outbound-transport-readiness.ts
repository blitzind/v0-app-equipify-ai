import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { resolveSequenceExecutionSender } from "@/lib/growth/sequences/execution/sequence-send-builder"

/** True when at least one enabled delivery route or connected sender can execute transport sends. */
export async function isGrowthOutboundTransportConfigured(
  admin: SupabaseClient,
): Promise<boolean> {
  const sender = await resolveSequenceExecutionSender(admin).catch(() => null)
  return sender !== null
}
