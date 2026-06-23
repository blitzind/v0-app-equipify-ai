/** GE-AUTO-2D — Persistent objective source event dedupe (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

const recentEventKeys = new Set<string>()
const MAX_RECENT_EVENT_KEYS = 5000

function rememberInMemoryEventKey(key: string): boolean {
  if (recentEventKeys.has(key)) return false
  recentEventKeys.add(key)
  if (recentEventKeys.size > MAX_RECENT_EVENT_KEYS) {
    const first = recentEventKeys.values().next().value
    if (first) recentEventKeys.delete(first)
  }
  return true
}

function receiptsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("objective_source_event_receipts")
}

export async function rememberObjectiveSourceEventReceipt(
  admin: SupabaseClient,
  input: {
    idempotencyKey: string
    organizationId: string
    source: string
    signalType: string
    leadId?: string | null
  },
): Promise<{ duplicate: boolean; persisted: boolean }> {
  const { data, error } = await receiptsTable(admin)
    .insert({
      idempotency_key: input.idempotencyKey,
      organization_id: input.organizationId,
      source: input.source,
      signal_type: input.signalType,
      lead_id: input.leadId ?? null,
    })
    .select("idempotency_key")
    .maybeSingle()

  if (!error && data) {
    return { duplicate: false, persisted: true }
  }

  if (error?.code === "23505" || error?.message?.includes("duplicate key")) {
    return { duplicate: true, persisted: true }
  }

  const accepted = rememberInMemoryEventKey(input.idempotencyKey)
  return { duplicate: !accepted, persisted: false }
}
