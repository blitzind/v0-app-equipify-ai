import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { applyDiscountToMrrCents, resolveListMrrCents } from "@/lib/billing/discount-pricing"

export type DiscountPersistPayload = {
  discount_type: string | null
  discount_value: number | null
  discount_label: string | null
  discount_reason: string | null
  discount_expires_at: string | null
}

/**
 * Validates and writes internal discount fields on organization_subscriptions (Stripe-agnostic).
 */
export async function persistOrganizationSubscriptionDiscount(
  admin: SupabaseClient,
  organizationId: string,
  payload: DiscountPersistPayload,
): Promise<{ ok: true } | { ok: false; status: number; code: string; message: string }> {
  const { data: sub, error: selErr } = await admin
    .from("organization_subscriptions")
    .select("plan_id, billing_cycle")
    .eq("organization_id", organizationId)
    .maybeSingle()

  if (selErr) {
    return { ok: false, status: 500, code: "query_failed", message: selErr.message }
  }
  if (!sub) {
    return {
      ok: false,
      status: 400,
      code: "no_subscription",
      message: "No subscription row for this organization.",
    }
  }

  const billing_cycle =
    sub.billing_cycle === "annual" || sub.billing_cycle === "monthly" ? sub.billing_cycle : "monthly"
  const baseCents = resolveListMrrCents(sub.plan_id, billing_cycle)

  const typeNorm =
    payload.discount_type == null || String(payload.discount_type).trim() === ""
      ? null
      : String(payload.discount_type).trim().toLowerCase()

  const now = new Date().toISOString()

  if (typeNorm == null || typeNorm === "none") {
    const { error: updErr } = await admin
      .from("organization_subscriptions")
      .update({
        discount_type: null,
        discount_value: null,
        discount_label: null,
        discount_reason: null,
        discount_expires_at: null,
        updated_at: now,
      })
      .eq("organization_id", organizationId)

    if (updErr) {
      return { ok: false, status: 400, code: "update_failed", message: updErr.message }
    }
    return { ok: true }
  }

  if (typeNorm !== "percent" && typeNorm !== "fixed") {
    return {
      ok: false,
      status: 400,
      code: "invalid_discount_type",
      message: "discount_type must be percent, fixed, or none.",
    }
  }

  const num =
    payload.discount_value == null
      ? NaN
      : typeof payload.discount_value === "number"
        ? payload.discount_value
        : parseFloat(String(payload.discount_value))

  if (!Number.isFinite(num)) {
    return {
      ok: false,
      status: 400,
      code: "invalid_value",
      message: "discount_value must be a number.",
    }
  }

  if (typeNorm === "percent") {
    if (num < 1 || num > 100) {
      return {
        ok: false,
        status: 400,
        code: "invalid_percent",
        message: "Percent discount must be between 1 and 100.",
      }
    }
  } else {
    if (num <= 0) {
      return {
        ok: false,
        status: 400,
        code: "invalid_fixed",
        message: "Fixed discount must be greater than 0 (cents).",
      }
    }
    if (num > baseCents) {
      return {
        ok: false,
        status: 400,
        code: "price_below_zero",
        message: "Fixed discount cannot exceed list price.",
      }
    }
  }

  let discount_expires_at: string | null = null
  if (payload.discount_expires_at != null && String(payload.discount_expires_at).trim() !== "") {
    const d = new Date(String(payload.discount_expires_at))
    if (Number.isNaN(d.getTime())) {
      return {
        ok: false,
        status: 400,
        code: "invalid_expiry",
        message: "discount_expires_at is not a valid date.",
      }
    }
    discount_expires_at = d.toISOString()
  }

  const label =
    payload.discount_label == null || String(payload.discount_label).trim() === ""
      ? null
      : String(payload.discount_label).trim().slice(0, 500)

  const reason =
    payload.discount_reason == null || String(payload.discount_reason).trim() === ""
      ? null
      : String(payload.discount_reason).trim().slice(0, 2000)

  const { finalCents } = applyDiscountToMrrCents(baseCents, typeNorm, num, discount_expires_at)
  if (finalCents < 0) {
    return {
      ok: false,
      status: 400,
      code: "price_below_zero",
      message: "Discount would reduce price below $0.",
    }
  }

  const { error: updErr } = await admin
    .from("organization_subscriptions")
    .update({
      discount_type: typeNorm,
      discount_value: num,
      discount_label: label,
      discount_reason: reason,
      discount_expires_at,
      updated_at: now,
    })
    .eq("organization_id", organizationId)

  if (updErr) {
    return { ok: false, status: 400, code: "update_failed", message: updErr.message }
  }

  return { ok: true }
}
