import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { BlitzpayWebhookInboxStatus } from "@/lib/blitzpay/payment-domain"

const LAST_ERROR_MAX = 500

export function truncateInboxError(message: string): string {
  const t = message.trim()
  if (t.length <= LAST_ERROR_MAX) return t
  return `${t.slice(0, LAST_ERROR_MAX - 3)}...`
}

export type BlitzpayWebhookInboxInsert = {
  stripe_event_id: string
  event_type: string
  livemode: boolean
  stripe_connect_account: string | null
  payload_hash: string
}

export async function blitzpayWebhookInboxInsertPending(
  admin: SupabaseClient,
  row: BlitzpayWebhookInboxInsert,
): Promise<{ inserted: boolean }> {
  const { error } = await admin.from("blitzpay_webhook_inbox").insert({
    stripe_event_id: row.stripe_event_id,
    event_type: row.event_type,
    livemode: row.livemode,
    stripe_connect_account: row.stripe_connect_account,
    payload_hash: row.payload_hash,
    processing_status: "pending" satisfies BlitzpayWebhookInboxStatus,
    attempt_count: 0,
  })
  if (!error) return { inserted: true }
  if (error.code === "23505") return { inserted: false }
  throw new Error(error.message)
}

/** After a dead letter, Stripe retry: bump attempts and clear last_error. */
export async function blitzpayWebhookInboxResetDeadToPending(
  admin: SupabaseClient,
  stripeEventId: string,
): Promise<void> {
  const { data, error: selErr } = await admin
    .from("blitzpay_webhook_inbox")
    .select("processing_status, attempt_count")
    .eq("stripe_event_id", stripeEventId)
    .maybeSingle()

  if (selErr) throw new Error(selErr.message)
  if (!data) return
  const status = (data as { processing_status?: string }).processing_status
  const attempts = Number((data as { attempt_count?: number }).attempt_count ?? 0)
  if (status !== "dead") return

  const { error } = await admin
    .from("blitzpay_webhook_inbox")
    .update({
      processing_status: "pending",
      attempt_count: attempts + 1,
      last_error: null,
      processed_at: null,
    })
    .eq("stripe_event_id", stripeEventId)
    .eq("processing_status", "dead")

  if (error) throw new Error(error.message)
}

export async function blitzpayWebhookInboxMarkDone(
  admin: SupabaseClient,
  stripeEventId: string,
): Promise<void> {
  const { error } = await admin
    .from("blitzpay_webhook_inbox")
    .update({
      processing_status: "done",
      processed_at: new Date().toISOString(),
    })
    .eq("stripe_event_id", stripeEventId)

  if (error) throw new Error(error.message)
}

export async function blitzpayWebhookInboxMarkDead(
  admin: SupabaseClient,
  stripeEventId: string,
  lastError: string,
): Promise<void> {
  const { error } = await admin
    .from("blitzpay_webhook_inbox")
    .update({
      processing_status: "dead",
      last_error: truncateInboxError(lastError),
      processed_at: new Date().toISOString(),
    })
    .eq("stripe_event_id", stripeEventId)

  if (error) throw new Error(error.message)
}
