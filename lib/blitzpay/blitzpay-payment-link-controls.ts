import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { assertUuid } from "@/lib/blitzpay/idempotency-keys"

export type BlitzpayPaymentLinkStaffAction = "revoke" | "expire" | "regenerate"

function targetColumnForPaymentLink(
  invoiceId: string | undefined,
  quoteId: string | undefined,
): { ok: true; column: "org_invoice_id" | "org_quote_id"; foreignId: string } | { ok: false; code: string; message: string } {
  const inv = invoiceId?.trim()
  const qu = quoteId?.trim()
  if (inv && qu) {
    return { ok: false, code: "bad_target", message: "Specify only one of invoiceId or quoteId." }
  }
  if (inv) return { ok: true, column: "org_invoice_id", foreignId: inv }
  if (qu) return { ok: true, column: "org_quote_id", foreignId: qu }
  return { ok: false, code: "bad_target", message: "invoiceId or quoteId is required." }
}

export async function assertBlitzpayPaymentLinkInInvoice(
  admin: SupabaseClient,
  organizationId: string,
  invoiceId: string,
  linkId: string,
): Promise<{ ok: true } | { ok: false; code: string; message: string }> {
  return assertBlitzpayPaymentLinkForTarget(admin, organizationId, linkId, { invoiceId, quoteId: undefined })
}

export async function assertBlitzpayPaymentLinkInQuote(
  admin: SupabaseClient,
  organizationId: string,
  quoteId: string,
  linkId: string,
): Promise<{ ok: true } | { ok: false; code: string; message: string }> {
  return assertBlitzpayPaymentLinkForTarget(admin, organizationId, linkId, { invoiceId: undefined, quoteId })
}

async function assertBlitzpayPaymentLinkForTarget(
  admin: SupabaseClient,
  organizationId: string,
  linkId: string,
  target: { invoiceId?: string; quoteId?: string },
): Promise<{ ok: true } | { ok: false; code: string; message: string }> {
  assertUuid(organizationId, "organizationId")
  assertUuid(linkId, "linkId")
  const col = targetColumnForPaymentLink(target.invoiceId, target.quoteId)
  if (!col.ok) return col
  assertUuid(col.foreignId, col.column === "org_invoice_id" ? "invoiceId" : "quoteId")
  const { data, error } = await admin
    .from("blitzpay_payment_links")
    .select("id, status")
    .eq("id", linkId)
    .eq("organization_id", organizationId)
    .eq(col.column, col.foreignId)
    .maybeSingle()
  if (error) return { ok: false, code: "query_failed", message: error.message }
  if (!data) return { ok: false, code: "not_found", message: "Payment link not found." }
  return { ok: true }
}

export async function updateBlitzpayPaymentLinkStatus(
  admin: SupabaseClient,
  input: {
    organizationId: string
    /** Exactly one of invoiceId or quoteId must be set (matches DB XOR on payment links). */
    invoiceId?: string
    quoteId?: string
    linkId: string
    action: "revoke" | "expire"
    actorUserId: string | null
  },
): Promise<{ ok: true } | { ok: false; code: string; message: string }> {
  const gate = await assertBlitzpayPaymentLinkForTarget(admin, input.organizationId, input.linkId, {
    invoiceId: input.invoiceId,
    quoteId: input.quoteId,
  })
  if (!gate.ok) return gate
  const col = targetColumnForPaymentLink(input.invoiceId, input.quoteId)
  if (!col.ok) return col
  const { data: prev, error: selErr } = await admin
    .from("blitzpay_payment_links")
    .select("metadata")
    .eq("id", input.linkId)
    .eq("organization_id", input.organizationId)
    .maybeSingle()
  if (selErr) return { ok: false, code: "query_failed", message: selErr.message }
  const now = new Date().toISOString()
  const status = input.action === "revoke" ? "revoked" : "expired"
  const meta = {
    ...((prev as { metadata?: Record<string, unknown> } | null)?.metadata ?? {}),
    staff_action: input.action,
    actor_user_id: input.actorUserId,
    acted_at: now,
  }
  const { error } = await admin
    .from("blitzpay_payment_links")
    .update({
      status,
      revoked_at: now,
      updated_at: now,
      metadata: meta,
    })
    .eq("id", input.linkId)
    .eq("organization_id", input.organizationId)
    .eq(col.column, col.foreignId)
    .in("status", ["active"])
  if (error) return { ok: false, code: "update_failed", message: error.message }
  return { ok: true }
}
