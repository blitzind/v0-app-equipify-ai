/** Growth Engine SR-2B-1 — Share Pages route gates (client-safe). */

import {
  GROWTH_SHARE_PAGES_CONFIRM,
  GROWTH_SHARE_PAGES_MIGRATION,
  GROWTH_SHARE_PAGES_QA_MARKER,
  GROWTH_SHARE_PAGE_STATUSES,
} from "@/lib/growth/share-pages/share-page-types"
import { isSharePageTokenFormatValid } from "@/lib/growth/share-pages/share-page-token"

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

export function validateSharePageOrganizationScope(input: {
  organizationId: string | null | undefined
  expectedOrganizationId: string | null | undefined
}): { ok: boolean; error: string | null } {
  const organizationId = input.organizationId?.trim() ?? ""
  const expectedOrganizationId = input.expectedOrganizationId?.trim() ?? ""
  if (!organizationId) return { ok: false, error: "organization_id_required" }
  if (!expectedOrganizationId) return { ok: true, error: null }
  if (organizationId !== expectedOrganizationId) {
    return { ok: false, error: "organization_scope_mismatch" }
  }
  return { ok: true, error: null }
}

export function validateSharePageRouteToken(rawToken: string | null | undefined): {
  ok: boolean
  token: string | null
  error: string | null
} {
  const token = typeof rawToken === "string" ? rawToken.trim() : ""
  if (!token) return { ok: false, token: null, error: "token_required" }
  if (!isSharePageTokenFormatValid(token)) {
    return { ok: false, token: null, error: "token_format_invalid" }
  }
  return { ok: true, token, error: null }
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
