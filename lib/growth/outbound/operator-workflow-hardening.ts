import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { recordInternalOutboundAuditEvent } from "@/lib/growth/operations/internal-outbound-audit"
import { acknowledgeOperationalAlert } from "@/lib/growth/outbound/operational-alerting"
import { recordLifecycleTransition } from "@/lib/growth/outbound/inbox-lifecycle-engine"
import type { GrowthInboxLifecycleStage } from "@/lib/growth/outbound/lifecycle-ops-types"

export async function acknowledgeMaintenanceTask(
  admin: SupabaseClient,
  input: { taskId: string; acknowledgedBy: string; actorEmail?: string },
): Promise<void> {
  const now = new Date().toISOString()
  await admin
    .schema("growth")
    .from("maintenance_tasks")
    .update({
      status: "acknowledged",
      acknowledged_at: now,
      acknowledged_by: input.acknowledgedBy,
      updated_at: now,
    })
    .eq("id", input.taskId)

  await recordInternalOutboundAuditEvent(admin, {
    eventType: "sender_cooldown_applied",
    severity: "low",
    title: "Maintenance task acknowledged",
    summary: `Task ${input.taskId} acknowledged by operator.`,
    actorUserId: input.acknowledgedBy,
    actorEmail: input.actorEmail,
    metadata: { maintenance_task_id: input.taskId, acknowledgement: true },
  })
}

export async function recordOperatorLifecycleOverride(
  admin: SupabaseClient,
  input: {
    senderAccountId: string
    mailboxConnectionId?: string | null
    fromStage: GrowthInboxLifecycleStage | null
    toStage: GrowthInboxLifecycleStage
    reason: string
    actorUserId: string
    actorEmail?: string
  },
): Promise<void> {
  await admin
    .schema("growth")
    .from("sender_accounts")
    .update({
      lifecycle_stage: input.toStage,
      lifecycle_stage_override: true,
      lifecycle_stage_note: input.reason.slice(0, 500),
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.senderAccountId)

  await recordLifecycleTransition(admin, {
    ...input,
    operatorOverride: true,
  })

  await recordInternalOutboundAuditEvent(admin, {
    eventType: "domain_risk_alert",
    severity: "medium",
    title: "Lifecycle override applied",
    summary: input.reason,
    senderAccountId: input.senderAccountId,
    actorUserId: input.actorUserId,
    actorEmail: input.actorEmail,
    metadata: { operator_override: true, to_stage: input.toStage },
  })
}

export async function recordDomainOverrideAudit(
  admin: SupabaseClient,
  input: {
    domainId: string
    reason: string
    actorUserId: string
    actorEmail?: string
    metadata?: Record<string, unknown>
  },
): Promise<void> {
  await recordInternalOutboundAuditEvent(admin, {
    eventType: "domain_risk_alert",
    severity: "high",
    title: "Domain override logged",
    summary: input.reason,
    senderDomainId: input.domainId,
    actorUserId: input.actorUserId,
    actorEmail: input.actorEmail,
    metadata: { domain_override: true, ...(input.metadata ?? {}) },
  })
}

export async function recordSenderPauseReasonAudit(
  admin: SupabaseClient,
  input: {
    senderAccountId: string
    reason: string
    actorUserId: string
    actorEmail?: string
  },
): Promise<void> {
  await recordInternalOutboundAuditEvent(admin, {
    eventType: "sender_operational_pause",
    severity: "high",
    title: "Sender pause reason recorded",
    summary: input.reason,
    senderAccountId: input.senderAccountId,
    actorUserId: input.actorUserId,
    actorEmail: input.actorEmail,
    metadata: { pause_reason_audit: true },
  })
}

export async function acknowledgeOperationalAlertWithAudit(
  admin: SupabaseClient,
  input: { alertId: string; acknowledgedBy: string; actorEmail?: string },
): Promise<void> {
  await acknowledgeOperationalAlert(admin, input)
  await recordInternalOutboundAuditEvent(admin, {
    eventType: "cron_execution_failed",
    severity: "low",
    title: "Operational alert acknowledged",
    summary: `Alert ${input.alertId} acknowledged.`,
    actorUserId: input.acknowledgedBy,
    actorEmail: input.actorEmail,
    metadata: { alert_id: input.alertId, alert_acknowledgement: true },
  })
}
