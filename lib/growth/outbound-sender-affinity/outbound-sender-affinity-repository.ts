/**
 * AVA-MAILBOX-RELIABILITY-AND-AFFINITY-1A — Outbound sender assignment persistence (server-only).
 */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  normalizeOutboundContactEmail,
  type OutboundSenderAssignment,
  type OutboundSenderAssignmentKey,
  type OutboundSenderAssignmentStatus,
} from "@/lib/growth/outbound-sender-affinity/outbound-sender-affinity-types"

const SELECT =
  "id, organization_id, lead_id, contact_email, sender_account_id, mailbox_connection_id, sender_email, provider_family, assignment_source, assignment_strategy, sender_pool_id, sender_rotation_decision_id, status, assigned_at, last_used_at, migration_metadata"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function mapAssignment(row: Record<string, unknown>): OutboundSenderAssignment {
  return {
    id: asString(row.id),
    organizationId: asString(row.organization_id),
    leadId: asString(row.lead_id),
    contactEmail: asString(row.contact_email),
    senderAccountId: asString(row.sender_account_id),
    mailboxConnectionId: asString(row.mailbox_connection_id) || null,
    senderEmail: asString(row.sender_email),
    providerFamily: asString(row.provider_family),
    assignmentSource: asString(row.assignment_source) as OutboundSenderAssignment["assignmentSource"],
    assignmentStrategy: asString(row.assignment_strategy) || null,
    senderPoolId: asString(row.sender_pool_id) || null,
    senderRotationDecisionId: asString(row.sender_rotation_decision_id) || null,
    status: asString(row.status) as OutboundSenderAssignmentStatus,
    assignedAt: asString(row.assigned_at),
    lastUsedAt: asString(row.last_used_at) || null,
    migrationMetadata:
      row.migration_metadata && typeof row.migration_metadata === "object"
        ? (row.migration_metadata as Record<string, unknown>)
        : {},
  }
}

export async function fetchActiveOutboundSenderAssignment(
  admin: SupabaseClient,
  key: OutboundSenderAssignmentKey,
): Promise<OutboundSenderAssignment | null> {
  const contactEmailNormalized = normalizeOutboundContactEmail(key.contactEmail)
  const { data, error } = await admin
    .schema("growth")
    .from("outbound_sender_assignments")
    .select(SELECT)
    .eq("organization_id", key.organizationId)
    .eq("lead_id", key.leadId)
    .eq("contact_email_normalized", contactEmailNormalized)
    .eq("status", "active")
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data ? mapAssignment(data as Record<string, unknown>) : null
}

export async function claimOutboundSenderAssignment(
  admin: SupabaseClient,
  input: {
    organizationId: string
    leadId: string
    contactEmail: string
    senderAccountId: string
    mailboxConnectionId: string | null
    senderEmail: string
    providerFamily: string
    assignmentSource: OutboundSenderAssignment["assignmentSource"]
    assignmentStrategy?: string | null
    senderPoolId?: string | null
    senderRotationDecisionId?: string | null
  },
): Promise<{ assignment: OutboundSenderAssignment; created: boolean } | null> {
  const payload = {
    organization_id: input.organizationId,
    lead_id: input.leadId,
    contact_email: input.contactEmail,
    sender_account_id: input.senderAccountId,
    mailbox_connection_id: input.mailboxConnectionId ?? "",
    sender_email: input.senderEmail,
    provider_family: input.providerFamily,
    assignment_source: input.assignmentSource,
    assignment_strategy: input.assignmentStrategy ?? "",
    sender_pool_id: input.senderPoolId ?? "",
    sender_rotation_decision_id: input.senderRotationDecisionId ?? "",
    assigned_at: new Date().toISOString(),
    last_used_at: new Date().toISOString(),
  }

  const { data, error } = await admin.schema("growth").rpc("claim_outbound_sender_assignment", {
    p_assignment: payload,
  })

  if (error) {
    if (error.message.includes("claim_outbound_sender_assignment")) {
      return null
    }
    throw new Error(error.message)
  }

  const result = data as {
    ok?: boolean
    assignment?: Record<string, unknown>
    created?: boolean
  } | null

  if (!result?.ok || !result.assignment) return null
  return {
    assignment: mapAssignment(result.assignment),
    created: Boolean(result.created),
  }
}

export async function touchOutboundSenderAssignmentLastUsed(
  admin: SupabaseClient,
  assignmentId: string,
): Promise<void> {
  const now = new Date().toISOString()
  const { error } = await admin
    .schema("growth")
    .from("outbound_sender_assignments")
    .update({ last_used_at: now, updated_at: now })
    .eq("id", assignmentId)
    .eq("status", "active")
  if (error) throw new Error(error.message)
}

export async function updateOutboundSenderAssignmentStatus(
  admin: SupabaseClient,
  assignmentId: string,
  input: {
    status: OutboundSenderAssignmentStatus
    migrationMetadata?: Record<string, unknown>
  },
): Promise<OutboundSenderAssignment | null> {
  const patch: Record<string, unknown> = {
    status: input.status,
    updated_at: new Date().toISOString(),
  }
  if (input.migrationMetadata) patch.migration_metadata = input.migrationMetadata

  const { data, error } = await admin
    .schema("growth")
    .from("outbound_sender_assignments")
    .update(patch)
    .eq("id", assignmentId)
    .select(SELECT)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data ? mapAssignment(data as Record<string, unknown>) : null
}
