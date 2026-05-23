import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  computeGrowthLeadCallCountsFromRows,
  type GrowthLeadCallCountCache,
} from "@/lib/growth/communication/call-counts"

export type { GrowthLeadCallCountCache } from "@/lib/growth/communication/call-counts"
export { computeGrowthLeadCallCountsFromRows } from "@/lib/growth/communication/call-counts"

export async function recomputeGrowthLeadCallCounts(
  admin: SupabaseClient,
  leadId: string,
): Promise<GrowthLeadCallCountCache> {
  const { data, error } = await admin
    .schema("growth")
    .from("lead_call_events")
    .select("disposition")
    .eq("lead_id", leadId)

  if (error) {
    throw new Error(error.message)
  }

  const counts = computeGrowthLeadCallCountsFromRows((data ?? []) as Array<{ disposition: string }>)

  const { error: updateError } = await admin
    .schema("growth")
    .from("leads")
    .update({
      call_attempt_count: counts.callAttemptCount,
      voicemail_count: counts.voicemailCount,
      connected_call_count: counts.connectedCallCount,
    })
    .eq("id", leadId)

  if (updateError) {
    throw new Error(updateError.message)
  }

  return counts
}
