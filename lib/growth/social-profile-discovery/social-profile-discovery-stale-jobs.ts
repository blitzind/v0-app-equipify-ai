import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  GROWTH_SOCIAL_PROFILE_DISCOVERY_STALE_RUNNING_ERROR,
  GROWTH_SOCIAL_PROFILE_DISCOVERY_STALE_RUNNING_MS,
} from "@/lib/growth/social-profile-discovery/social-profile-discovery-discovery-status"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

export type RecoverStaleSocialProfileDiscoveryJobsInput = {
  company_id?: string
  person_id?: string | null
  discovery_scope?: "person" | "company"
  stale_after_ms?: number
}

export async function recoverStaleSocialProfileDiscoveryRunningJobs(
  admin: SupabaseClient,
  input: RecoverStaleSocialProfileDiscoveryJobsInput = {},
): Promise<{ recovered: number }> {
  const stale_after_ms = input.stale_after_ms ?? GROWTH_SOCIAL_PROFILE_DISCOVERY_STALE_RUNNING_MS
  const cutoff = new Date(Date.now() - stale_after_ms).toISOString()
  const company_id = asString(input.company_id)
  const person_id = input.person_id === null ? null : asString(input.person_id)

  let query = admin
    .schema("growth")
    .from("social_profile_discovery_jobs")
    .select("id")
    .eq("status", "running")
    .or(`started_at.lt.${cutoff},and(started_at.is.null,updated_at.lt.${cutoff})`)

  if (company_id) query = query.eq("company_id", company_id)
  if (person_id) query = query.eq("person_id", person_id)
  if (input.discovery_scope) query = query.eq("discovery_scope", input.discovery_scope)

  const { data: rows } = await query.limit(100)

  let recovered = 0
  const completed_at = new Date().toISOString()
  const last_error = GROWTH_SOCIAL_PROFILE_DISCOVERY_STALE_RUNNING_ERROR

  for (const row of rows ?? []) {
    const id = asString((row as { id: string }).id)
    if (!id) continue

    const { data: updated } = await admin
      .schema("growth")
      .from("social_profile_discovery_jobs")
      .update({
        status: "failed",
        completed_at,
        last_error,
      })
      .eq("id", id)
      .eq("status", "running")
      .select("id")

    if (updated?.length) recovered += 1
  }

  return { recovered }
}
