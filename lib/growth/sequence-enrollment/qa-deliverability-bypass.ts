import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { logGrowthEngine } from "@/lib/growth/access"
import { normalizeEmail } from "@/lib/growth/import/normalize"
import { recordInternalOutboundAuditEvent } from "@/lib/growth/operations/internal-outbound-audit"
import { isGrowthOutboundStandaloneMode } from "@/lib/growth/runtime/outbound-mode"
import { parseGrowthQaAllowedRecipients } from "@/lib/growth/sequence-enrollment/qa-deliverability-bypass-types"
import { isGrowthQaAccelerationEnabled } from "@/lib/growth/sequence-enrollment/qa-acceleration-config"
import {
  GROWTH_QA_DELIVERABILITY_BYPASS_QA_MARKER,
  type GrowthQaDeliverabilityBypassSnapshot,
  type GrowthQaDeliverabilityBypassView,
  isGrowthQaDeliverabilityBypassableBlockCode,
} from "@/lib/growth/sequence-enrollment/qa-deliverability-bypass-types"
import { getSenderAccount } from "@/lib/growth/sender/sender-repository"
import { isPlatformAdminEmail } from "@/lib/platform-admin"

async function listConnectedMailboxEmailsForSender(
  admin: SupabaseClient,
  senderAccountId: string,
): Promise<string[]> {
  const { data, error } = await admin
    .schema("growth")
    .from("mailbox_connections")
    .select("email_address, status")
    .eq("sender_account_id", senderAccountId)
    .is("deleted_at", null)

  if (error) throw new Error(error.message)

  return (data ?? [])
    .filter((row) => ["connected", "healthy", "warning"].includes(String(row.status)))
    .map((row) => normalizeEmail(String(row.email_address ?? "")))
    .filter((email): email is string => Boolean(email))
}

async function resolveSenderEmail(
  admin: SupabaseClient,
  senderAccountId?: string | null,
): Promise<string | null> {
  if (!senderAccountId) return null
  const sender = await getSenderAccount(admin, senderAccountId)
  return normalizeEmail(sender?.email_address ?? null)
}

async function evaluateQaSafeRecipient(input: {
  admin: SupabaseClient
  recipientEmail: string
  senderAccountId?: string | null
}): Promise<{ safe: boolean; reason: string }> {
  const normalizedRecipient = normalizeEmail(input.recipientEmail)
  if (!normalizedRecipient) {
    return { safe: false, reason: "invalid_recipient_email" }
  }

  const allowlist = parseGrowthQaAllowedRecipients()
  if (allowlist.has(normalizedRecipient)) {
    return { safe: true, reason: "allowlisted_qa_recipient" }
  }

  if (input.senderAccountId) {
    const mailboxEmails = await listConnectedMailboxEmailsForSender(input.admin, input.senderAccountId)
    if (mailboxEmails.includes(normalizedRecipient)) {
      return { safe: true, reason: "sender_mailbox_recipient" }
    }
  }

  return { safe: false, reason: "recipient_not_qa_allowlisted" }
}

function evaluateQaDeliverabilityBypassGates(input: {
  actingUserEmail?: string | null
  requirePlatformAdmin: boolean
}): { allowed: boolean; deniedReason: string | null } {
  if (input.requirePlatformAdmin) {
    if (!input.actingUserEmail || !isPlatformAdminEmail(input.actingUserEmail)) {
      return { allowed: false, deniedReason: "platform_admin_required" }
    }
  }

  if (!isGrowthQaAccelerationEnabled()) {
    return { allowed: false, deniedReason: "qa_acceleration_disabled" }
  }

  if (!isGrowthOutboundStandaloneMode()) {
    return { allowed: false, deniedReason: "standalone_mode_required" }
  }

  return { allowed: true, deniedReason: null }
}

