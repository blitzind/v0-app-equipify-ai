import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { enqueueBuyingCommitteeIntelligenceJob } from "@/lib/growth/buying-committee-intelligence/buying-committee-intelligence-queue"

/** Trigger — after company intelligence job completes; non-blocking. */
export async function triggerBuyingCommitteeIntelligenceAfterCompanyIntelligence(
  admin: SupabaseClient,
  input: { company_id: string; created_by?: string | null },
): Promise<void> {
  const company_id = input.company_id.trim()
  if (!company_id) return

  try {
    await enqueueBuyingCommitteeIntelligenceJob(admin, {
      company_id,
      trigger_source: "company_intelligence_completed",
      created_by: input.created_by ?? null,
      promote_on_complete: true,
    })
  } catch {
    /* company intelligence completion path must not fail on queue errors */
  }
}
