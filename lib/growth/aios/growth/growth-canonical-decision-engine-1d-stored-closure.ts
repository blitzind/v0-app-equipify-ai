/**
 * GE-AIOS-DECISION-ENGINE-1D — Stored Call Workspace 2B closure read path (server-only).
 */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { CALL_WORKSPACE_CLOSURE_FINGERPRINT_METADATA_KEY } from "@/lib/growth/operator-assist/call-workspace-post-call-closure-idempotency"
import {
  GROWTH_CALL_WORKSPACE_POST_CALL_CLOSURE_QA_MARKER,
  GROWTH_CALL_WORKSPACE_POST_CALL_CLOSURE_SOURCE_SYSTEM,
  type GrowthCallWorkspacePostCallClosure,
} from "@/lib/growth/operator-assist/call-workspace-post-call-closure-types"

export { mapStoredClosureToDecisionPostCall } from "@/lib/growth/aios/growth/growth-canonical-decision-engine-1d-stored-closure-map"

export type StoredCallWorkspacePostCallClosure = {
  closure: GrowthCallWorkspacePostCallClosure
  closureFingerprint: string
  recordedAt: string | null
  sourceEventId: string | null
}

function isValidStoredClosure(value: unknown): value is GrowthCallWorkspacePostCallClosure {
  if (!value || typeof value !== "object") return false
  const closure = value as GrowthCallWorkspacePostCallClosure
  return (
    closure.qaMarker === GROWTH_CALL_WORKSPACE_POST_CALL_CLOSURE_QA_MARKER &&
    Array.isArray(closure.commitments) &&
    Array.isArray(closure.businessConclusions) &&
    typeof closure.recommendedNextAction?.kind === "string"
  )
}

export async function loadLatestStoredCallWorkspacePostCallClosureForLead(
  admin: SupabaseClient,
  input: { leadId: string; limit?: number },
): Promise<StoredCallWorkspacePostCallClosure | null> {
  const { data, error } = await admin
    .schema("growth")
    .from("lead_memory_events")
    .select("metadata, created_at, source_event_id")
    .eq("lead_id", input.leadId)
    .eq("source_system", GROWTH_CALL_WORKSPACE_POST_CALL_CLOSURE_SOURCE_SYSTEM)
    .order("created_at", { ascending: false })
    .limit(input.limit ?? 12)

  if (error || !data?.length) return null

  for (const row of data) {
    const metadata = (row as { metadata?: Record<string, unknown> }).metadata
    const closure = metadata?.closure
    if (!isValidStoredClosure(closure)) continue

    const fingerprint =
      typeof metadata?.[CALL_WORKSPACE_CLOSURE_FINGERPRINT_METADATA_KEY] === "string"
        ? String(metadata[CALL_WORKSPACE_CLOSURE_FINGERPRINT_METADATA_KEY])
        : closure.closureFingerprint

    if (!fingerprint || fingerprint !== closure.closureFingerprint) continue

    return {
      closure,
      closureFingerprint: fingerprint,
      recordedAt: (row as { created_at?: string | null }).created_at ?? null,
      sourceEventId: (row as { source_event_id?: string | null }).source_event_id ?? null,
    }
  }

  return null
}
