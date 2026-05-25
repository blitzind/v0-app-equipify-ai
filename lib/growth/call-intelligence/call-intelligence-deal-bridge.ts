import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { CallIntelligenceScorecardPublicView } from "@/lib/growth/call-intelligence/call-intelligence-types"
import { recomputeDealIntelligenceScore } from "@/lib/growth/deal-intelligence/deal-intelligence-service"

export async function triggerDealIntelligenceFromCallScorecard(
  admin: SupabaseClient,
  input: {
    leadId: string
    opportunityId: string | null
    scorecard: CallIntelligenceScorecardPublicView
  },
): Promise<void> {
  if (input.scorecard.metrics.incomplete) return
  await recomputeDealIntelligenceScore({
    admin,
    leadId: input.leadId,
    opportunityId: input.opportunityId,
  })
}
