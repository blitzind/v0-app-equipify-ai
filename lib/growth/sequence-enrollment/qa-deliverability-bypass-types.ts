/** Client-safe QA deliverability bypass types for internal platform testing. */

import { normalizeEmail } from "@/lib/growth/import/normalize"

export const GROWTH_QA_DELIVERABILITY_BYPASS_QA_MARKER = "growth-qa-deliverability-bypass-v1" as const

export const GROWTH_QA_ALLOWED_RECIPIENTS_ENV = "GROWTH_QA_ALLOWED_RECIPIENTS" as const

export const GROWTH_QA_DELIVERABILITY_BYPASS_AUDIT_EVENTS = [
  "qa_deliverability_bypass_used",
  "qa_deliverability_bypass_denied",
] as const

export type GrowthQaDeliverabilityBypassAuditEvent =
  (typeof GROWTH_QA_DELIVERABILITY_BYPASS_AUDIT_EVENTS)[number]

/** Deliverability infrastructure blocks that QA may bypass (not suppression/compliance). */
export const GROWTH_QA_DELIVERABILITY_BYPASSABLE_BLOCK_CODES = [
  "domain_protection",
  "reputation_paused",
  "reputation_throttled",
  "mailbox_unhealthy",
] as const

export type GrowthQaDeliverabilityBypassableBlockCode =
  (typeof GROWTH_QA_DELIVERABILITY_BYPASSABLE_BLOCK_CODES)[number]

export type GrowthQaDeliverabilityBypassSnapshot = {
  active: boolean
  reason: string | null
  deniedReason: string | null
  senderEmail: string | null
  recipientEmail: string
  enrollmentId?: string | null
  jobId?: string | null
  bypassReason?: string | null
}

export type GrowthQaDeliverabilityBypassView = {
  qaMarker: typeof GROWTH_QA_DELIVERABILITY_BYPASS_QA_MARKER
  active: boolean
  recipientEmail: string | null
  senderEmail: string | null
  bypassReason: string | null
  deniedReason: string | null
}

export const GROWTH_QA_DELIVERABILITY_BYPASS_BANNER =
  "QA Deliverability Bypass Active — deliverability protection bypassed for approved internal test recipient." as const

export function isGrowthQaDeliverabilityBypassableBlockCode(
  code: string | null | undefined,
): code is GrowthQaDeliverabilityBypassableBlockCode {
  return (
    typeof code === "string" &&
    (GROWTH_QA_DELIVERABILITY_BYPASSABLE_BLOCK_CODES as readonly string[]).includes(code)
  )
}

export function readQaDeliverabilityBypassFromJobEventMetadata(
  metadata: Record<string, unknown> | null | undefined,
): GrowthQaDeliverabilityBypassSnapshot | null {
  const raw = metadata?.qa_deliverability_bypass
  if (!raw || typeof raw !== "object") return null
  const snapshot = raw as Record<string, unknown>
  if (snapshot.active !== true) return null
  const recipientEmail = typeof snapshot.recipientEmail === "string" ? snapshot.recipientEmail : null
  if (!recipientEmail) return null
  return {
    active: true,
    reason: typeof snapshot.reason === "string" ? snapshot.reason : null,
    deniedReason: null,
    senderEmail: typeof snapshot.senderEmail === "string" ? snapshot.senderEmail : null,
    recipientEmail,
    enrollmentId: typeof snapshot.enrollmentId === "string" ? snapshot.enrollmentId : null,
    jobId: typeof snapshot.jobId === "string" ? snapshot.jobId : null,
    bypassReason: typeof snapshot.bypassReason === "string" ? snapshot.bypassReason : null,
  }
}

export function parseGrowthQaAllowedRecipients(rawEnv = process.env[GROWTH_QA_ALLOWED_RECIPIENTS_ENV]): Set<string> {
  const raw = rawEnv?.trim()
  if (!raw) return new Set()

  const recipients = raw
    .split(",")
    .map((entry) => normalizeEmail(entry))
    .filter((entry): entry is string => Boolean(entry))

  return new Set(recipients)
}
