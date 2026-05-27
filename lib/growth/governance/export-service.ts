import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { maskComplianceEmailHash } from "@/lib/growth/compliance/compliance-types"
import { appendGovernanceApprovalAudit } from "@/lib/growth/governance/approval-audit"
import { appendGovernancePolicyEvent } from "@/lib/growth/governance/governance-events"
import {
  assertGovernancePolicyAllowed,
  type GovernanceEvaluationInput,
} from "@/lib/growth/governance/policy-engine"
import {
  sanitizeGovernanceExportValue,
  type GrowthGovernanceExportRecord,
  type GrowthGovernanceExportType,
} from "@/lib/growth/governance/governance-types"
import { listGovernanceApprovalAudit } from "@/lib/growth/governance/approval-audit"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function exportFileLabel(exportType: GrowthGovernanceExportType): string {
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")
  return `growth-${exportType}-${stamp}.json`
}

async function buildComplianceExportPayload(admin: SupabaseClient) {
  const { data: suppressions } = await admin
    .schema("growth")
    .from("delivery_suppressions")
    .select("email_hash, reason, active, created_at")
    .eq("active", true)
    .order("created_at", { ascending: false })
    .limit(500)
  return {
    exportKind: "compliance_export",
    rows: ((suppressions ?? []) as Record<string, unknown>[]).map((row) => ({
      emailHash: maskComplianceEmailHash(asString(row.email_hash)),
      reason: asString(row.reason),
      active: Boolean(row.active),
      createdAt: asString(row.created_at),
    })),
  }
}

async function buildSuppressionExportPayload(admin: SupabaseClient) {
  const { data: suppressions } = await admin
    .schema("growth")
    .from("delivery_suppressions")
    .select("email_hash, reason, active, created_at, lead_id")
    .order("created_at", { ascending: false })
    .limit(500)
  return {
    exportKind: "suppression_export",
    rows: ((suppressions ?? []) as Record<string, unknown>[]).map((row) => ({
      emailHash: maskComplianceEmailHash(asString(row.email_hash)),
      reason: asString(row.reason),
      active: Boolean(row.active),
      createdAt: asString(row.created_at),
    })),
  }
}

async function buildApprovalAuditExportPayload(admin: SupabaseClient) {
  const audit = await listGovernanceApprovalAudit(admin, { limit: 500 })
  return {
    exportKind: "approval_audit_export",
    rows: audit.map((row) => ({
      actorEmail: row.actorEmail,
      action: row.action,
      entityType: row.entityType,
      entityId: row.entityId,
      sourceRoute: row.sourceRoute,
      approvalReason: row.approvalReason,
      riskFlags: row.riskFlags,
      recordedAt: row.recordedAt,
    })),
  }
}

async function buildDeliveryAuditExportPayload(admin: SupabaseClient) {
  const { data: attempts } = await admin
    .schema("growth")
    .from("delivery_attempts")
    .select("id, status, provider_id, sender_account_id, lead_id, created_at")
    .order("created_at", { ascending: false })
    .limit(500)
  return {
    exportKind: "delivery_audit_export",
    rows: ((attempts ?? []) as Record<string, unknown>[]).map((row) => ({
      id: asString(row.id),
      status: asString(row.status),
      providerId: asString(row.provider_id),
      senderAccountId: asString(row.sender_account_id),
      leadId: asString(row.lead_id),
      createdAt: asString(row.created_at),
    })),
  }
}

async function buildActivityExportPayload(admin: SupabaseClient) {
  const { data: events } = await admin
    .schema("growth")
    .from("governance_policy_events")
    .select("event_type, severity, title, description, actor_email, recorded_at")
    .order("recorded_at", { ascending: false })
    .limit(500)
  return {
    exportKind: "activity_export",
    rows: ((events ?? []) as Record<string, unknown>[]).map((row) => ({
      eventType: asString(row.event_type),
      severity: asString(row.severity),
      title: asString(row.title),
      description: asString(row.description),
      actorEmail: asString(row.actor_email),
      recordedAt: asString(row.recorded_at),
    })),
  }
}

async function buildExportPayload(admin: SupabaseClient, exportType: GrowthGovernanceExportType) {
  switch (exportType) {
    case "compliance_export":
      return buildComplianceExportPayload(admin)
    case "suppression_export":
      return buildSuppressionExportPayload(admin)
    case "approval_audit_export":
      return buildApprovalAuditExportPayload(admin)
    case "delivery_audit_export":
      return buildDeliveryAuditExportPayload(admin)
    case "activity_export":
    default:
      return buildActivityExportPayload(admin)
  }
}

