/**
 * AI Ops Phase 2 — fire-and-forget outcome logger.
 *
 * Used by the recommendation card and dashboard digest to record
 * manager actions (opened_entity / drafted_followup / dismissed /
 * narrated / etc.) without blocking the UI. Failures are swallowed
 * — telemetry must never break the user flow.
 */

import type { Recommendation } from "@/lib/ai-ops/types"

export type AiOpsOutcomeKind =
  | "opened_entity"
  | "drafted_followup"
  | "created_automation_suggestion"
  | "narrated"
  | "dismissed"
  | "snoozed"
  | "acted_on"

export function logAiOpsOutcome(
  organizationId: string,
  rec: Pick<Recommendation, "key" | "category" | "ruleId" | "entity">,
  outcome: AiOpsOutcomeKind,
  context: Record<string, unknown> = {},
): void {
  if (!organizationId) return
  const body = JSON.stringify({
    recommendationKey: rec.key,
    category: rec.category,
    ruleId: rec.ruleId,
    outcome,
    context: { ...context, entityType: rec.entity?.type ?? null },
  })
  // Prefer `sendBeacon` so the request survives navigation (e.g.
  // when the user clicks "Open record" and we want to log
  // `opened_entity` before the new page loads).
  try {
    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      const blob = new Blob([body], { type: "application/json" })
      const ok = navigator.sendBeacon(
        `/api/organizations/${encodeURIComponent(organizationId)}/ai-ops/outcomes`,
        blob,
      )
      if (ok) return
    }
  } catch {
    // fall through to fetch
  }
  void fetch(
    `/api/organizations/${encodeURIComponent(organizationId)}/ai-ops/outcomes`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    },
  ).catch(() => {})
}
