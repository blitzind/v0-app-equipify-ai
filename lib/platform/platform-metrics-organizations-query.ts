import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { PLATFORM_METRICS_INCLUDED_ORG_EQ } from "@/lib/platform/platform-metrics-organizations"

/** Organization ids included in platform/business metrics rollups. */
export async function fetchPlatformMetricsOrganizationIds(admin: SupabaseClient): Promise<string[]> {
  const { data, error } = await admin
    .from("organizations")
    .select("id")
    .eq("exclude_from_platform_metrics", PLATFORM_METRICS_INCLUDED_ORG_EQ)

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []).map((row) => String((row as { id: string }).id)).filter(Boolean)
}

export async function fetchPlatformMetricsOrganizationIdSet(admin: SupabaseClient): Promise<Set<string>> {
  return new Set(await fetchPlatformMetricsOrganizationIds(admin))
}
