import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  GROWTH_PHONE_DISCOVERY_STALE_RUNNING_ERROR,
  GROWTH_PHONE_DISCOVERY_STALE_RUNNING_MS,
} from "@/lib/growth/phone-discovery/phone-discovery-discovery-status"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

export type RecoverStalePhoneDiscoveryJobsInput = {
  company_id?: string
  person_id?: string
  stale_after_ms?: number
}

/**
 * Mark stale `running` jobs as `failed` so the active-pair unique index cannot deadlock.
 */
export async function recoverStalePhoneDiscoveryRunningJobs(
  admin: SupabaseClient,
  input: RecoverStalePhoneDiscoveryJobsInput = {},
): Promise<{ recovered: number }> {
  const stale_after_ms = input.stale_after_ms ?? GROWTH_PHONE_DISCOVERY_STALE_RUNNING_MS
  const cutoff = new Date(Date.now() - stale_after_ms).toISOString()
  const company_id = asString(input.company_id)
  const person_id = asString(input.person_id)

  let query = admin
    .schema("growth")
    .from("phone_discovery_jobs")
    .select("id")
    .eq("status", "running")
    .or(`started_at.lt.${cutoff},and(started_at.is.null,updated_at.lt.${cutoff})`)

  if (company_id) query = query.eq("company_id", company_id)
  if (person_id) query = query.eq("person_id", person_id)

  const { data: rows } = await query.limit(100)

  let recovered = 0
  const completed_at = new Date().toISOString()
  const last_error = GROWTH_PHONE_DISCOVERY_STALE_RUNNING_ERROR

  for (const row of rows ?? []) {
    const id = asString((row as { id: string }).id)
    if (!id) continue

    const { data: updated } = await admin
      .schema("growth")
      .from("phone_discovery_jobs")
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
