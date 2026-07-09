/** GE-AIOS-17B — Schema readiness probe for server organizational memory. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  GROWTH_ORGANIZATION_MEMORY_EVENTS_TABLE,
  GROWTH_ORGANIZATION_MEMORY_PREFERENCES_TABLE,
} from "@/lib/growth/memory/storage/organization-memory-types"

export async function isOrganizationMemorySchemaReady(admin: SupabaseClient): Promise<boolean> {
  try {
    const { error: eventsError } = await admin
      .schema("growth")
      .from(GROWTH_ORGANIZATION_MEMORY_EVENTS_TABLE)
      .select("memory_event_id")
      .limit(1)
    if (eventsError) return false

    const { error: preferencesError } = await admin
      .schema("growth")
      .from(GROWTH_ORGANIZATION_MEMORY_PREFERENCES_TABLE)
      .select("preference_id")
      .limit(1)
    return !preferencesError
  } catch {
    return false
  }
}
