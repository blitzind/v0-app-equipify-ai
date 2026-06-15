/** Growth Engine SR-2B-1 — Share Pages platform admin route gates (server-only). */

import "server-only"

import {
  GROWTH_SHARE_PAGES_CONFIRM,
  GROWTH_SHARE_PAGES_MIGRATION,
  GROWTH_SHARE_PAGES_QA_MARKER,
  GROWTH_SHARE_PAGE_STATUSES,
} from "@/lib/growth/share-pages/share-page-types"

export { GROWTH_SHARE_PAGES_CONFIRM }

export const GROWTH_SHARE_PAGES_READINESS_CHECKLIST = [
  "Platform admin session on Vercel Production.",
  "Share pages require explicit human approval before publish.",
  "Public /p/{token} resolves published pages only; preview tokens are admin-only.",
  "Share page foundation does not send outreach, enroll sequences, or book meetings autonomously.",
  `Apply migration ${GROWTH_SHARE_PAGES_MIGRATION} before enabling routes.`,
] as const

export function assertSharePagesExecuteAllowed(env: Record<string, string | undefined>): {
  ok: boolean
  blockers: string[]
} {
  const blockers: string[] = []
  if (env.VERCEL_ENV !== "production" && env.NODE_ENV !== "production") {
    blockers.push("production_environment_required")
  }
  return { ok: blockers.length === 0, blockers }
}

export function validateSharePagesCertificationConfirmation(body: unknown): {
  ok: boolean
  error: string | null
} {
  if (!body || typeof body !== "object") {
    return {
      ok: false,
      error: `Request body must include confirm: "${GROWTH_SHARE_PAGES_CONFIRM}".`,
    }
  }
  const confirm =
    typeof (body as Record<string, unknown>).confirm === "string"
      ? (body as Record<string, unknown>).confirm.trim()
      : ""
  if (confirm !== GROWTH_SHARE_PAGES_CONFIRM) {
    return {
      ok: false,
      error: `Invalid confirm token. Expected "${GROWTH_SHARE_PAGES_CONFIRM}".`,
    }
  }
  return { ok: true, error: null }
}

export function buildSharePagesReadinessPayload() {
  return {
    qa_marker: GROWTH_SHARE_PAGES_QA_MARKER,
    migration: GROWTH_SHARE_PAGES_MIGRATION,
    execute_confirm: GROWTH_SHARE_PAGES_CONFIRM,
    allowed_statuses: GROWTH_SHARE_PAGE_STATUSES,
    no_outreach_execution: true,
    no_enrollment_execution: true,
    requires_human_review: true,
    autonomous_execution_enabled: false,
    checklist: GROWTH_SHARE_PAGES_READINESS_CHECKLIST,
  }
}
