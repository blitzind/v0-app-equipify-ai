import { NextResponse } from "next/server"
import { z } from "zod"
import { insertActionAuditLog } from "@/lib/aiden/actions/action-audit-log"
import {
  fetchAidenOrgApprovalSettings,
  upsertAidenOrgApprovalSettings,
} from "@/lib/aiden/actions/aiden-org-approval-settings-repository"
import { requireOrgPermission } from "@/lib/api/require-org-permission"
import { getServiceRoleOrNull, UUID_RE } from "@/lib/aiden/prepared-actions/prepared-actions-api-helpers"

export const runtime = "nodejs"

function serializeSettings(row: {
  allow_financial_aiden_actions: boolean
  require_owner_approval_for_bulk_financial_actions: boolean
  max_bulk_action_count: number | null
  max_financial_action_amount_without_owner_approval: number | string | null
}) {
  const maxAmt = row.max_financial_action_amount_without_owner_approval
  const maxAmtNum =
    maxAmt === null || maxAmt === undefined ? null : typeof maxAmt === "number" ? maxAmt : Number(maxAmt)
  return {
    allowFinancialAidenActions: row.allow_financial_aiden_actions,
    requireOwnerApprovalForBulkFinancialActions: row.require_owner_approval_for_bulk_financial_actions,
    maxBulkActionCount: row.max_bulk_action_count,
    maxFinancialActionAmountWithoutOwnerApproval:
      maxAmtNum !== null && Number.isFinite(maxAmtNum) ? maxAmtNum : null,
  }
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ organizationId: string }> },
) {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) {
    return NextResponse.json({ error: "bad_request", message: "Invalid organization id." }, { status: 400 })
  }

  const gate = await requireOrgPermission(organizationId, "canManageWorkspaceSettings")
  if ("error" in gate) return gate.error

  const loaded = await fetchAidenOrgApprovalSettings(gate.supabase, organizationId)
  if (loaded.error || !loaded.data) {
    return NextResponse.json(
      { error: "query_failed", message: loaded.error?.message ?? "Could not load settings." },
      { status: 500 },
    )
  }

  return NextResponse.json({
    settings: serializeSettings({
      allow_financial_aiden_actions: loaded.data.allow_financial_aiden_actions,
      require_owner_approval_for_bulk_financial_actions: loaded.data.require_owner_approval_for_bulk_financial_actions,
      max_bulk_action_count: loaded.data.max_bulk_action_count,
      max_financial_action_amount_without_owner_approval: loaded.data.max_financial_action_amount_without_owner_approval,
    }),
  })
}

const PatchBodySchema = z.object({
  allowFinancialAidenActions: z.boolean().optional(),
  requireOwnerApprovalForBulkFinancialActions: z.boolean().optional(),
  maxBulkActionCount: z.number().int().min(1).max(500).nullable().optional(),
  maxFinancialActionAmountWithoutOwnerApproval: z.number().min(0).nullable().optional(),
})

export async function PATCH(
  request: Request,
  context: { params: Promise<{ organizationId: string }> },
) {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) {
    return NextResponse.json({ error: "bad_request", message: "Invalid organization id." }, { status: 400 })
  }

  const gate = await requireOrgPermission(organizationId, "canManageWorkspaceSettings")
  if ("error" in gate) return gate.error

  const svc = getServiceRoleOrNull()
  if (!svc) {
    return NextResponse.json({ error: "server_misconfigured", message: "Server is not configured." }, { status: 503 })
  }

  let body: z.infer<typeof PatchBodySchema>
  try {
    const raw = await request.json().catch(() => ({}))
    body = PatchBodySchema.parse(raw)
  } catch {
    return NextResponse.json({ error: "bad_request", message: "Invalid JSON body." }, { status: 400 })
  }

  const up = await upsertAidenOrgApprovalSettings(svc, organizationId, {
    allow_financial_aiden_actions: body.allowFinancialAidenActions,
    require_owner_approval_for_bulk_financial_actions: body.requireOwnerApprovalForBulkFinancialActions,
    max_bulk_action_count: body.maxBulkActionCount,
    max_financial_action_amount_without_owner_approval: body.maxFinancialActionAmountWithoutOwnerApproval,
  })
  if (up.error || !up.data) {
    return NextResponse.json(
      { error: "update_failed", message: up.error?.message ?? "Update failed." },
      { status: 500 },
    )
  }

  const audit = await insertActionAuditLog(svc, {
    organization_id: organizationId,
    prepared_action_id: null,
    actor_user_id: gate.userId,
    event_type: "aiden_org_approval_settings_updated",
    action_id: null,
    details: {
      patch: body,
      next: serializeSettings(up.data),
    },
  })
  if (audit.error) {
    return NextResponse.json({ error: "audit_failed", message: audit.error.message }, { status: 500 })
  }

  return NextResponse.json({ settings: serializeSettings(up.data) })
}
