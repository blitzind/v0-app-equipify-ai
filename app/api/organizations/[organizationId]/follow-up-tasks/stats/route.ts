import { NextResponse } from "next/server"
import { filterFollowUpTasksForViewer } from "@/lib/follow-up-automation/filter-view"
import { isMaintenanceReminderRuleKey } from "@/lib/follow-up-automation/maintenance-rules"
import type { FollowUpTaskRow } from "@/lib/follow-up-automation/types"
import { requireOrgPermission } from "@/lib/api/require-org-permission"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status })
}

function isMaintenanceFollowUpRow(r: FollowUpTaskRow): boolean {
  return r.entity_type === "maintenance_plan" || isMaintenanceReminderRuleKey(r.rule_key)
}

function draftLooksReady(draft: unknown): boolean {
  const d = draft as Record<string, unknown> | null | undefined
  if (!d || typeof d !== "object") return false
  const sub = typeof d.subject === "string" ? d.subject.trim() : ""
  const bod = typeof d.body === "string" ? d.body.trim() : ""
  return Boolean(sub && bod)
}

export async function GET(_request: Request, context: { params: Promise<{ organizationId: string }> }) {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) return jsonError("Invalid organization.", 400)

  const gate = await requireOrgPermission(organizationId, "canViewCommunications")
  if ("error" in gate) return gate.error

  const { data, error } = await gate.supabase
    .from("follow_up_tasks")
    .select("*")
    .eq("organization_id", organizationId)
    .in("status", ["pending", "approved"])
    .order("created_at", { ascending: false })
    .limit(400)

  if (error) return jsonError(error.message, 500)

  const rows = (data ?? []) as FollowUpTaskRow[]
  const filtered = filterFollowUpTasksForViewer(rows, gate.permissions, gate.userId)
  const now = Date.now()

  let overdueReminders = 0
  let invoicePending = 0
  let proposalFollowUps = 0
  let maintenanceRemindersPending = 0
  let maintenanceRemindersOverdue = 0
  let maintenanceRemindersDraftReady = 0

  for (const r of filtered) {
    if (r.scheduled_for && Date.parse(r.scheduled_for) < now) overdueReminders++
    if (r.entity_type === "invoice") invoicePending++
    if (r.rule_key === "prospect_proposal_no_response") proposalFollowUps++

    if (isMaintenanceFollowUpRow(r)) {
      if (r.status === "pending") {
        maintenanceRemindersPending++
        if (draftLooksReady(r.draft_payload)) maintenanceRemindersDraftReady++
      }
      if (
        r.scheduled_for &&
        Date.parse(r.scheduled_for) < now &&
        (r.status === "pending" || r.status === "approved")
      ) {
        maintenanceRemindersOverdue++
      }
    }
  }

  return NextResponse.json({
    pendingTotal: filtered.length,
    overdueReminders,
    invoiceRemindersPending: invoicePending,
    proposalFollowUpsPending: proposalFollowUps,
    maintenanceRemindersPending,
    maintenanceRemindersOverdue,
    maintenanceRemindersDraftReady,
  })
}
