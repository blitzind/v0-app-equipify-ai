import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  GROWTH_BUYING_COMMITTEE_INTELLIGENCE_STALE_RUNNING_ERROR,
  GROWTH_BUYING_COMMITTEE_INTELLIGENCE_STALE_RUNNING_MS,
} from "@/lib/growth/buying-committee-intelligence/buying-committee-intelligence-discovery-status"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

export async function recoverStaleBuyingCommitteeIntelligenceRunningJobs(
  admin: SupabaseClient,
  input: { company_id?: string; stale_after_ms?: number } = {},
): Promise<{ recovered: number }> {
  const stale_after_ms = input.stale_after_ms ?? GROWTH_BUYING_COMMITTEE_INTELLIGENCE_STALE_RUNNING_MS
  const cutoff = new Date(Date.now() - stale_after_ms).toISOString()
  const company_id = asString(input.company_id)

  let query = admin
    .schema("growth")
    .from("buying_committee_jobs")
    .select("id")
    .eq("status", "running")
    .or(`started_at.lt.${cutoff},and(started_at.is.null,updated_at.lt.${cutoff})`)

  if (company_id) query = query.eq("company_id", company_id)

  const { data: rows } = await query.limit(100)

  let recovered = 0
  const completed_at = new Date().toISOString()
  const last_error = GROWTH_BUYING_COMMITTEE_INTELLIGENCE_STALE_RUNNING_ERROR

  for (const row of rows ?? []) {
    const id = asString((row as { id: string }).id)
    if (!id) continue

    const { data: updated } = await admin
      .schema("growth")
      .from("buying_committee_jobs")
      .update({ status: "failed", completed_at, last_error })
      .eq("id", id)
      .eq("status", "running")
      .select("id")

    if (updated?.length) recovered += 1
  }

  return { recovered }
}
