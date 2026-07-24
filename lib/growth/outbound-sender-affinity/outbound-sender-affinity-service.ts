/**
 * AVA-MAILBOX-RELIABILITY-AND-AFFINITY-1A — Outbound sender affinity resolution (server-only).
 */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { getGrowthEngineAiOrgId } from "@/lib/growth/access"
import { ensureMailboxEligibleForSenderAssignment, ensureMailboxReadyForOutboundSend } from "@/lib/growth/mailboxes/mailbox-pre-send-readiness"
import { getMailboxConnectionBySender } from "@/lib/growth/mailboxes/mailbox-repository"
import {
  claimOutboundSenderAssignment,
  fetchActiveOutboundSenderAssignment,
  touchOutboundSenderAssignmentLastUsed,
  updateOutboundSenderAssignmentStatus,
} from "@/lib/growth/outbound-sender-affinity/outbound-sender-affinity-repository"
import type { OutboundSenderAssignment } from "@/lib/growth/outbound-sender-affinity/outbound-sender-affinity-types"
import { resolveSupervisedApprovedSenderAccountId } from "@/lib/growth/sequences/execution/growth-supervised-sender-resolution-1c"
import { resolveSenderRotationForPool } from "@/lib/growth/sender-pools/sender-pool-rotation-service"
import { getSenderPool } from "@/lib/growth/sender-pools/sender-pool-repository"
import { getSenderAccount } from "@/lib/growth/sender/sender-repository"
import { evaluatePreSendInfrastructureAllowed } from "@/lib/growth/compliance/pre-send-infrastructure-guards"

export const AVA_OUTBOUND_SENDER_AFFINITY_1A_QA_MARKER = "ava-outbound-sender-affinity-1a-v1" as const

export type ResolveOutboundSenderAffinityResult =
  | {
      ok: true
      assignment: OutboundSenderAssignment
      senderAccountId: string
      mailboxConnectionId: string | null
      senderEmail: string
      providerFamily: string
      created: boolean
    }
  | { ok: false; code: string; message: string; reconnectRequired?: boolean }

function resolveConfiguredAvaSenderPoolId(): string | null {
  return process.env.GROWTH_AVA_SUPERVISED_OUTBOUND_SENDER_POOL_ID?.trim() || null
}

async function selectSenderForNewOutboundRelationship(
  admin: SupabaseClient,
  input: {
    organizationId: string
    explicitSenderAccountId?: string | null
  },
): Promise<{
  senderAccountId: string
  senderPoolId: string | null
  assignmentSource: OutboundSenderAssignment["assignmentSource"]
  assignmentStrategy: string | null
  senderRotationDecisionId: string | null
} | null> {
  const poolId = resolveConfiguredAvaSenderPoolId()
  if (poolId) {
    const pool = await getSenderPool(admin, poolId)
    const rotation = await resolveSenderRotationForPool(admin, {
      senderPoolId: poolId,
      allowAutoRotation: true,
      persistDecision: true,
    })
    if (rotation.selectedSenderAccountId) {
      return {
        senderAccountId: rotation.selectedSenderAccountId,
        senderPoolId: poolId,
        assignmentSource: "sender_pool",
        assignmentStrategy: pool?.rotation_strategy ?? "weighted_health",
        senderRotationDecisionId: rotation.decisionId ?? null,
      }
    }
  }

  const primary = await resolveSupervisedApprovedSenderAccountId(admin, {
    organizationId: input.organizationId,
    explicitSenderAccountId: input.explicitSenderAccountId ?? null,
  })
  if (!primary) return null

  return {
    senderAccountId: primary,
    senderPoolId: null,
    assignmentSource: "primary_sender",
    assignmentStrategy: "supervised_primary_sender",
    senderRotationDecisionId: null,
  }
}

