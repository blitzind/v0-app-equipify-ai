import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  enqueueSocialProfileDiscoveryJob,
  queueSocialProfileDiscoveryForCompanyRoles,
} from "@/lib/growth/social-profile-discovery/social-profile-discovery-queue"

/** Trigger — after canonical person + role persisted; non-blocking. */
export async function triggerSocialProfileDiscoveryAfterPersonPersist(
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
    await enqueueSocialProfileDiscoveryJob(admin, {
      company_id,
      person_id,
      discovery_scope: "person",
      trigger_source: "person_created",
      created_by: input.created_by ?? null,
    })
  } catch {
    /* ingestion must not fail on queue errors */
  }
}

/** Trigger — after company enrichment; person jobs capped + optional company-scoped job. */
export async function triggerSocialProfileDiscoveryAfterCompanyEnriched(
  admin: SupabaseClient,
  input: { company_id: string; created_by?: string | null },
): Promise<void> {
  const company_id = input.company_id.trim()
  if (!company_id) return

  try {
    await queueSocialProfileDiscoveryForCompanyRoles(admin, {
      company_id,
      trigger_source: "company_enriched",
      created_by: input.created_by ?? null,
    })
    await enqueueSocialProfileDiscoveryJob(admin, {
      company_id,
      discovery_scope: "company",
      trigger_source: "company_enriched",
      created_by: input.created_by ?? null,
      skip_if_active_job: true,
    })
  } catch {
    /* enrichment path must not fail on queue errors */
  }
}