export async function evaluateGrowthQaDeliverabilityBypass(
  admin: SupabaseClient,
  input: {
    actingUserEmail: string
    recipientEmail: string
    senderAccountId?: string | null
    enrollmentId?: string | null
    jobId?: string | null
  },
): Promise<GrowthQaDeliverabilityBypassSnapshot> {
  const normalizedRecipient = normalizeEmail(input.recipientEmail)
  const senderEmail = await resolveSenderEmail(admin, input.senderAccountId)

  const gates = evaluateQaDeliverabilityBypassGates({
    actingUserEmail: input.actingUserEmail,
    requirePlatformAdmin: true,
  })

  if (!gates.allowed) {
    return {
      active: false,
      reason: null,
      deniedReason: gates.deniedReason,
      senderEmail,
      recipientEmail: normalizedRecipient ?? input.recipientEmail,
      enrollmentId: input.enrollmentId ?? null,
      jobId: input.jobId ?? null,
    }
  }

  const recipientCheck = await evaluateQaSafeRecipient({
    admin,
    recipientEmail: input.recipientEmail,
    senderAccountId: input.senderAccountId,
  })

  if (!recipientCheck.safe) {
    return {
      active: false,
      reason: null,
      deniedReason: recipientCheck.reason,
      senderEmail,
      recipientEmail: normalizedRecipient ?? input.recipientEmail,
      enrollmentId: input.enrollmentId ?? null,
      jobId: input.jobId ?? null,
    }
  }

  return {
    active: true,
    reason: recipientCheck.reason,
    deniedReason: null,
    senderEmail,
    recipientEmail: normalizedRecipient ?? input.recipientEmail,
    enrollmentId: input.enrollmentId ?? null,
    jobId: input.jobId ?? null,
    bypassReason: recipientCheck.reason,
  }
}

export async function evaluateGrowthQaDeliverabilityBypassForJobSend(
  admin: SupabaseClient,
  input: {
    recipientEmail: string
    senderAccountId: string
    enrollmentId?: string | null
    jobId?: string | null
    plannedBypass?: GrowthQaDeliverabilityBypassSnapshot | null
  },
): Promise<GrowthQaDeliverabilityBypassSnapshot> {
  const senderEmail = await resolveSenderEmail(admin, input.senderAccountId)
  const normalizedRecipient = normalizeEmail(input.recipientEmail)

  const gates = evaluateQaDeliverabilityBypassGates({
    requirePlatformAdmin: false,
  })

  if (!gates.allowed || !input.plannedBypass?.active) {
    return {
      active: false,
      reason: null,
      deniedReason: gates.deniedReason ?? "qa_deliverability_bypass_not_recorded_on_job",
      senderEmail,
      recipientEmail: normalizedRecipient ?? input.recipientEmail,
      enrollmentId: input.enrollmentId ?? null,
      jobId: input.jobId ?? null,
    }
  }

  const recipientCheck = await evaluateQaSafeRecipient({
    admin,
    recipientEmail: input.recipientEmail,
    senderAccountId: input.senderAccountId,
  })

  if (!recipientCheck.safe) {
    return {
      active: false,
      reason: null,
      deniedReason: recipientCheck.reason,
      senderEmail,
      recipientEmail: normalizedRecipient ?? input.recipientEmail,
      enrollmentId: input.enrollmentId ?? null,
      jobId: input.jobId ?? null,
    }
  }

  return {
    active: true,
    reason: input.plannedBypass.reason ?? recipientCheck.reason,
    deniedReason: null,
    senderEmail,
    recipientEmail: normalizedRecipient ?? input.recipientEmail,
    enrollmentId: input.enrollmentId ?? null,
    jobId: input.jobId ?? null,
    bypassReason: input.plannedBypass.bypassReason ?? recipientCheck.reason,
  }
}

export async function recordGrowthQaDeliverabilityBypassAudit(
  admin: SupabaseClient,
  input: {
    eventType: "qa_deliverability_bypass_used" | "qa_deliverability_bypass_denied"
    bypass: GrowthQaDeliverabilityBypassSnapshot
    infrastructureBlockCode?: string | null
    actingUserEmail?: string | null
    actingUserId?: string | null
  },
): Promise<void> {
  const logPayload = {
    qaMarker: GROWTH_QA_DELIVERABILITY_BYPASS_QA_MARKER,
    event: input.eventType,
    senderEmail: input.bypass.senderEmail,
    recipientEmail: input.bypass.recipientEmail,
    enrollmentId: input.bypass.enrollmentId ?? null,
    jobId: input.bypass.jobId ?? null,
    bypassReason: input.bypass.bypassReason ?? input.bypass.reason,
    deniedReason: input.bypass.deniedReason,
    infrastructureBlockCode: input.infrastructureBlockCode ?? null,
  }

  logGrowthEngine(input.eventType, logPayload)

  await recordInternalOutboundAuditEvent(admin, {
    eventType: input.eventType,
    severity: input.eventType === "qa_deliverability_bypass_used" ? "medium" : "high",
    title:
      input.eventType === "qa_deliverability_bypass_used"
        ? "QA deliverability bypass used"
        : "QA deliverability bypass denied",
    summary:
      input.eventType === "qa_deliverability_bypass_used"
        ? `Deliverability protection bypassed for ${input.bypass.recipientEmail}.`
        : input.bypass.deniedReason ?? "QA deliverability bypass conditions not met.",
    senderAccountId: null,
    actorUserId: input.actingUserId ?? null,
    actorEmail: input.actingUserEmail ?? null,
    metadata: logPayload,
  }).catch(() => undefined)
}

