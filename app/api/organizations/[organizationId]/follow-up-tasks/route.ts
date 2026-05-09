import { NextResponse } from "next/server"
import { filterFollowUpTasksForViewer } from "@/lib/follow-up-automation/filter-view"
import type { FollowUpTaskRow } from "@/lib/follow-up-automation/types"
import { requireOrgPermission } from "@/lib/api/require-org-permission"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status })
}

export async function GET(request: Request, context: { params: Promise<{ organizationId: string }> }) {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) return jsonError("Invalid organization.", 400)

  const gate = await requireOrgPermission(organizationId, "canViewCommunications")
  if ("error" in gate) return gate.error

  const url = new URL(request.url)
  const statusFilter = url.searchParams.get("status")

  let q = gate.supabase
    .from("follow_up_tasks")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(250)

  if (statusFilter && statusFilter !== "all") {
    q = q.eq("status", statusFilter)
  }

  const { data, error } = await q
  if (error) return jsonError(error.message, 500)

  const rows = (data ?? []) as FollowUpTaskRow[]
  const filtered = filterFollowUpTasksForViewer(rows, gate.permissions, gate.userId)

  return NextResponse.json({ tasks: filtered })
}
