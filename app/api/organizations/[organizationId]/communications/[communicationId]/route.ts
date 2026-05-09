import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { isPlatformAdminEmail } from "@/lib/platform-admin-policy"
import { getOrgPermissionsForRole, normalizeOrgMemberRole } from "@/lib/permissions/model"
import { getOrganizationMemberRole } from "@/lib/api/org-role"
import { deriveCommunicationCenterKind } from "@/lib/communications/communication-kind"
import { communicationEventInAssignedScope } from "@/lib/communications/feed-scope"
import {
  categorizeRow,
  isAiGeneratedRow,
  isAutomatedRow,
  isFinancialRow,
  isSimulatedRow,
} from "@/lib/communications/feed"
import {
  isAssignedWorkOnly,
  loadAssignedWorkScope,
} from "@/lib/permissions/technician-scope"
import type { CommunicationEventRow } from "@/lib/notifications/types"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status })
}

/**
 * Single-event detail for the right-side drawer. Returns the full
 * row plus light enrichments (entity label, automation source). Raw
 * `metadata` is only included for managers and above so technicians
 * never see provider IDs or automation internals.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ organizationId: string; communicationId: string }> },
) {
  const { organizationId, communicationId } = await context.params
  if (!UUID_RE.test(organizationId) || !UUID_RE.test(communicationId)) {
    return jsonError("Invalid identifier.", 400)
  }

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.email) return jsonError("Unauthorized.", 401)

  const isPlatformAdmin = isPlatformAdminEmail(user.email)
  const rawRole = isPlatformAdmin
    ? "owner"
    : await getOrganizationMemberRole(supabase, user.id, organizationId)
  const role = normalizeOrgMemberRole(rawRole)
  if (!role && !isPlatformAdmin) return jsonError("Forbidden.", 403)
  const permissions = getOrgPermissionsForRole(role)
  if (!permissions.canViewCommunications && !isPlatformAdmin) {
    return jsonError("Forbidden.", 403)
  }

  const { data, error } = await supabase
    .from("communication_events")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("id", communicationId)
    .maybeSingle()

  if (error) return jsonError(error.message, 500)
  if (!data) return jsonError("Communication not found.", 404)

  const row = data as CommunicationEventRow

  const canBilling =
    Boolean(permissions.canViewFinancials || permissions.canViewBilling) || isPlatformAdmin
  if (isFinancialRow(row) && !canBilling) {
    return jsonError("This communication is restricted to roles with billing access.", 403)
  }

  if (!isPlatformAdmin && isAssignedWorkOnly(permissions)) {
    const scope = await loadAssignedWorkScope(supabase, {
      organizationId,
      userId: user.id,
    })
    if (!communicationEventInAssignedScope(row, scope)) {
      return jsonError("Forbidden.", 403)
    }
  }

  const showRawMetadata = Boolean(
    permissions.canManageCommunications || permissions.canManageSettings || isPlatformAdmin,
  )

  // Resolve a lightweight customer/entity label so the drawer header
  // can show "INV-1024 → Acme Industrial" without a second round-trip.
  const labels: Record<string, string | null> = {}
  if (row.recipient_customer_id) {
    const { data: cust } = await supabase
      .from("customers")
      .select("id, company")
      .eq("organization_id", organizationId)
      .eq("id", row.recipient_customer_id)
      .maybeSingle()
    if (cust) labels.customer = (cust as { company: string | null }).company
  }
  if (row.related_entity_id && row.related_entity_type) {
    const projection = projectionForEntity(row.related_entity_type)
    if (projection) {
      const { data: e } = await supabase
        .from(projection.table)
        .select(projection.columns)
        .eq("organization_id", organizationId)
        .eq("id", row.related_entity_id)
        .maybeSingle()
      if (e) labels.entity = projection.toLabel(e as Record<string, unknown>)
    }
  }

  return NextResponse.json({
    item: {
      ...row,
      metadata: showRawMetadata ? row.metadata : null,
      automated: isAutomatedRow(row),
      ai_generated: isAiGeneratedRow(row),
      simulated: isSimulatedRow(row),
      communication_kind: deriveCommunicationCenterKind(row),
      category: categorizeRow(row),
      entity_label: labels.entity ?? null,
      customer_label: labels.customer ?? null,
    },
    showRawMetadata,
  })
}

function projectionForEntity(type: string): {
  table: string
  columns: string
  toLabel: (row: Record<string, unknown>) => string | null
} | null {
  switch (type) {
    case "work_order":
      return {
        table: "work_orders",
        columns: "id, work_order_number, title",
        toLabel: (r) => {
          const num = r.work_order_number as string | null
          const title = r.title as string | null
          if (num && title) return `${num} · ${title}`
          return num ?? title ?? null
        },
      }
    case "invoice":
      return {
        table: "invoices",
        columns: "id, invoice_number",
        toLabel: (r) => (r.invoice_number as string | null) ?? null,
      }
    case "quote":
      return {
        table: "quotes",
        columns: "id, quote_number",
        toLabel: (r) => (r.quote_number as string | null) ?? null,
      }
    case "customer":
      return {
        table: "customers",
        columns: "id, company",
        toLabel: (r) => (r.company as string | null) ?? null,
      }
    case "prospect":
      return {
        table: "prospects",
        columns: "id, company_name",
        toLabel: (r) => (r.company_name as string | null) ?? null,
      }
    case "equipment":
      return {
        table: "equipment",
        columns: "id, name",
        toLabel: (r) => (r.name as string | null) ?? null,
      }
    case "maintenance_plan":
      return {
        table: "maintenance_plans",
        columns: "id, name",
        toLabel: (r) => (r.name as string | null) ?? null,
      }
    default:
      return null
  }
}