export async function resolveOrAssignOutboundSenderAffinity(
  admin: SupabaseClient,
  input: {
    organizationId: string
    leadId: string
    contactEmail: string
    explicitSenderAccountId?: string | null
    recipientEmailForChecks?: string
    purpose?: "assignment" | "transport"
  },
): Promise<ResolveOutboundSenderAffinityResult> {
  const forAssignment = input.purpose !== "transport"
  const organizationId = input.organizationId.trim() || getGrowthEngineAiOrgId() || ""
  if (!organizationId) {
    return { ok: false, code: "organization_unavailable", message: "Organization context is required." }
  }

  const existing = await fetchActiveOutboundSenderAssignment(admin, {
    organizationId,
    leadId: input.leadId,
    contactEmail: input.contactEmail,
  })

  if (existing) {
    const readiness = await ensureAssignedSenderReadyForSend(admin, {
      assignment: existing,
      recipientEmail: input.recipientEmailForChecks ?? input.contactEmail,
      forAssignment,
    })
    if (!readiness.ok) return readiness

    await touchOutboundSenderAssignmentLastUsed(admin, existing.id)
    return {
      ok: true,
      assignment: existing,
      senderAccountId: existing.senderAccountId,
      mailboxConnectionId: existing.mailboxConnectionId,
      senderEmail: existing.senderEmail,
      providerFamily: existing.providerFamily,
      created: false,
    }
  }

  const selected = await selectSenderForNewOutboundRelationship(admin, {
    organizationId,
    explicitSenderAccountId: input.explicitSenderAccountId,
  })
  if (!selected) {
    return {
      ok: false,
      code: "no_eligible_sender",
      message: "No eligible outbound sender is available.",
    }
  }

  const sender = await getSenderAccount(admin, selected.senderAccountId)
  if (!sender) {
    return { ok: false, code: "sender_not_found", message: "Selected sender account not found." }
  }

  const mailbox = await getMailboxConnectionBySender(admin, sender.id)
  const claimed = await claimOutboundSenderAssignment(admin, {
    organizationId,
    leadId: input.leadId,
    contactEmail: input.contactEmail,
    senderAccountId: sender.id,
    mailboxConnectionId: mailbox?.id ?? null,
    senderEmail: sender.email_address,
    providerFamily: sender.provider_family,
    assignmentSource: selected.assignmentSource,
    assignmentStrategy: selected.assignmentStrategy,
    senderPoolId: selected.senderPoolId,
    senderRotationDecisionId: selected.senderRotationDecisionId,
  })

  if (!claimed) {
    return {
      ok: false,
      code: "assignment_claim_unavailable",
      message: "Sender assignment claim is unavailable.",
    }
  }

  const readiness = await ensureAssignedSenderReadyForSend(admin, {
    assignment: claimed.assignment,
    recipientEmail: input.recipientEmailForChecks ?? input.contactEmail,
    forAssignment,
  })
  if (!readiness.ok) return readiness

  return {
    ok: true,
    assignment: claimed.assignment,
    senderAccountId: claimed.assignment.senderAccountId,
    mailboxConnectionId: claimed.assignment.mailboxConnectionId,
    senderEmail: claimed.assignment.senderEmail,
    providerFamily: claimed.assignment.providerFamily,
    created: claimed.created,
  }
}

async function ensureAssignedSenderReadyForSend(
  admin: SupabaseClient,
  input: {
    assignment: OutboundSenderAssignment
    recipientEmail: string
    forAssignment?: boolean
  },
): Promise<{ ok: true } | { ok: false; code: string; message: string; reconnectRequired?: boolean }> {
  const mailboxReady = input.forAssignment
    ? await ensureMailboxEligibleForSenderAssignment(admin, input.assignment.senderAccountId)
    : await ensureMailboxReadyForOutboundSend(admin, input.assignment.senderAccountId)
  if (!mailboxReady.ok) {
    if (mailboxReady.reconnectRequired) {
      await updateOutboundSenderAssignmentStatus(admin, input.assignment.id, {
        status: "blocked_reconnect",
      }).catch(() => undefined)
    }
    return {
      ok: false,
      code: mailboxReady.code,
      message: mailboxReady.message,
      reconnectRequired: mailboxReady.reconnectRequired,
    }
  }

  const infrastructure = await evaluatePreSendInfrastructureAllowed(admin, {
    senderAccountId: input.assignment.senderAccountId,
    senderPoolId: input.assignment.senderPoolId,
    recipientEmail: input.recipientEmail,
    mailboxReadinessMode: input.forAssignment ? "assignment" : "transport",
  })

  if (!infrastructure.allowed) {
    if (infrastructure.blockCode === "daily_cap_exhausted") {
      await updateOutboundSenderAssignmentStatus(admin, input.assignment.id, {
        status: "paused_capacity",
      }).catch(() => undefined)
      return {
        ok: false,
        code: "daily_cap_exhausted",
        message: infrastructure.reason ?? "Assigned sender daily cap exhausted.",
      }
    }

    return {
      ok: false,
      code: infrastructure.blockCode ?? "sender_unavailable",
      message: infrastructure.reason ?? "Assigned sender is unavailable.",
      reconnectRequired: infrastructure.blockCode === "mailbox_unhealthy",
    }
  }

  return { ok: true }
}

export async function resolveOutboundSenderFromAffinity(
  admin: SupabaseClient,
  input: {
    organizationId: string
    leadId: string
    contactEmail: string
    recipientEmailForChecks?: string
  },
): Promise<ResolveOutboundSenderAffinityResult> {
  return resolveOrAssignOutboundSenderAffinity(admin, input)
}
