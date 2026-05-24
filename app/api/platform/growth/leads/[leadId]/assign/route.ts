import { NextResponse } from "next/server"
import { z } from "zod"
import { logGrowthEngine, requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { assignGrowthLead, unassignGrowthLead } from "@/lib/growth/assignment/assign-lead"
import { GROWTH_LEAD_ASSIGNMENT_SOURCES } from "@/lib/growth/assignment/assignment-types"

export const runtime = "nodejs"

const AssignSchema = z.object({
  assignedToUserId: z.string().uuid().optional().nullable(),
  source: z.enum(GROWTH_LEAD_ASSIGNMENT_SOURCES).optional(),
  managerOverride: z.boolean().optional(),
  reason: z.string().trim().max(500).optional().nullable(),
})

export async function POST(
  request: Request,
  context: { params: Promise<{ leadId: string }> },
) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const { leadId } = await context.params
  if (!z.string().uuid().safeParse(leadId).success) {
    return NextResponse.json({ error: "invalid_lead_id", message: "Lead id must be a UUID." }, { status: 400 })
  }

  const parsed = AssignSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", message: "Invalid assignment payload." }, { status: 400 })
  }

  try {
    if (!parsed.data.assignedToUserId) {
      const result = await unassignGrowthLead(access.admin, {
        leadId,
        actingUserId: access.userId,
        actingUserEmail: access.userEmail,
        reason: parsed.data.reason,
      })
      if (!result.ok) {
        return NextResponse.json({ error: result.code, message: result.message }, { status: 400 })
      }
      logGrowthEngine("lead_unassign_api_success", { leadId, actorEmail: access.userEmail })
      return NextResponse.json({ ok: true, lead: result.lead, event: result.event })
    }

    const source =
      parsed.data.managerOverride === true
        ? "manager_override"
        : (parsed.data.source ?? "manual")

    const result = await assignGrowthLead(access.admin, {
      leadId,
      assignedToUserId: parsed.data.assignedToUserId,
      source,
      actingUserId: access.userId,
      actingUserEmail: access.userEmail,
      allowManualOverwrite: parsed.data.managerOverride === true,
    })

    if (!result.ok) {
      const status = result.code === "not_found" ? 404 : 400
      return NextResponse.json({ error: result.code, message: result.message }, { status })
    }

    logGrowthEngine("lead_assign_api_success", { leadId, assignedTo: parsed.data.assignedToUserId, source })
    return NextResponse.json({ ok: true, lead: result.lead, event: result.event })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Assignment action failed."
    return NextResponse.json({ error: "action_failed", message }, { status: 500 })
  }
}
