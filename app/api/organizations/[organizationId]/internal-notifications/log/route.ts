import { NextResponse } from "next/server"
import { requireAnyOrgPermission } from "@/lib/api/require-org-permission"
import { applyInternalNotificationViewerGates } from "@/lib/internal-notifications/filter-for-viewer"
import { mapEscalationRuleRow } from "@/lib/internal-notifications/map-row"
import type { InternalEscalationRuleRow, InternalNotificationCandidate } from "@/lib/internal-notifications/types"
import { isAssignedWorkOnly, loadAssignedWorkScope } from "@/lib/permissions/technician-scope"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function jsonError(message: string, status: number, code?: string) {
  return NextResponse.json({ ok: false, error: code ?? "error", message }, { status })
}

function logRowToCandidate(row: Record<string, unknown>): InternalNotificationCandidate {
  const entityType = (row.entity_type as InternalNotificationCandidate["entityType"]) ?? null
  const entityId = (row.entity_id as string | null) ?? null
  const meta = row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata) ? row.metadata : {}
  const href = typeof (meta as { href?: unknown }).href === "string" ? (meta as { href: string }).href : null

  return {
    dedupeKey: row.dedupe_key as string,
    eventType: row.event_type as InternalNotificationCandidate["eventType"],
    ruleId: (row.rule_id as string) ?? "",
    title: row.title as string,
    body: (row.body as string) ?? "",
    severity: row.severity as InternalNotificationCandidate["severity"],
    href,
    entityType,
    entityId,
    customerId: (row.customer_id as string | null) ?? null,
    equipmentId: entityType === "equipment" ? entityId : null,
    workOrderId: entityType === "work_order" ? entityId : null,
  }
}

export async function GET(request: Request, context: { params: Promise<{ organizationId: string }> }) {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) return jsonError("Invalid organization.", 400)

  const gate = await requireAnyOrgPermission(organizationId, [
    "canViewAllWorkOrders",
    "canViewAssignedWorkOrdersOnly",
  ])
  if ("error" in gate) return gate.error

  const limit = Math.min(Math.max(Number.parseInt(new URL(request.url).searchParams.get("limit") ?? "80", 10) || 80, 1), 200)

  const [{ data: ruleRows }, { data: logRows, error }] = await Promise.all([
    gate.supabase.from("internal_escalation_rules").select("*").eq("organization_id", organizationId),
    gate.supabase
      .from("internal_notification_log")
      .select("*")
      .eq("organization_id", organizationId)
      .order("last_seen_at", { ascending: false })
      .limit(limit),
  ])

  if (error) return jsonError(error.message, 500, "query_failed")

  const rules: InternalEscalationRuleRow[] = (ruleRows ?? []).map((r) =>
    mapEscalationRuleRow(r as Record<string, unknown>),
  )

  let assignedScope = null as Awaited<ReturnType<typeof loadAssignedWorkScope>> | null
  if (isAssignedWorkOnly(gate.permissions)) {
    assignedScope = await loadAssignedWorkScope(gate.supabase, {
      organizationId,
      userId: gate.userId,
    })
  }

  const rows = (logRows ?? []) as Array<Record<string, unknown>>
  const asCandidates = rows.map((r) => logRowToCandidate(r))
  const gated = applyInternalNotificationViewerGates({
    items: asCandidates,
    rules,
    permissions: gate.permissions,
    assignedWorkOnly: isAssignedWorkOnly(gate.permissions),
    assignedScope,
    userId: gate.userId,
    userRawRole: gate.role,
  })
  const allow = new Set(gated.map((c) => c.dedupeKey))
  const items = rows
    .filter((r) => allow.has(r.dedupe_key as string))
    .map((row) => ({
      ...logRowToCandidate(row),
      lastSeenAt: row.last_seen_at as string,
      firstSeenAt: row.first_seen_at as string,
    }))

  return NextResponse.json({
    ok: true,
    items,
    rawCount: rows.length,
  })
}
