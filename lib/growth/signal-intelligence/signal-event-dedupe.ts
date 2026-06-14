/** Lead signal event dedupe — server-only. */

import "server-only"

import { createHash } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { LeadSignalEvent } from "@/lib/growth/signal-intelligence/lead-signal-event-types"
import { LEAD_SIGNAL_EVENT_ROUTER_QA_MARKER } from "@/lib/growth/signal-intelligence/lead-signal-event-types"

export function buildLeadSignalDedupeHash(event: LeadSignalEvent): string {
  const raw = [
    event.leadId.trim(),
    event.sourceDomain,
    event.signalType,
    event.evidenceRef.table.trim(),
    event.evidenceRef.id.trim(),
  ].join("|")
  return createHash("sha256").update(raw).digest("hex")
}

export async function isDuplicateLeadSignalEvent(
  admin: SupabaseClient,
  dedupeHash: string,
): Promise<boolean> {
  const { data, error } = await admin
    .schema("growth")
    .from("signal_events")
    .select("id")
    .eq("event_type", "routed")
    .contains("event_payload", { dedupe_hash: dedupeHash, qa_marker: LEAD_SIGNAL_EVENT_ROUTER_QA_MARKER })
    .limit(1)

  if (error) return false
  return (data?.length ?? 0) > 0
}
