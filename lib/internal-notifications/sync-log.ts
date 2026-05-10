import type { SupabaseClient } from "@supabase/supabase-js"
import type { InternalNotificationCandidate } from "@/lib/internal-notifications/types"

export async function upsertInternalNotificationLogRows(
  supabase: SupabaseClient,
  organizationId: string,
  candidates: InternalNotificationCandidate[],
  nowIso: string,
): Promise<{ error: string | null }> {
  if (!candidates.length) return { error: null }

  const persistable = candidates.filter((c) => c.eventType !== "invoice_overdue")
  if (!persistable.length) return { error: null }

  const rows = persistable.map((c) => ({
    organization_id: organizationId,
    rule_id: c.ruleId,
    event_type: c.eventType,
    dedupe_key: c.dedupeKey,
    title: c.title,
    body: c.body,
    entity_type: c.entityType,
    entity_id: c.entityId,
    customer_id: c.customerId,
    severity: c.severity,
    metadata: { href: c.href ?? null } as Record<string, unknown>,
    last_seen_at: nowIso,
  }))

  const { error } = await supabase.from("internal_notification_log").upsert(rows, {
    onConflict: "organization_id,dedupe_key",
  })

  return { error: error?.message ?? null }
}
