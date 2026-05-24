import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { listGrowthRepRoster, updateGrowthRepRosterEntry } from "@/lib/growth/assignment/rep-roster-repository"
import { GROWTH_REP_STATUSES } from "@/lib/growth/assignment/assignment-types"

export const runtime = "nodejs"

const UpdateRepSchema = z.object({
  userId: z.string().uuid(),
  status: z.enum(GROWTH_REP_STATUSES).optional(),
  maxActiveLeads: z.number().int().min(1).max(500).optional(),
  maxDailyNewAssignments: z.number().int().min(0).max(100).optional(),
  industries: z.array(z.string().trim().max(50)).optional(),
  territories: z.array(z.string().trim().max(50)).optional(),
  leadTypes: z.array(z.string().trim().max(50)).optional(),
  roundRobinOrder: z.number().int().min(0).max(1000).optional(),
  displayName: z.string().trim().max(120).optional().nullable(),
})

export async function GET() {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  try {
    const reps = await listGrowthRepRoster(access.admin)
    return NextResponse.json({ ok: true, reps })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not load rep roster."
    return NextResponse.json({ error: "fetch_failed", message }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const parsed = UpdateRepSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", message: "Invalid rep update payload." }, { status: 400 })
  }

  try {
    const rep = await updateGrowthRepRosterEntry(access.admin, parsed.data.userId, {
      status: parsed.data.status,
      maxActiveLeads: parsed.data.maxActiveLeads,
      maxDailyNewAssignments: parsed.data.maxDailyNewAssignments,
      industries: parsed.data.industries,
      territories: parsed.data.territories,
      leadTypes: parsed.data.leadTypes,
      roundRobinOrder: parsed.data.roundRobinOrder,
      displayName: parsed.data.displayName,
    })
    if (!rep) {
      return NextResponse.json({ error: "not_found", message: "Rep not found." }, { status: 404 })
    }
    return NextResponse.json({ ok: true, rep })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not update rep."
    return NextResponse.json({ error: "update_failed", message }, { status: 500 })
  }
}
