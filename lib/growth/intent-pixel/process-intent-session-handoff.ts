import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { bridgeIntentSessionFromStore } from "@/lib/growth/lead-engine/intent/intent-to-lead-bridge"
import { ingestIntentCandidateToLeadInbox } from "@/lib/growth/lead-inbox/lead-inbox-loader"
import { GROWTH_LIVE_VISITOR_MONITOR_QA_MARKER } from "@/lib/growth/intent-pixel/live-visitor-monitor-types"
import { isGrowthIntentPixelSchemaReady } from "@/lib/growth/intent-pixel/intent-pixel-schema-health"

export type ProcessIntentSessionHandoffResult = {
  qa_marker: typeof GROWTH_LIVE_VISITOR_MONITOR_QA_MARKER
  ok: boolean
  session_id: string
  lead_inbox_id: string | null
  message: string
  duplicate: boolean
}

export async function processIntentSessionToLeadInbox(
  admin: SupabaseClient,
  siteKey: string,
  sessionId: string,
): Promise<ProcessIntentSessionHandoffResult> {
  const base = {
    qa_marker: GROWTH_LIVE_VISITOR_MONITOR_QA_MARKER,
    ok: false,
    session_id: sessionId,
    lead_inbox_id: null,
    message: "",
    duplicate: false,
  }

  if (!(await isGrowthIntentPixelSchemaReady(admin))) {
    return { ...base, message: "Intent Pixel schema not ready." }
  }

  const bridge = await bridgeIntentSessionFromStore(admin, siteKey, sessionId)
  if (!bridge.lead_candidate) {
    return {
      ...base,
      message: bridge.errors[0] ?? "Session not eligible for Lead Inbox.",
    }
  }

  if (!bridge.lead_candidate.lead_engine_eligible) {
    return {
      ...base,
      message: "Session did not pass lead engine eligibility — not pushed.",
    }
  }

  const ingest = await ingestIntentCandidateToLeadInbox(admin, bridge.lead_candidate, {
    site_key: siteKey,
    session_count: 1,
    visit_count: Math.max(1, bridge.lead_candidate.candidate_evidence.length),
  })

  if (ingest.duplicate) {
    return {
      ...base,
      duplicate: true,
      message: ingest.reason ?? "Duplicate inbox entry.",
    }
  }

  if (!ingest.ok || !ingest.row) {
    return { ...base, message: ingest.reason ?? "Lead Inbox ingest failed." }
  }

  return {
    qa_marker: GROWTH_LIVE_VISITOR_MONITOR_QA_MARKER,
    ok: true,
    session_id: sessionId,
    lead_inbox_id: ingest.row.id,
    message: "Added to Lead Inbox for human review. Lead Engine not auto-run.",
    duplicate: false,
  }
}
