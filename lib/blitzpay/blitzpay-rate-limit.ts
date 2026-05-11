import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

function minuteFloor(): number {
  return Math.floor(Date.now() / 60_000)
}

function parsePositiveInt(raw: string | undefined, fallback: number, cap = 600): number {
  const n = raw?.trim() ? Number.parseInt(raw.trim(), 10) : NaN
  if (!Number.isFinite(n) || n <= 0) return fallback
  return Math.min(n, cap)
}

async function tryConsumeOneBucket(
  admin: SupabaseClient,
  organizationId: string,
  operationKey: string,
  maxPerMinute: number,
): Promise<boolean> {
  const oid = organizationId.trim()
  if (!oid) return false
  const bucket = minuteFloor()
  const now = new Date().toISOString()

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

    if (current >= maxPerMinute) return false

    const next = current + 1

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
        if (rc >= maxPerMinute) return false
        await admin
          .from("ai_operation_rate_buckets")
          .update({ request_count: rc + 1, updated_at: now })
          .eq("organization_id", oid)
          .eq("operation_key", operationKey)
          .eq("minute_bucket", bucket)
      }
    } else {
      await admin
        .from("ai_operation_rate_buckets")
        .update({ request_count: next, updated_at: now })
        .eq("organization_id", oid)
        .eq("operation_key", operationKey)
        .eq("minute_bucket", bucket)
    }

    return true
  } catch {
    return true
  }
}

/**
 * Lightweight BlitzPay prepare-pay throttles (reuses ai_operation_rate_buckets; service role only).
 */
export async function tryConsumeBlitzpayPreparePaySlots(
  admin: SupabaseClient,
  ctx: { organizationId: string; invoiceId: string; userId: string },
): Promise<{ ok: true } | { ok: false; reason: "org" | "invoice" | "user" }> {
  const orgMax = parsePositiveInt(process.env.BLITZPAY_RATE_PREPARE_PER_ORG_PER_MIN, 20)
  const invMax = parsePositiveInt(process.env.BLITZPAY_RATE_PREPARE_PER_INVOICE_PER_MIN, 8)
  const userMax = parsePositiveInt(process.env.BLITZPAY_RATE_PREPARE_PER_USER_PER_MIN, 10)

  const orgOk = await tryConsumeOneBucket(admin, ctx.organizationId, "blitzpay_prepare_pay:org", orgMax)
  if (!orgOk) return { ok: false, reason: "org" }

  const invOk = await tryConsumeOneBucket(
    admin,
    ctx.organizationId,
    `blitzpay_prepare_pay:inv:${ctx.invoiceId}`,
    invMax,
  )
  if (!invOk) return { ok: false, reason: "invoice" }

  const userOk = await tryConsumeOneBucket(
    admin,
    ctx.organizationId,
    `blitzpay_prepare_pay:user:${ctx.userId}`,
    userMax,
  )
  if (!userOk) return { ok: false, reason: "user" }

  return { ok: true }
}

export async function tryConsumeBlitzpayPreparePaySlotsQuote(
  admin: SupabaseClient,
  ctx: { organizationId: string; quoteId: string; userId: string },
): Promise<{ ok: true } | { ok: false; reason: "org" | "invoice" | "user" }> {
  const orgMax = parsePositiveInt(process.env.BLITZPAY_RATE_PREPARE_PER_ORG_PER_MIN, 20)
  const quoteMax = parsePositiveInt(process.env.BLITZPAY_RATE_PREPARE_PER_INVOICE_PER_MIN, 8)
  const userMax = parsePositiveInt(process.env.BLITZPAY_RATE_PREPARE_PER_USER_PER_MIN, 10)

  const orgOk = await tryConsumeOneBucket(admin, ctx.organizationId, "blitzpay_prepare_pay:org", orgMax)
  if (!orgOk) return { ok: false, reason: "org" }

  const quoteOk = await tryConsumeOneBucket(
    admin,
    ctx.organizationId,
    `blitzpay_prepare_pay:quote:${ctx.quoteId}`,
    quoteMax,
  )
  if (!quoteOk) return { ok: false, reason: "invoice" }

  const userOk = await tryConsumeOneBucket(
    admin,
    ctx.organizationId,
    `blitzpay_prepare_pay:user:${ctx.userId}`,
    userMax,
  )
  if (!userOk) return { ok: false, reason: "user" }

  return { ok: true }
}