function isComplianceExport(exportType: GrowthGovernanceExportType): boolean {
  return exportType === "compliance_export" || exportType === "suppression_export"
}

export async function generateGovernanceExport(
  admin: SupabaseClient,
  input: {
    exportType: GrowthGovernanceExportType
    actorUserId: string
    actorEmail: string
    sourceRoute: string
    approvalReason?: string
  },
): Promise<GrowthGovernanceExportRecord> {
  const evaluation = await assertGovernancePolicyAllowed(admin, {
    action: "export_generate",
    actorUserId: input.actorUserId,
    actorEmail: input.actorEmail,
    sourceRoute: input.sourceRoute,
    approvalReason: input.approvalReason,
    humanApprovalConfirmed: true,
  } satisfies GovernanceEvaluationInput)

  await appendGovernanceApprovalAudit(admin, {
    actorUserId: input.actorUserId,
    actorEmail: input.actorEmail,
    action: "export_generate",
    entityType: "export",
    sourceRoute: input.sourceRoute,
    approvalReason: input.approvalReason,
    evaluation,
  })

  const rawPayload = await buildExportPayload(admin, input.exportType)
  const sanitizedPayload = sanitizeGovernanceExportValue(rawPayload) as Record<string, unknown>
  const rows = Array.isArray(sanitizedPayload.rows) ? sanitizedPayload.rows : []
  const now = new Date().toISOString()
  const fileLabel = exportFileLabel(input.exportType)

  await appendGovernancePolicyEvent(admin, {
    eventType: "export_requested",
    severity: "info",
    title: "Governance export requested",
    description: input.exportType,
    actorUserId: input.actorUserId,
    actorEmail: input.actorEmail,
    metadata: { exportType: input.exportType },
  })

  const baseRecord = {
    export_type: input.exportType,
    status: "completed",
    requested_by: input.actorUserId,
    requested_by_email: input.actorEmail,
    file_label: fileLabel,
    row_count: rows.length,
    sanitized_payload: sanitizedPayload,
    metadata: { sourceRoute: input.sourceRoute },
    completed_at: now,
  }

  const table = isComplianceExport(input.exportType)
    ? admin.schema("growth").from("governance_compliance_exports")
    : admin.schema("growth").from("governance_activity_exports")

  const { data, error } = await table.insert(baseRecord).select("*").single()
  if (error) throw new Error(error.message)

  await appendGovernancePolicyEvent(admin, {
    eventType: "export_completed",
    severity: "info",
    title: "Governance export completed",
    description: `${input.exportType} (${rows.length} rows)`,
    actorUserId: input.actorUserId,
    actorEmail: input.actorEmail,
    metadata: { exportId: asString((data as Record<string, unknown>).id) },
  })

  return mapExportRecord(data as Record<string, unknown>, input.exportType)
}

function mapExportRecord(row: Record<string, unknown>, exportType: GrowthGovernanceExportType): GrowthGovernanceExportRecord {
  return {
    id: asString(row.id),
    exportType,
    status: asString(row.status) as GrowthGovernanceExportRecord["status"],
    fileLabel: asString(row.file_label),
    rowCount: Number(row.row_count ?? 0),
    requestedByEmail: asString(row.requested_by_email),
    completedAt: asString(row.completed_at) || null,
    createdAt: asString(row.created_at),
  }
}

export async function listGovernanceExports(admin: SupabaseClient, input?: { limit?: number }) {
  const limit = input?.limit ?? 50
  const [activity, compliance] = await Promise.all([
    admin.schema("growth").from("governance_activity_exports").select("*").order("created_at", { ascending: false }).limit(limit),
    admin.schema("growth").from("governance_compliance_exports").select("*").order("created_at", { ascending: false }).limit(limit),
  ])
  if (activity.error) throw new Error(activity.error.message)
  if (compliance.error) throw new Error(compliance.error.message)

  const rows: GrowthGovernanceExportRecord[] = [
    ...((activity.data ?? []) as Record<string, unknown>[]).map((row) =>
      mapExportRecord(row, asString(row.export_type) as GrowthGovernanceExportType),
    ),
    ...((compliance.data ?? []) as Record<string, unknown>[]).map((row) =>
      mapExportRecord(row, asString(row.export_type) as GrowthGovernanceExportType),
    ),
  ]
  return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit)
}