export async function maybeApplyGrowthQaDeliverabilityInfrastructureBypass(input: {
  admin: SupabaseClient
  bypass: GrowthQaDeliverabilityBypassSnapshot | null | undefined
  infrastructureBlockCode: string | null
  actingUserEmail?: string | null
  actingUserId?: string | null
}): Promise<{ allowed: boolean; bypassApplied: boolean }> {
  if (!input.bypass?.active || !isGrowthQaDeliverabilityBypassableBlockCode(input.infrastructureBlockCode)) {
    if (
      input.bypass &&
      !input.bypass.active &&
      isGrowthQaDeliverabilityBypassableBlockCode(input.infrastructureBlockCode) &&
      input.bypass.deniedReason &&
      input.bypass.deniedReason !== "qa_acceleration_disabled" &&
      input.bypass.deniedReason !== "standalone_mode_required"
    ) {
      await recordGrowthQaDeliverabilityBypassAudit(input.admin, {
        eventType: "qa_deliverability_bypass_denied",
        bypass: input.bypass,
        infrastructureBlockCode: input.infrastructureBlockCode,
        actingUserEmail: input.actingUserEmail,
        actingUserId: input.actingUserId,
      })
    }
    return { allowed: false, bypassApplied: false }
  }

  await recordGrowthQaDeliverabilityBypassAudit(input.admin, {
    eventType: "qa_deliverability_bypass_used",
    bypass: input.bypass,
    infrastructureBlockCode: input.infrastructureBlockCode,
    actingUserEmail: input.actingUserEmail,
    actingUserId: input.actingUserId,
  })

  return { allowed: true, bypassApplied: true }
}

export async function fetchGrowthQaDeliverabilityBypassView(
  admin: SupabaseClient,
  input: {
    actingUserEmail: string
    recipientEmail: string | null | undefined
    senderAccountId?: string | null
    enrollmentId?: string | null
  },
): Promise<GrowthQaDeliverabilityBypassView> {
  if (!input.recipientEmail?.trim()) {
    return {
      qaMarker: GROWTH_QA_DELIVERABILITY_BYPASS_QA_MARKER,
      active: false,
      recipientEmail: null,
      senderEmail: null,
      bypassReason: null,
      deniedReason: "missing_recipient_email",
    }
  }

  const evaluation = await evaluateGrowthQaDeliverabilityBypass(admin, {
    actingUserEmail: input.actingUserEmail,
    recipientEmail: input.recipientEmail,
    senderAccountId: input.senderAccountId,
    enrollmentId: input.enrollmentId ?? null,
  })

  return {
    qaMarker: GROWTH_QA_DELIVERABILITY_BYPASS_QA_MARKER,
    active: evaluation.active,
    recipientEmail: evaluation.recipientEmail,
    senderEmail: evaluation.senderEmail,
    bypassReason: evaluation.bypassReason ?? evaluation.reason,
    deniedReason: evaluation.deniedReason,
  }
}

export function serializeGrowthQaDeliverabilityBypassSnapshot(
  snapshot: GrowthQaDeliverabilityBypassSnapshot,
): Record<string, unknown> {
  return {
    qa_deliverability_bypass: {
      active: snapshot.active,
      reason: snapshot.reason,
      bypassReason: snapshot.bypassReason ?? snapshot.reason,
      senderEmail: snapshot.senderEmail,
      recipientEmail: snapshot.recipientEmail,
      enrollmentId: snapshot.enrollmentId ?? null,
      jobId: snapshot.jobId ?? null,
    },
  }
}

export async function fetchGrowthQaDeliverabilityBypassForJob(
  admin: SupabaseClient,
  jobId: string,
): Promise<GrowthQaDeliverabilityBypassSnapshot | null> {
  const { listSequenceExecutionJobEvents } = await import(
    "@/lib/growth/sequences/execution/sequence-job-repository"
  )
  const { readQaDeliverabilityBypassFromJobEventMetadata } = await import(
    "@/lib/growth/sequence-enrollment/qa-deliverability-bypass-types"
  )
  const events = await listSequenceExecutionJobEvents(admin, jobId, 25)
  const planned = events.find((event) => event.eventType === "job_planned")
  if (!planned) return null
  return readQaDeliverabilityBypassFromJobEventMetadata(planned.metadata)
}
