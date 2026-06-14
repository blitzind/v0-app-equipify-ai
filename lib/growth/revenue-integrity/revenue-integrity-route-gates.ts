/** Revenue integrity certification route gates — client-safe. */

import {
  REVENUE_INTEGRITY_EXECUTE_CONFIRM,
  REVENUE_INTEGRITY_QA_MARKER,
} from "@/lib/growth/revenue-integrity/revenue-integrity-types"

export const REVENUE_INTEGRITY_ROUTE_QA_MARKER = "revenue-integrity-route-rv1b-v1" as const

export const REVENUE_INTEGRITY_READINESS_CHECKLIST = [
  "Platform admin session on Vercel Production (not preview).",
  "Pilot opportunity draft converted with verifiable lead_id linkage.",
  "No bulk repair — single draft_id per execute request.",
  "Human confirmation token required for execute.",
] as const

export function validateRevenueIntegrityCertificationConfirmation(body: unknown): {
  ok: boolean
  draft_id: string | null
  dry_run: boolean
  error: string | null
} {
  if (!body || typeof body !== "object") {
    return { ok: false, draft_id: null, dry_run: false, error: "body_required" }
  }
  const record = body as Record<string, unknown>
  if (record.confirm !== REVENUE_INTEGRITY_EXECUTE_CONFIRM) {
    return { ok: false, draft_id: null, dry_run: false, error: "confirmation_token_required" }
  }
  const draftId = typeof record.draft_id === "string" ? record.draft_id.trim() : ""
  if (!draftId) {
    return { ok: false, draft_id: null, dry_run: false, error: "draft_id_required" }
  }
  return {
    ok: true,
    draft_id: draftId,
    dry_run: record.dry_run === true,
    error: null,
  }
}

export function buildRevenueIntegrityReadinessPayload(input?: {
  blockers?: string[]
  gates_ok?: boolean
}): Record<string, unknown> {
  return {
    qa_marker: REVENUE_INTEGRITY_QA_MARKER,
    route_qa_marker: REVENUE_INTEGRITY_ROUTE_QA_MARKER,
    execute_confirm: REVENUE_INTEGRITY_EXECUTE_CONFIRM,
    readiness_checklist: [...REVENUE_INTEGRITY_READINESS_CHECKLIST],
    gates_ok: input?.gates_ok ?? true,
    blockers: input?.blockers ?? [],
  }
}
