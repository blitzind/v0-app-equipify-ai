import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { assertUuid } from "@/lib/blitzpay/idempotency-keys"

export type BlitzpayPaymentLinkStaffAction = "revoke" | "expire" | "regenerate"

export async function assertBlitzpayPaymentLinkInInvoice(
  admin: SupabaseClient,
  organizationId: string,
  invoiceId: string,
  linkId: string,
): Promise<{ ok: true } | { ok: false; code: string; message: string }> {
  assertUuid(organizationId, "organizationId")
  assertUuid(invoiceId, "invoiceId")
  assertUuid(linkId, "linkId")
  const { data, error } = await admin
    .from("blitzpay_payment_links")
    .select("id, status")
    .eq("id", linkId)
    .eq("organization_id", organizationId)
    .eq("org_invoice_id", invoiceId)
    .maybeSingle()
  if (error) return { ok: false, code: "query_failed", message: error.message }
  if (!data) return { ok: false, code: "not_found", message: "Payment link not found." }
  return { ok: true }
}

export async function updateBlitzpayPaymentLinkStatus(
  admin: SupabaseClient,
  input: {
    organizationId: string
    invoiceId: string
    linkId: string
    action: "revoke" | "expire"
    actorUserId: string | null
  },
): Promise<{ ok: true } | { ok: false; code: string; message: string }> {
  const gate = await assertBlitzpayPaymentLinkInInvoice(admin, input.organizationId, input.invoiceId, input.linkId)
  if (!gate.ok) return gate
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
    .eq("org_invoice_id", input.invoiceId)
    .in("status", ["active"])
  if (error) return { ok: false, code: "update_failed", message: error.message }
  return { ok: true }
}
