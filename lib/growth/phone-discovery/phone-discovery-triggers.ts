import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  enqueuePhoneDiscoveryJob,
  queuePhoneDiscoveryForCompanyRoles,
} from "@/lib/growth/phone-discovery/phone-discovery-queue"

/** Trigger 2 — after canonical person + role persisted; non-blocking. */
export async function triggerPhoneDiscoveryAfterPersonPersist(
  admin: SupabaseClient,
  input: {
    company_id: string | null | undefined
    person_id: string
    created_by?: string | null
  },
): Promise<void> {
  const company_id = typeof input.company_id === "string" ? input.company_id.trim() : ""
  const person_id = input.person_id.trim()
  if (!company_id || !person_id) return

  try {
    await enqueuePhoneDiscoveryJob(admin, {
      company_id,
      person_id,
      trigger_source: "person_created",
      created_by: input.created_by ?? null,
    })
  } catch {
    /* ingestion must not fail on queue errors */
  }
}

/** Trigger 3 — after company enrichment; capped batch per company. */
export async function triggerPhoneDiscoveryAfterCompanyEnriched(
  admin: SupabaseClient,
  input: { company_id: string; created_by?: string | null },
): Promise<void> {
  const company_id = input.company_id.trim()
  if (!company_id) return

  try {
    await queuePhoneDiscoveryForCompanyRoles(admin, {
      company_id,
      trigger_source: "company_enriched",
      created_by: input.created_by ?? null,
    })
  } catch {
    /* enrichment path must not fail on queue errors */
  }
}
