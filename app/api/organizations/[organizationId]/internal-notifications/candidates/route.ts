import { NextResponse } from "next/server"
import { requireAnyOrgPermission, requireOrgPermission } from "@/lib/api/require-org-permission"
import { evaluateInternalNotificationRules } from "@/lib/internal-notifications/evaluate"
import { applyInternalNotificationViewerGates } from "@/lib/internal-notifications/filter-for-viewer"
import { mapEscalationRuleRow } from "@/lib/internal-notifications/map-row"
import { upsertInternalNotificationLogRows } from "@/lib/internal-notifications/sync-log"
import type { InternalEscalationRuleRow } from "@/lib/internal-notifications/types"
import { isAssignedWorkOnly, loadAssignedWorkScope } from "@/lib/permissions/technician-scope"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function jsonError(message: string, status: number, code?: string) {
  return NextResponse.json({ ok: false, error: code ?? "error", message }, { status })
}

export async function GET(request: Request, context: { params: Promise<{ organizationId: string }> }) {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) return jsonError("Invalid organization.", 400)

  const gate = await requireAnyOrgPermission(organizationId, [
    "canViewAllWorkOrders",
    "canViewAssignedWorkOrdersOnly",
  ])
  if ("error" in gate) return gate.error

  const syncLog = new URL(request.url).searchParams.get("syncLog") === "1"

  const { data: ruleRows, error: rulesErr } = await gate.supabase
    .from("internal_escalation_rules")
    .select("*")
    .eq("organization_id", organizationId)

  if (rulesErr) return jsonError(rulesErr.message, 500, "query_failed")

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

  const allowFinancialQueries = Boolean(gate.permissions.canViewFinancials || gate.permissions.canViewBilling)

  const raw = await evaluateInternalNotificationRules({
    supabase: gate.supabase,
    organizationId,
    rules,
    now: new Date(),
    allowFinancialQueries,
  })

  const candidates = applyInternalNotificationViewerGates({
    items: raw,
    rules,
    permissions: gate.permissions,
    assignedWorkOnly: isAssignedWorkOnly(gate.permissions),
    assignedScope,
    userId: gate.userId,
    userRawRole: gate.role,
  })

  if (syncLog) {
    const mgr = await requireOrgPermission(organizationId, "canManageWorkspaceSettings")
    if (!("error" in mgr)) {
      const syncResult = await upsertInternalNotificationLogRows(
        mgr.supabase,
        organizationId,
        candidates,
        new Date().toISOString(),
      )
      if (syncResult.error) {
        return jsonError(syncResult.error, 500, "sync_failed")
      }
    }
  }

  return NextResponse.json({
    ok: true,
    candidates,
    ruleCount: rules.length,
    enabledRuleCount: rules.filter((r) => r.enabled).length,
  })
}
