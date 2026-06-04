import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { enqueueCompanyIntelligenceJob } from "@/lib/growth/company-intelligence/company-intelligence-queue"

/** Trigger — after canonical company enrichment; non-blocking. */
export async function triggerCompanyIntelligenceAfterCompanyEnriched(
  admin: SupabaseClient,
  input: { company_id: string; created_by?: string | null },
): Promise<void> {
  const company_id = input.company_id.trim()
  if (!company_id) return

  try {
    await enqueueCompanyIntelligenceJob(admin, {
      company_id,
      trigger_source: "company_enriched",
      created_by: input.created_by ?? null,
      promote_on_complete: true,
    })
  } catch {
    /* enrichment path must not fail on queue errors */
  }
}
