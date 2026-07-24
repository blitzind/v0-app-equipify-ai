/**
 * AVA-MAILBOX-RELIABILITY-AND-AFFINITY-1A — Explicit sender migration (server-only).
 */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  claimOutboundSenderAssignment,
  fetchActiveOutboundSenderAssignment,
  updateOutboundSenderAssignmentStatus,
} from "@/lib/growth/outbound-sender-affinity/outbound-sender-affinity-repository"
import type { OutboundSenderAssignment } from "@/lib/growth/outbound-sender-affinity/outbound-sender-affinity-types"
import { getMailboxConnectionBySender } from "@/lib/growth/mailboxes/mailbox-repository"
import { getSenderAccount } from "@/lib/growth/sender/sender-repository"
import { invalidateAvaSupervisedApprovalsForSenderMigration } from "@/lib/growth/ai-copilot-repository"

export type MigrateOutboundSenderAssignmentResult =
  | { ok: true; assignment: OutboundSenderAssignment; previousAssignmentId: string; invalidatedApprovals: number }
  | { ok: false; code: string; message: string }

export async function migrateOutboundSenderAssignment(
  admin: SupabaseClient,
  input: {
    organizationId: string
    leadId: string
    contactEmail: string
    targetSenderAccountId: string
    reason: string
    actorUserId: string
    actorEmail?: string | null
  },
): Promise<MigrateOutboundSenderAssignmentResult> {
  const existing = await fetchActiveOutboundSenderAssignment(admin, {
    organizationId: input.organizationId,
    leadId: input.leadId,
    contactEmail: input.contactEmail,
  })

  if (!existing) {
    return { ok: false, code: "assignment_not_found", message: "No active sender assignment to migrate." }
  }

  if (existing.senderAccountId === input.targetSenderAccountId) {
    return { ok: false, code: "same_sender", message: "Target sender matches the current assignment." }
  }

  const targetSender = await getSenderAccount(admin, input.targetSenderAccountId)
  if (!targetSender) {
    return { ok: false, code: "target_sender_not_found", message: "Target sender account not found." }
  }

  const mailbox = await getMailboxConnectionBySender(admin, targetSender.id)
  const migratedAt = new Date().toISOString()

  await updateOutboundSenderAssignmentStatus(admin, existing.id, {
    status: "migrated",
    migrationMetadata: {
      migratedAt,
      migratedToSenderAccountId: targetSender.id,
      reason: input.reason,
      actorUserId: input.actorUserId,
      actorEmail: input.actorEmail ?? null,
      gmailThreadContinuityWarning:
        "Changing sender may start a new Gmail thread or alter reply behavior for this relationship.",
    },
  })

  const claimed = await claimOutboundSenderAssignment(admin, {
    organizationId: input.organizationId,
    leadId: input.leadId,
    contactEmail: input.contactEmail,
    senderAccountId: targetSender.id,
    mailboxConnectionId: mailbox?.id ?? null,
    senderEmail: targetSender.email_address,
    providerFamily: targetSender.provider_family,
    assignmentSource: "explicit_migration",
    assignmentStrategy: "operator_migration",
    senderPoolId: null,
    senderRotationDecisionId: null,
  })

  if (!claimed) {
    return { ok: false, code: "migration_claim_failed", message: "Could not persist migrated sender assignment." }
  }

  const invalidatedApprovals = await invalidateAvaSupervisedApprovalsForSenderMigration(admin, {
    leadId: input.leadId,
    previousAssignmentId: existing.id,
    previousSenderAccountId: existing.senderAccountId,
    contactEmail: input.contactEmail,
  }).catch(() => 0)

  return {
    ok: true,
    assignment: claimed.assignment,
    previousAssignmentId: existing.id,
    invalidatedApprovals,
  }
}
