import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

export type AiOperationRateKey =
  | "follow_up_regenerate_draft"
  | "follow_up_evaluate"
  | "operational_insights_refresh"
  | "service_insights_generation"
  | "queued_ai_job"

function maxPerMinute(key: AiOperationRateKey): number {
  const envMap: Partial<Record<AiOperationRateKey, string>> = {
    follow_up_regenerate_draft: process.env.AI_RATE_REGENERATE_DRAFT_PER_MIN,
    follow_up_evaluate: process.env.AI_RATE_FOLLOW_UP_EVAL_PER_MIN,
    operational_insights_refresh: process.env.AI_RATE_INSIGHTS_REFRESH_PER_MIN,
    service_insights_generation: process.env.AI_RATE_SERVICE_INSIGHTS_PER_MIN,
    queued_ai_job: process.env.AI_RATE_QUEUED_JOB_PER_MIN,
  }
  const raw = envMap[key]?.trim()
  const n = raw ? Number.parseInt(raw, 10) : NaN
  const fallback =
    key === "follow_up_evaluate"
      ? 12
      : key === "queued_ai_job"
        ? 30
        : key === "operational_insights_refresh"
          ? 20
          : 24
  return Number.isFinite(n) && n > 0 ? Math.min(n, 600) : fallback
}

function minuteFloor(): number {
  return Math.floor(Date.now() / 60_000)
}

/**
 * Fixed-window per-minute counter (org + logical operation). Uses `ai_operation_rate_buckets`.
 * Returns whether this request may proceed; increments only when allowed.
 */
export async function tryConsumeAiOperationSlot(
  admin: SupabaseClient,
  organizationId: string,
  operationKey: AiOperationRateKey,
): Promise<{ allowed: boolean; remainingApprox: number }> {
  const oid = organizationId.trim()
  if (!oid) return { allowed: false, remainingApprox: 0 }

  const max = maxPerMinute(operationKey)
  const bucket = minuteFloor()

  try {
    const { data: row } = await admin
      .from("ai_operation_rate_buckets")
      .select("request_count")
      .eq("organization_id", oid)
      .eq("operation_key", operationKey)
      .eq("minute_bucket", bucket)
      .maybeSingle()

    const current =
      row && typeof (row as { request_count?: number }).request_count === "number"
        ? (row as { request_count: number }).request_count
        : 0

    if (current >= max) {
      return { allowed: false, remainingApprox: 0 }
    }

    const next = current + 1
    const now = new Date().toISOString()

    if (!row) {
      const { error } = await admin.from("ai_operation_rate_buckets").insert({
        organization_id: oid,
        operation_key: operationKey,
        minute_bucket: bucket,
        request_count: 1,
        updated_at: now,
      })
      if (error?.code === "23505") {
        const { data: raced } = await admin
          .from("ai_operation_rate_buckets")
          .select("request_count")
          .eq("organization_id", oid)
          .eq("operation_key", operationKey)
          .eq("minute_bucket", bucket)
          .maybeSingle()
        const rc =
          raced && typeof (raced as { request_count?: number }).request_count === "number"
            ? (raced as { request_count: number }).request_count
            : 0
        if (rc >= max) return { allowed: false, remainingApprox: 0 }
        await admin
          .from("ai_operation_rate_buckets")
          .update({ request_count: rc + 1, updated_at: now })
          .eq("organization_id", oid)
          .eq("operation_key", operationKey)
          .eq("minute_bucket", bucket)
        return { allowed: true, remainingApprox: Math.max(0, max - rc - 1) }
      }
    } else {
      await admin
        .from("ai_operation_rate_buckets")
        .update({ request_count: next, updated_at: now })
        .eq("organization_id", oid)
        .eq("operation_key", operationKey)
        .eq("minute_bucket", bucket)
    }

    return { allowed: true, remainingApprox: Math.max(0, max - next) }
  } catch {
    return { allowed: true, remainingApprox: max }
  }
}
